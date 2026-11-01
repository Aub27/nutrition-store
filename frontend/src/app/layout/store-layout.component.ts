import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, filter, of, switchMap, tap } from 'rxjs';
import { CatalogService } from '../core/services/catalog.service';
import { CartService } from '../core/services/cart.service';
import { SiteSettingsService } from '../core/services/site-settings.service';
import { mediaUrl } from '../core/services/media';
import { UiService } from '../core/services/ui.service';
import { I18nService } from '../core/i18n/i18n.service';
import { Category, Goal, Product } from '../shared/models';
import { DrawerComponent } from '../shared/components/drawer.component';
import { IconComponent } from '../shared/components/icon.component';
import { MediaComponent } from '../shared/components/media.component';
import { LocPipe, MoneyPipe, TPipe } from '../shared/pipes/i18n.pipes';

@Component({
  selector: 'app-store-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DrawerComponent, IconComponent, MediaComponent, TPipe, LocPipe, MoneyPipe],
  templateUrl: './store-layout.component.html',
  styleUrl: './store-layout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoreLayoutComponent {
  protected ui = inject(UiService);
  protected cart = inject(CartService);
  protected i18n = inject(I18nService);
  private catalog = inject(CatalogService);
  private router = inject(Router);
  protected settings = inject(SiteSettingsService).settings;

  protected categories = signal<Category[]>([]);
  protected goals = signal<Goal[]>([]);
  protected megaOpen = signal(false);
  protected scrolled = signal(false);
  protected year = new Date().getFullYear();

  protected query = signal('');
  protected results = signal<Product[]>([]);
  protected searching = signal(false);
  protected searchOpen = signal(false);

  protected announcement = computed(() => {
    this.i18n.lang();
    const s = this.settings();
    const text = this.i18n.lang() === 'ar' ? s?.announcement_ar || s?.announcement_fr : s?.announcement_fr;
    return text || this.i18n.t('topbar.default');
  });
  protected tagline = computed(() => {
    const s = this.settings();
    return (this.i18n.lang() === 'ar' ? s?.tagline_ar : null) || s?.tagline_fr || '';
  });
  protected whatsappHref = computed(() => {
    const digits = (this.settings()?.whatsapp_number ?? '').replace(/\D/g, '');
    return digits.length >= 8 ? `https://wa.me/${digits}` : null;
  });
  protected phoneHref = computed(() => {
    const raw = (this.settings()?.contact_phone ?? '').replace(/[^\d+]/g, '');
    return raw ? `tel:${raw}` : null;
  });
  protected logo = computed(() => mediaUrl(this.settings()?.logo_url));
  protected threshold = computed(() => this.settings()?.free_delivery_threshold ?? null);

  constructor() {
    this.catalog.categories().pipe(catchError(() => of([] as Category[])), takeUntilDestroyed()).subscribe((c) => this.categories.set(c));
    this.catalog.goals().pipe(catchError(() => of([] as Goal[])), takeUntilDestroyed()).subscribe((g) => this.goals.set(g));

    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => {
        this.megaOpen.set(false);
        this.searchOpen.set(false);
        this.ui.closeAll();
      });

    toObservable(this.query)
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        tap((q) => {
          if (q.trim().length < 2) this.results.set([]);
          this.searching.set(q.trim().length >= 2);
        }),
        switchMap((q) =>
          q.trim().length < 2
            ? of(null)
            : this.catalog.products({ q: q.trim(), page_size: 5 }).pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((page) => {
        this.searching.set(false);
        if (page) this.results.set(page.items);
      });

    // Lock page scroll while an overlay is open.
    effect(() => {
      document.body.style.overflow = this.ui.cartOpen() || this.ui.menuOpen() ? 'hidden' : '';
    });

    window.addEventListener('scroll', () => this.scrolled.set(window.scrollY > 24), { passive: true });
  }

  protected onSearchInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.searchOpen.set(true);
  }

  protected submitSearch(event?: Event): void {
    event?.preventDefault();
    const q = this.query().trim();
    if (!q) return;
    this.searchOpen.set(false);
    this.ui.closeAll();
    this.router.navigate(['/boutique'], { queryParams: { q } });
  }

  protected closeSearchSoon(): void {
    // Delay so a click on a suggestion registers before the list disappears.
    setTimeout(() => this.searchOpen.set(false), 180);
  }

  protected setQty(productId: number, option: string | null, qty: number): void {
    this.cart.setQuantity(productId, option, qty);
  }

  protected freeProgress(): number {
    const t = this.threshold();
    if (!t || Number(t) <= 0) return 0;
    return Math.min(100, Math.round((this.cart.subtotal() / Number(t)) * 100));
  }
}
