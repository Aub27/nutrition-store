import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, tap } from 'rxjs';
import { CatalogService } from '../../core/services/catalog.service';
import { CartService } from '../../core/services/cart.service';
import { SiteSettingsService } from '../../core/services/site-settings.service';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { Product } from '../../shared/models';
import { IconComponent } from '../../shared/components/icon.component';
import { MediaComponent } from '../../shared/components/media.component';
import { ProductCardComponent } from '../../shared/components/product-card.component';
import { LocPipe, MoneyPipe, TPipe } from '../../shared/pipes/i18n.pipes';

type Tab = 'description' | 'nutrition' | 'usage';

@Component({
  selector: 'app-product',
  imports: [RouterLink, IconComponent, MediaComponent, ProductCardComponent, TPipe, LocPipe, MoneyPipe],
  templateUrl: './product.page.html',
  styleUrl: './product.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductPage {
  private catalog = inject(CatalogService);
  private cart = inject(CartService);
  private toast = inject(ToastService);
  private ui = inject(UiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private title = inject(Title);
  protected i18n = inject(I18nService);
  protected settings = inject(SiteSettingsService).settings;

  protected product = signal<Product | null>(null);
  protected related = signal<Product[]>([]);
  protected loading = signal(true);
  protected notFound = signal(false);
  protected option = signal<string | null>(null);
  protected optionError = signal(false);
  protected qty = signal(1);
  protected tab = signal<Tab>('description');

  protected soldOut = computed(() => this.product()?.stock_status === 'out_of_stock');
  protected discount = computed(() => {
    const p = this.product();
    if (!p?.compare_at_price) return 0;
    const old = Number(p.compare_at_price);
    const now = Number(p.price);
    return old > now ? Math.round(((old - now) / old) * 100) : 0;
  });
  protected tabs = computed(() => {
    const p = this.product();
    if (!p) return [];
    const out: { id: Tab; label: string; body: string }[] = [];
    const desc = this.i18n.pick(p, 'full_description') || this.i18n.pick(p, 'short_description');
    out.push({ id: 'description', label: 'product.description', body: desc });
    out.push({ id: 'nutrition', label: 'product.nutrition', body: p.nutrition_facts ?? '' });
    out.push({ id: 'usage', label: 'product.usage', body: this.i18n.pick(p, 'usage') });
    return out;
  });
  protected activeBody = computed(() => this.tabs().find((t) => t.id === this.tab())?.body ?? '');

  constructor() {
    this.route.paramMap
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.notFound.set(false);
          this.option.set(null);
          this.optionError.set(false);
          this.qty.set(1);
          this.tab.set('description');
        }),
        switchMap((pm) => {
          const slug = pm.get('slug') ?? '';
          return this.catalog.product(slug).pipe(
            tap((p) => this.title.setTitle(`${p.name_fr} — ${this.settings()?.site_title ?? ''}`)),
            switchMap((p) =>
              this.catalog.related(slug).pipe(
                catchError(() => of([] as Product[])),
                tap((r) => this.related.set(r)),
                switchMap(() => of(p)),
              ),
            ),
            catchError(() => {
              this.notFound.set(true);
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((p) => {
        this.product.set(p);
        this.loading.set(false);
      });
  }

  protected pickOption(o: string): void {
    this.option.set(o);
    this.optionError.set(false);
  }

  protected step(delta: number): void {
    this.qty.update((q) => Math.min(20, Math.max(1, q + delta)));
  }

  private validate(): Product | null {
    const p = this.product();
    if (!p || this.soldOut()) return null;
    if (p.options.length && !this.option()) {
      this.optionError.set(true);
      return null;
    }
    return p;
  }

  protected addToCart(): void {
    const p = this.validate();
    if (!p) return;
    this.cart.add(p, this.qty(), this.option());
    this.toast.success(this.i18n.t('common.added'));
    this.ui.openCart();
  }

  protected buyNow(): void {
    const p = this.validate();
    if (!p) return;
    this.cart.add(p, this.qty(), this.option());
    this.router.navigate(['/commande']);
  }

  protected addRelated(p: Product): void {
    this.cart.add(p, 1, null);
    this.toast.success(this.i18n.t('common.added'));
  }

  protected openRelated(p: Product): void {
    this.router.navigate(['/produit', p.slug]);
  }
}
