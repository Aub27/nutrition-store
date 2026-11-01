import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, tap } from 'rxjs';
import { CatalogService } from '../../core/services/catalog.service';
import { CartService } from '../../core/services/cart.service';
import { ToastService } from '../../core/services/toast.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { Category, Goal, Page, Product, ProductQuery } from '../../shared/models';
import { DrawerComponent } from '../../shared/components/drawer.component';
import { IconComponent } from '../../shared/components/icon.component';
import { ProductCardComponent } from '../../shared/components/product-card.component';
import { LocPipe, TPipe } from '../../shared/pipes/i18n.pipes';

const SORTS = ['popular', 'newest', 'price_asc', 'price_desc', 'name'];
const BOOL_KEYS = ['on_sale', 'in_stock', 'is_new', 'is_bestseller', 'free_delivery'] as const;

@Component({
  selector: 'app-shop',
  imports: [RouterLink, NgTemplateOutlet, DrawerComponent, IconComponent, ProductCardComponent, TPipe, LocPipe],
  templateUrl: './shop.page.html',
  styleUrl: './shop.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopPage {
  private catalog = inject(CatalogService);
  private cart = inject(CartService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  protected i18n = inject(I18nService);

  protected categories = signal<Category[]>([]);
  protected goals = signal<Goal[]>([]);
  protected brands = signal<string[]>([]);
  protected result = signal<Page<Product>>({ items: [], total: 0, page: 1, page_size: 12, pages: 1 });
  protected loading = signal(true);
  protected failed = signal(false);
  protected filtersOpen = signal(false);
  protected sorts = SORTS;

  protected query = signal<ProductQuery>({});
  protected minPrice = signal('');
  protected maxPrice = signal('');

  protected activeCategory = computed(() => this.categories().find((c) => c.slug === this.query().category) ?? null);
  protected activeGoal = computed(() => this.goals().find((g) => g.slug === this.query().goal) ?? null);
  protected activeCount = computed(() => {
    const q = this.query();
    return [q.category, q.goal, q.brand, q.min_price, q.max_price, q.on_sale, q.in_stock, q.is_new, q.is_bestseller, q.free_delivery, q.q].filter(
      (v) => v !== undefined && v !== false && v !== '',
    ).length;
  });
  protected pages = computed(() => {
    const { page, pages } = this.result();
    const out: number[] = [];
    for (let p = Math.max(1, page - 2); p <= Math.min(pages, page + 2); p++) out.push(p);
    return out;
  });

  constructor() {
    this.catalog.categories().pipe(catchError(() => of([] as Category[])), takeUntilDestroyed()).subscribe((c) => this.categories.set(c));
    this.catalog.goals().pipe(catchError(() => of([] as Goal[])), takeUntilDestroyed()).subscribe((g) => this.goals.set(g));
    this.catalog.brands().pipe(catchError(() => of([] as string[])), takeUntilDestroyed()).subscribe((b) => this.brands.set(b));

    this.route.queryParamMap
      .pipe(
        tap((pm) => {
          const q: ProductQuery = { page: Math.max(1, Number(pm.get('page')) || 1), page_size: 12 };
          const str = (k: 'category' | 'goal' | 'brand' | 'q') => {
            const v = pm.get(k);
            if (v) q[k] = v.slice(0, 120);
          };
          str('category');
          str('goal');
          str('brand');
          str('q');
          const sort = pm.get('sort');
          q.sort = sort && SORTS.includes(sort) ? sort : 'popular';
          for (const k of BOOL_KEYS) if (pm.get(k) === 'true') q[k] = true;
          const min = Number(pm.get('min_price'));
          const max = Number(pm.get('max_price'));
          if (pm.get('min_price') && Number.isFinite(min) && min >= 0) q.min_price = min;
          if (pm.get('max_price') && Number.isFinite(max) && max >= 0) q.max_price = max;
          this.query.set(q);
          this.minPrice.set(q.min_price !== undefined ? String(q.min_price) : '');
          this.maxPrice.set(q.max_price !== undefined ? String(q.max_price) : '');
          this.loading.set(true);
          this.failed.set(false);
        }),
        switchMap(() =>
          this.catalog.products(this.query()).pipe(
            catchError(() => {
              this.failed.set(true);
              return of({ items: [], total: 0, page: 1, page_size: 12, pages: 1 } as Page<Product>);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((page) => {
        this.result.set(page);
        this.loading.set(false);
      });
  }

  protected set(params: Record<string, string | number | boolean | null>): void {
    const clean: Record<string, string | number | boolean | null> = { page: null };
    for (const [k, v] of Object.entries(params)) clean[k] = v === false || v === '' ? null : v;
    this.router.navigate([], { relativeTo: this.route, queryParams: clean, queryParamsHandling: 'merge' });
  }

  protected toggle(key: (typeof BOOL_KEYS)[number]): void {
    this.set({ [key]: !this.query()[key] });
  }

  protected applyPrice(): void {
    this.set({ min_price: this.minPrice() || null, max_price: this.maxPrice() || null });
  }

  protected reset(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  protected goPage(p: number): void {
    if (p < 1 || p > this.result().pages) return;
    this.router.navigate([], { relativeTo: this.route, queryParams: { page: p }, queryParamsHandling: 'merge' });
  }

  protected inputValue(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected add(p: Product): void {
    this.cart.add(p, 1, null);
    this.toast.success(this.i18n.t('common.added'));
  }

  protected choose(p: Product): void {
    this.router.navigate(['/produit', p.slug]);
  }
}
