import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CatalogService } from '../../core/services/catalog.service';
import { CartService } from '../../core/services/cart.service';
import { SiteSettingsService } from '../../core/services/site-settings.service';
import { ToastService } from '../../core/services/toast.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { Category, Goal, Page, Product } from '../../shared/models';
import { IconComponent } from '../../shared/components/icon.component';
import { MediaComponent } from '../../shared/components/media.component';
import { ProductCardComponent } from '../../shared/components/product-card.component';
import { LocPipe, TPipe } from '../../shared/pipes/i18n.pipes';

const empty: Page<Product> = { items: [], total: 0, page: 1, page_size: 8, pages: 1 };

@Component({
  selector: 'app-home',
  imports: [RouterLink, IconComponent, MediaComponent, ProductCardComponent, TPipe, LocPipe],
  templateUrl: './home.page.html',
  styleUrl: './home.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  private catalog = inject(CatalogService);
  private cart = inject(CartService);
  private toast = inject(ToastService);
  private router = inject(Router);
  protected i18n = inject(I18nService);
  protected settings = inject(SiteSettingsService).settings;

  protected loading = signal(true);
  protected categories = signal<Category[]>([]);
  protected goals = signal<Goal[]>([]);
  protected brands = signal<string[]>([]);
  protected fresh = signal<Product[]>([]);
  protected best = signal<Product[]>([]);
  protected promo = signal<Product[]>([]);
  protected hasProducts = computed(() => this.fresh().length + this.best().length + this.promo().length > 0);
  protected threshold = computed(() => {
    const t = this.settings()?.free_delivery_threshold;
    return t ? Math.round(Number(t)) : null;
  });

  constructor() {
    forkJoin({
      categories: this.catalog.categories().pipe(catchError(() => of([] as Category[]))),
      goals: this.catalog.goals().pipe(catchError(() => of([] as Goal[]))),
      brands: this.catalog.brands().pipe(catchError(() => of([] as string[]))),
      fresh: this.catalog.products({ is_new: true, sort: 'newest', page_size: 8 }).pipe(catchError(() => of(empty))),
      best: this.catalog.products({ is_bestseller: true, page_size: 8 }).pipe(catchError(() => of(empty))),
      promo: this.catalog.products({ on_sale: true, page_size: 8 }).pipe(catchError(() => of(empty))),
    }).subscribe((r) => {
      this.categories.set(r.categories);
      this.goals.set(r.goals);
      this.brands.set(r.brands);
      this.fresh.set(r.fresh.items);
      this.best.set(r.best.items);
      this.promo.set(r.promo.items);
      this.loading.set(false);
    });
  }

  protected add(p: Product): void {
    this.cart.add(p, 1, null);
    this.toast.success(this.i18n.t('common.added'));
  }

  protected choose(p: Product): void {
    this.router.navigate(['/produit', p.slug]);
  }
}
