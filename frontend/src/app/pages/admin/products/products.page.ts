import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon.component';
import { MediaComponent } from '../../../shared/components/media.component';
import { MoneyPipe } from '../../../shared/pipes/i18n.pipes';
import { AdminProduct, Category } from '../../../shared/models';
import { inputValue } from '../shared/format';
import { errorMessage } from '../shared/http-error';
import { SwitchComponent } from '../shared/switch.component';
import { ProductEditorComponent } from './product-editor.component';

type StatusFilter = 'all' | 'active' | 'hidden' | 'low';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'active', label: 'Actifs' },
  { key: 'hidden', label: 'Masqués' },
  { key: 'low', label: 'Stock faible' },
];
const MAX_STOCK = 1_000_000;

@Component({
  selector: 'adm-products',
  imports: [RouterLink, IconComponent, MediaComponent, MoneyPipe, SwitchComponent, ProductEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['../shared/admin-common.css', './products.page.css'],
  template: `
    <div class="page">
      <div class="toolbar">
        <div class="search">
          <app-icon name="search" [size]="18" />
          <input class="input" type="search" placeholder="Rechercher un produit…" aria-label="Rechercher un produit" [value]="q()" (input)="onSearch($event)" />
        </div>
        <select class="select cat-select" aria-label="Filtrer par catégorie" (change)="setCategory($event)">
          <option value="" [selected]="categoryId() === null">Toutes les catégories</option>
          @for (c of categories(); track c.id) {
            <option [value]="c.id" [selected]="categoryId() === c.id">{{ c.name_fr }}</option>
          }
        </select>
        <span class="grow"></span>
        <button type="button" class="btn btn-primary" (click)="openCreate()">
          <app-icon name="plus" [size]="18" [stroke]="2.6" /> Nouveau produit
        </button>
      </div>

      <div class="chips status-chips" role="group" aria-label="Filtrer par statut">
        @for (f of filters; track f.key) {
          <button type="button" class="chip" [class.is-active]="status() === f.key" [attr.aria-pressed]="status() === f.key" (click)="setStatus(f.key)">
            @if (f.key === 'low') { <app-icon name="alert" [size]="14" /> }
            {{ f.label }}
          </button>
        }
        @if (!loading()) {
          <span class="total">{{ total() }} produit{{ total() > 1 ? 's' : '' }}</span>
        }
      </div>

      @if (error(); as e) {
        <div class="banner err" role="alert">
          <app-icon name="alert" [size]="18" />
          <div><p>{{ e }}</p><button type="button" class="btn btn-sm btn-ghost retry" (click)="reload()">Réessayer</button></div>
        </div>
      }

      @if (loading()) {
        <div class="grid">
          @for (i of [1, 2, 3, 4, 5, 6, 7, 8]; track i) {
            <div class="skeleton sk"></div>
          }
        </div>
      } @else if (items().length === 0 && !error()) {
        @if (!hasFilters()) {
          <div class="empty-state card">
            <span class="orb"><app-icon name="package" [size]="38" /></span>
            <h3>Aucun produit — ajoutez le premier</h3>
            <p class="muted">Créez votre premier produit pour commencer à vendre. Photo, prix et stock en quelques clics.</p>
            @if (catsLoaded() && categories().length === 0) {
              <div class="banner warn hint-cat">
                <app-icon name="grid" [size]="18" />
                <span>Il vous faut d'abord au moins une catégorie. <a routerLink="/admin/categories" class="lnk">Créer une catégorie →</a></span>
              </div>
              <a class="btn btn-primary btn-lg" routerLink="/admin/categories"><app-icon name="grid" [size]="18" /> Créer ma première catégorie</a>
            } @else {
              <button type="button" class="btn btn-primary btn-lg" (click)="openCreate()"><app-icon name="plus" [size]="18" [stroke]="2.6" /> Ajouter un produit</button>
            }
          </div>
        } @else {
          <div class="empty-state card">
            <span class="orb"><app-icon name="search" [size]="34" /></span>
            <h3>Aucun produit ne correspond</h3>
            <p class="muted">Essayez d'autres mots-clés ou retirez certains filtres.</p>
            <button type="button" class="btn btn-ghost" (click)="resetFilters()">Réinitialiser les filtres</button>
          </div>
        }
      } @else {
        <div class="grid">
          @for (p of items(); track p.id) {
            <article class="pcard" [class.is-hidden]="!p.is_active">
              <div class="media">
                <app-media [url]="p.image_url" [alt]="p.name_fr" [label]="p.brand ?? ''" [seed]="p.id" [iconSize]="44" />
                <div class="badges">
                  @if (discount(p) > 0) { <span class="badge badge-sale">-{{ discount(p) }}%</span> }
                  @if (p.is_new) { <span class="badge badge-new">Nouveau</span> }
                  @if (p.is_bestseller) { <span class="badge badge-best">Best-seller</span> }
                  @if (p.free_delivery) { <span class="badge badge-free"><app-icon name="truck" [size]="11" /> Livraison offerte</span> }
                </div>
                @if (!p.is_active) {
                  <span class="veil"><app-icon name="eye-off" [size]="16" /> Masqué</span>
                }
              </div>
              <div class="body">
                @if (p.brand) { <span class="brand">{{ p.brand }}</span> }
                <h3 class="name"><button type="button" class="name-btn" (click)="openEdit(p)">{{ p.name_fr }}</button></h3>
                <span class="cat"><app-icon name="grid" [size]="12" /> {{ catName(p.category_id) }}</span>
                <div class="price">
                  <strong>{{ p.price | money }}</strong>
                  @if (p.compare_at_price) { <s>{{ p.compare_at_price | money }}</s> }
                </div>
              </div>
              <div class="ctrl">
                @if (p.stock_quantity === null) {
                  <div class="unl"><app-icon name="sparkle" [size]="14" /> Stock illimité
                    <button type="button" class="tiny" (click)="trackStock(p)">Suivre</button>
                  </div>
                } @else {
                  <div class="stepper" [class.low]="p.stock_quantity > 0 && p.stock_quantity <= 5" [class.out]="p.stock_quantity === 0" role="group" [attr.aria-label]="'Stock de ' + p.name_fr">
                    <button type="button" (click)="setStock(p, p.stock_quantity - 1)" [disabled]="p.stock_quantity <= 0" aria-label="Retirer une unité"><app-icon name="minus" [size]="16" [stroke]="2.6" /></button>
                    <input type="number" min="0" inputmode="numeric" [value]="p.stock_quantity" (change)="onStockInput(p, $event)" (keydown.enter)="blur($event)" aria-label="Quantité en stock" />
                    <button type="button" (click)="setStock(p, p.stock_quantity + 1)" aria-label="Ajouter une unité"><app-icon name="plus" [size]="16" [stroke]="2.6" /></button>
                  </div>
                }
                <span class="grow"></span>
                <adm-switch [checked]="p.is_active" [label]="p.is_active ? 'Masquer ' + p.name_fr : 'Afficher ' + p.name_fr" (toggled)="toggleActive(p, $event)" />
                <button type="button" class="icon-btn" (click)="openEdit(p)" [attr.aria-label]="'Modifier ' + p.name_fr"><app-icon name="edit" [size]="18" /></button>
              </div>
            </article>
          }
        </div>
        @if (hasMore()) {
          <div class="more">
            <button type="button" class="btn btn-ghost" (click)="loadMore()" [disabled]="loadingMore()">
              @if (loadingMore()) { <span class="spinner dark"></span> } Charger plus
            </button>
          </div>
        }
      }
    </div>

    <adm-product-editor
      [open]="editorOpen()"
      [product]="editing()"
      [categories]="categories()"
      (saved)="onSaved($event)"
      (deleted)="onDeleted($event)"
      (closed)="closeEditor()"
    />
  `,
})
export class ProductsPage {
  private api = inject(AdminApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private qp = toSignal(this.route.queryParamMap);

  protected readonly filters = FILTERS;
  protected readonly items = signal<AdminProduct[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly catsLoaded = signal(false);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pages = signal(1);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly q = signal('');
  protected readonly categoryId = signal<number | null>(null);
  protected readonly status = signal<StatusFilter>('all');

  protected readonly editorOpen = signal(false);
  protected readonly editing = signal<AdminProduct | null>(null);

  protected readonly hasMore = computed(() => this.page() < this.pages());
  protected readonly hasFilters = computed(() => !!this.q().trim() || this.categoryId() !== null || this.status() !== 'all');
  private readonly catMap = computed(() => new Map(this.categories().map((c) => [c.id, c.name_fr])));

  private reqId = 0;
  private searchTimer = 0;
  private stockTimers = new Map<number, number>();
  private stockBase = new Map<number, number | null>();
  private firstParams = true;

  constructor() {
    this.api.categories().subscribe({
      next: (c) => {
        this.categories.set(c);
        this.catsLoaded.set(true);
      },
      error: () => this.catsLoaded.set(true),
    });

    effect(() => {
      const p = this.qp();
      if (!p) return;
      untracked(() => {
        const low = p.get('filter') === 'low_stock';
        if (low && this.status() !== 'low') this.status.set('low');
        if (this.firstParams || low) {
          this.firstParams = false;
          this.reload();
        }
        if (p.get('new')) {
          this.openCreate();
          this.router.navigate([], { relativeTo: this.route, queryParams: { new: null }, queryParamsHandling: 'merge', replaceUrl: true });
        }
      });
    });

    inject(DestroyRef).onDestroy(() => {
      window.clearTimeout(this.searchTimer);
      this.stockTimers.forEach((t) => window.clearTimeout(t));
    });
  }

  protected discount(p: AdminProduct): number {
    if (!p.compare_at_price) return 0;
    const old = Number(p.compare_at_price);
    const now = Number(p.price);
    return old > now ? Math.round(((old - now) / old) * 100) : 0;
  }

  protected catName(id: number): string {
    return this.catMap().get(id) ?? 'Sans catégorie';
  }

  protected onSearch(ev: Event): void {
    this.q.set(inputValue(ev));
    window.clearTimeout(this.searchTimer);
    this.searchTimer = window.setTimeout(() => this.reload(), 300);
  }

  protected setCategory(ev: Event): void {
    const v = inputValue(ev);
    this.categoryId.set(v ? Number(v) : null);
    this.reload();
  }

  protected setStatus(s: StatusFilter): void {
    if (this.status() === s) return;
    this.status.set(s);
    this.reload();
  }

  protected resetFilters(): void {
    this.q.set('');
    this.categoryId.set(null);
    this.status.set('all');
    this.reload();
  }

  protected reload(): void {
    this.fetch(1, false);
  }

  protected loadMore(): void {
    this.fetch(this.page() + 1, true);
  }

  private fetch(page: number, append: boolean): void {
    const id = ++this.reqId;
    const s = this.status();
    if (append) this.loadingMore.set(true);
    else this.loading.set(true);
    this.api
      .products({
        q: this.q().trim() || undefined,
        category_id: this.categoryId() ?? undefined,
        is_active: s === 'active' ? true : s === 'hidden' ? false : undefined,
        low_stock: s === 'low' ? true : undefined,
        page,
        page_size: s === 'low' ? 100 : 24,
      })
      .subscribe({
        next: (res) => {
          if (id !== this.reqId) return;
          this.items.update((list) => (append ? [...list, ...res.items.filter((n) => !list.some((o) => o.id === n.id))] : res.items));
          this.total.set(s === 'low' ? this.items().length : res.total);
          this.page.set(res.page);
          this.pages.set(res.pages);
          this.error.set(null);
          this.loading.set(false);
          this.loadingMore.set(false);
        },
        error: (e) => {
          if (id !== this.reqId) return;
          this.error.set(errorMessage(e, 'Impossible de charger les produits.'));
          this.loading.set(false);
          this.loadingMore.set(false);
        },
      });
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.editorOpen.set(true);
  }

  protected openEdit(p: AdminProduct): void {
    this.editing.set(p);
    this.editorOpen.set(true);
  }

  protected closeEditor(): void {
    this.editorOpen.set(false);
  }

  protected onSaved(p: AdminProduct): void {
    const exists = this.items().some((x) => x.id === p.id);
    this.items.update((list) => (exists ? list.map((x) => (x.id === p.id ? p : x)) : [p, ...list]));
    if (!exists) this.total.update((t) => t + 1);
  }

  protected onDeleted(id: number): void {
    this.items.update((list) => list.filter((x) => x.id !== id));
    this.total.update((t) => Math.max(0, t - 1));
  }

  protected blur(ev: Event): void {
    (ev.target as HTMLElement).blur();
  }

  private patchLocal(id: number, patch: Partial<AdminProduct>): void {
    this.items.update((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  protected toggleActive(p: AdminProduct, value: boolean): void {
    this.patchLocal(p.id, { is_active: value });
    this.api.quickUpdateProduct(p.id, { is_active: value }).subscribe({
      next: () => this.toast.success(value ? 'Produit visible en boutique' : 'Produit masqué'),
      error: (e) => {
        this.patchLocal(p.id, { is_active: !value });
        this.toast.error(errorMessage(e));
      },
    });
  }

  protected onStockInput(p: AdminProduct, ev: Event): void {
    const raw = Number(inputValue(ev));
    const v = Number.isFinite(raw) ? Math.trunc(raw) : (p.stock_quantity ?? 0);
    this.setStock(p, v);
    (ev.target as HTMLInputElement).value = String(Math.min(MAX_STOCK, Math.max(0, v)));
  }

  /** Optimistic update; the request is debounced so rapid +/- clicks produce a single call. */
  protected setStock(p: AdminProduct, value: number): void {
    const qty = Math.min(MAX_STOCK, Math.max(0, value));
    if (!this.stockBase.has(p.id)) this.stockBase.set(p.id, p.stock_quantity);
    this.patchLocal(p.id, { stock_quantity: qty, stock_status: qty === 0 ? 'out_of_stock' : qty <= 5 ? 'low_stock' : 'in_stock' });
    window.clearTimeout(this.stockTimers.get(p.id));
    this.stockTimers.set(
      p.id,
      window.setTimeout(() => this.commitStock(p.id, qty), 500),
    );
  }

  private commitStock(id: number, qty: number): void {
    this.stockTimers.delete(id);
    const base = this.stockBase.get(id) ?? null;
    this.api.quickUpdateProduct(id, { stock_quantity: qty }).subscribe({
      next: (res) => {
        if (!this.stockTimers.has(id)) {
          this.stockBase.delete(id);
          this.patchLocal(id, { stock_status: res.stock_status, stock_quantity: res.stock_quantity });
        }
      },
      error: (e) => {
        if (!this.stockTimers.has(id)) this.stockBase.delete(id);
        this.patchLocal(id, { stock_quantity: base });
        this.toast.error(errorMessage(e));
      },
    });
  }

  protected trackStock(p: AdminProduct): void {
    this.patchLocal(p.id, { stock_quantity: 10 });
    this.api.quickUpdateProduct(p.id, { track_stock: true, stock_quantity: 10 }).subscribe({
      next: (res) => {
        this.patchLocal(p.id, { stock_quantity: res.stock_quantity, stock_status: res.stock_status });
        this.toast.success('Stock suivi : 10 unités. Ajustez avec − / +.');
      },
      error: (e) => {
        this.patchLocal(p.id, { stock_quantity: null });
        this.toast.error(errorMessage(e));
      },
    });
  }
}
