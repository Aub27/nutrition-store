import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { AdminApiService, ProductInput } from '../../../core/services/admin-api.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { DrawerComponent } from '../../../shared/components/drawer.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { ProductCardComponent } from '../../../shared/components/product-card.component';
import { AdminProduct, Category, Product, StockStatus } from '../../../shared/models';
import { MoneyPipe } from '../../../shared/pipes/i18n.pipes';
import { inputValue, orNull } from '../shared/format';
import { errorMessage } from '../shared/http-error';
import { ImageUploaderComponent } from '../shared/image-uploader.component';
import { SwitchComponent } from '../shared/switch.component';

export const GOALS = [
  { slug: 'mass-gain', name: 'Prise de masse' },
  { slug: 'weight-loss', name: 'Contrôle et perte de poids' },
  { slug: 'muscle-building', name: 'Développement musculaire' },
  { slug: 'wellness', name: 'Vitamines & bien-être' },
  { slug: 'healthy-food', name: 'Alimentation saine' },
];

interface Draft {
  name_fr: string;
  name_ar: string;
  brand: string;
  category_id: number | null;
  goal: string;
  price: string;
  compare_at_price: string;
  image_url: string | null;
  short_description_fr: string;
  short_description_ar: string;
  full_description_fr: string;
  full_description_ar: string;
  nutrition_facts: string;
  usage_fr: string;
  usage_ar: string;
  option_label: string;
  options: string[];
  track_stock: boolean;
  stock_quantity: string;
  is_active: boolean;
  is_new: boolean;
  is_bestseller: boolean;
  free_delivery: boolean;
  weight_label: string;
}
type TextKey = { [K in keyof Draft]: Draft[K] extends string ? K : never }[keyof Draft];
type BoolKey = { [K in keyof Draft]: Draft[K] extends boolean ? K : never }[keyof Draft];

const BLANK: Draft = {
  name_fr: '',
  name_ar: '',
  brand: '',
  category_id: null,
  goal: '',
  price: '',
  compare_at_price: '',
  image_url: null,
  short_description_fr: '',
  short_description_ar: '',
  full_description_fr: '',
  full_description_ar: '',
  nutrition_facts: '',
  usage_fr: '',
  usage_ar: '',
  option_label: '',
  options: [],
  track_stock: false,
  stock_quantity: '0',
  is_active: true,
  is_new: false,
  is_bestseller: false,
  free_delivery: false,
  weight_label: '',
};

const num = (v: string): number => (v.trim() === '' ? NaN : Number(v.replace(',', '.')));
const str = (v: string | null): string => v ?? '';
const money = (v: string | null): string => (v === null ? '' : String(Number(v)));

function fromProduct(p: AdminProduct | null): Draft {
  if (!p) return { ...BLANK, options: [] };
  return {
    name_fr: p.name_fr,
    name_ar: str(p.name_ar),
    brand: str(p.brand),
    category_id: p.category_id,
    goal: str(p.goal),
    price: money(p.price),
    compare_at_price: money(p.compare_at_price),
    image_url: p.image_url,
    short_description_fr: str(p.short_description_fr),
    short_description_ar: str(p.short_description_ar),
    full_description_fr: str(p.full_description_fr),
    full_description_ar: str(p.full_description_ar),
    nutrition_facts: str(p.nutrition_facts),
    usage_fr: str(p.usage_fr),
    usage_ar: str(p.usage_ar),
    option_label: str(p.option_label),
    options: [...p.options],
    track_stock: p.stock_quantity !== null,
    stock_quantity: String(p.stock_quantity ?? 0),
    is_active: p.is_active,
    is_new: p.is_new,
    is_bestseller: p.is_bestseller,
    free_delivery: p.free_delivery,
    weight_label: str(p.weight_label),
  };
}

type ErrorKey = 'name_fr' | 'price' | 'category_id' | 'stock' | 'short';

/** Create/edit drawer with live storefront preview. State is one signal so the preview and validation stay in sync. */
@Component({
  selector: 'adm-product-editor',
  imports: [DrawerComponent, IconComponent, ProductCardComponent, SwitchComponent, ImageUploaderComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['../shared/admin-common.css', './product-editor.component.css'],
  template: `
    <app-drawer [open]="open()" [label]="isEdit() ? 'Modifier le produit' : 'Nouveau produit'" width="1120px" (closed)="requestClose()">
      @if (open()) {
        <div drawer-title class="d-title">
          <span class="d-ico"><app-icon name="package" [size]="20" /></span>
          <div>
            <h3>{{ isEdit() ? 'Modifier le produit' : 'Nouveau produit' }}</h3>
            <small>{{ isEdit() ? d().name_fr : 'Renseignez les informations de base, le reste peut attendre.' }}</small>
          </div>
        </div>
      }
      @if (open()) {
        <div class="layout">
          <div class="form">
            @if (blocked(); as b) {
              <div class="banner warn" role="alert">
                <app-icon name="alert" [size]="18" />
                <div>
                  <p>{{ b }}</p>
                  <button type="button" class="btn btn-sm btn-ghost hide-btn" (click)="hideInstead()">
                    <app-icon name="eye-off" [size]="15" /> Masquer ce produit
                  </button>
                </div>
              </div>
            }

            <section class="sec">
              <div class="sec-head"><span class="sec-ico"><app-icon name="edit" [size]="18" /></span><div><h3>Infos générales</h3></div></div>
              <div class="grid-2">
                <div class="field span-2">
                  <label for="p-name">Nom (français) <span class="req">*</span></label>
                  <input id="p-name" class="input" [class.is-invalid]="show('name_fr')" maxlength="255" [value]="d().name_fr" (input)="txt('name_fr', $event)" placeholder="Ex. : Whey Protéine Vanille 2 kg" />
                  @if (show('name_fr')) { <span class="field-error">{{ errors().name_fr }}</span> }
                </div>
                <div class="field span-2">
                  <label for="p-name-ar">Nom (arabe)</label>
                  <input id="p-name-ar" class="input" dir="rtl" maxlength="255" [value]="d().name_ar" (input)="txt('name_ar', $event)" />
                </div>
                <div class="field">
                  <label for="p-brand">Marque</label>
                  <input id="p-brand" class="input" maxlength="100" [value]="d().brand" (input)="txt('brand', $event)" placeholder="Ex. : Optimum" />
                </div>
                <div class="field">
                  <label for="p-weight">Poids / format</label>
                  <input id="p-weight" class="input" maxlength="50" [value]="d().weight_label" (input)="txt('weight_label', $event)" placeholder="Ex. : 2 kg" />
                </div>
                <div class="field">
                  <label for="p-cat">Catégorie <span class="req">*</span></label>
                  <select id="p-cat" class="select" [class.is-invalid]="show('category_id')" (change)="setCategory($event)">
                    <option value="" [selected]="d().category_id === null">Choisir…</option>
                    @for (c of categories(); track c.id) {
                      <option [value]="c.id" [selected]="d().category_id === c.id">{{ c.name_fr }}</option>
                    }
                  </select>
                  @if (show('category_id')) { <span class="field-error">{{ errors().category_id }}</span> }
                </div>
                <div class="field">
                  <label for="p-goal">Objectif</label>
                  <select id="p-goal" class="select" (change)="txt('goal', $event)">
                    <option value="" [selected]="!d().goal">Aucun</option>
                    @for (g of goals; track g.slug) {
                      <option [value]="g.slug" [selected]="d().goal === g.slug">{{ g.name }}</option>
                    }
                  </select>
                </div>
              </div>
            </section>

            <section class="sec">
              <div class="sec-head"><span class="sec-ico"><app-icon name="tag" [size]="18" /></span><div><h3>Prix</h3><p>En dirhams (DH)</p></div></div>
              <div class="grid-2">
                <div class="field">
                  <label for="p-price">Prix de vente <span class="req">*</span></label>
                  <div class="affix">
                    <input id="p-price" class="input" [class.is-invalid]="show('price')" type="number" inputmode="decimal" min="0" step="0.01" [value]="d().price" (input)="txt('price', $event)" />
                    <span>DH</span>
                  </div>
                  @if (show('price')) { <span class="field-error">{{ errors().price }}</span> }
                </div>
                <div class="field">
                  <label for="p-cmp">Prix barré (promo)</label>
                  <div class="affix">
                    <input id="p-cmp" class="input" type="number" inputmode="decimal" min="0" step="0.01" [value]="d().compare_at_price" (input)="txt('compare_at_price', $event)" placeholder="Optionnel" />
                    <span>DH</span>
                  </div>
                  @if (discount() > 0) {
                    <span class="promo">-{{ discount() }}% · économie de {{ savings() | money }}</span>
                  } @else if (compareIgnored()) {
                    <span class="hint warn-t">Ignoré : le prix barré doit être supérieur au prix de vente.</span>
                  } @else {
                    <span class="hint">Renseignez un prix plus élevé pour afficher une promotion.</span>
                  }
                </div>
              </div>
            </section>

            <section class="sec">
              <div class="sec-head"><span class="sec-ico"><app-icon name="image" [size]="18" /></span><div><h3>Visuel</h3><p>Photo principale du produit (format carré conseillé)</p></div></div>
              <adm-image-uploader [url]="d().image_url" label="Image du produit" (urlChange)="set('image_url', $event)" (uploading)="uploading.set($event)" />
            </section>

            <section class="sec">
              <div class="sec-head"><span class="sec-ico"><app-icon name="list" [size]="18" /></span><div><h3>Descriptions</h3></div></div>
              <div class="grid-2">
                <div class="field span-2">
                  <label for="p-sd">Description courte (FR)</label>
                  <textarea id="p-sd" class="textarea sm" [class.is-invalid]="show('short')" rows="2" [value]="d().short_description_fr" (input)="txt('short_description_fr', $event)"></textarea>
                  <span class="hint" [class.over]="d().short_description_fr.length > 500">{{ d().short_description_fr.length }}/500</span>
                  @if (show('short')) { <span class="field-error">{{ errors().short }}</span> }
                </div>
                <div class="field span-2">
                  <label for="p-sd-ar">Description courte (AR)</label>
                  <textarea id="p-sd-ar" class="textarea sm" dir="rtl" rows="2" maxlength="500" [value]="d().short_description_ar" (input)="txt('short_description_ar', $event)"></textarea>
                </div>
                <div class="field">
                  <label for="p-fd">Description complète (FR)</label>
                  <textarea id="p-fd" class="textarea" [value]="d().full_description_fr" (input)="txt('full_description_fr', $event)"></textarea>
                </div>
                <div class="field">
                  <label for="p-fd-ar">Description complète (AR)</label>
                  <textarea id="p-fd-ar" class="textarea" dir="rtl" [value]="d().full_description_ar" (input)="txt('full_description_ar', $event)"></textarea>
                </div>
                <div class="field span-2">
                  <label for="p-nf">Valeurs nutritionnelles</label>
                  <textarea id="p-nf" class="textarea sm" rows="3" [value]="d().nutrition_facts" (input)="txt('nutrition_facts', $event)" placeholder="Ex. : Par portion (30 g) : 120 kcal · 24 g de protéines…"></textarea>
                </div>
                <div class="field">
                  <label for="p-us">Conseils d'utilisation (FR)</label>
                  <textarea id="p-us" class="textarea sm" rows="3" [value]="d().usage_fr" (input)="txt('usage_fr', $event)"></textarea>
                </div>
                <div class="field">
                  <label for="p-us-ar">Conseils d'utilisation (AR)</label>
                  <textarea id="p-us-ar" class="textarea sm" dir="rtl" rows="3" [value]="d().usage_ar" (input)="txt('usage_ar', $event)"></textarea>
                </div>
              </div>
            </section>

            <section class="sec">
              <div class="sec-head"><span class="sec-ico"><app-icon name="sliders" [size]="18" /></span><div><h3>Variantes</h3><p>Saveurs, tailles… le client devra en choisir une</p></div></div>
              <div class="grid-2">
                <div class="field">
                  <label for="p-ol">Libellé</label>
                  <input id="p-ol" class="input" maxlength="50" [value]="d().option_label" (input)="txt('option_label', $event)" placeholder="Ex. : Saveur" />
                </div>
                <div class="field">
                  <label for="p-opt">Options</label>
                  <input id="p-opt" class="input" maxlength="60" [value]="optText()" (input)="onOptInput($event)" (keydown)="onOptKey($event)" (blur)="addOptions()" placeholder="Tapez puis Entrée ou virgule" [disabled]="d().options.length >= 40" />
                </div>
              </div>
              @if (d().options.length) {
                <ul class="tags" aria-label="Options ajoutées">
                  @for (o of d().options; track o) {
                    <li class="tag">{{ o }}<button type="button" (click)="removeOption(o)" [attr.aria-label]="'Retirer ' + o"><app-icon name="close" [size]="13" [stroke]="2.6" /></button></li>
                  }
                </ul>
              }
            </section>

            <section class="sec">
              <div class="sec-head"><span class="sec-ico"><app-icon name="truck" [size]="18" /></span><div><h3>Stock & livraison</h3></div></div>
              <div class="rows">
                <div class="row-sw">
                  <div><strong>Suivre le stock</strong><small>Désactivé = stock illimité, jamais en rupture.</small></div>
                  <adm-switch [checked]="d().track_stock" label="Suivre le stock" (toggled)="set('track_stock', $event)" />
                </div>
                @if (d().track_stock) {
                  <div class="field qty">
                    <label for="p-stock">Quantité en stock</label>
                    <input id="p-stock" class="input" [class.is-invalid]="show('stock')" type="number" min="0" step="1" inputmode="numeric" [value]="d().stock_quantity" (input)="txt('stock_quantity', $event)" />
                    @if (show('stock')) { <span class="field-error">{{ errors().stock }}</span> }
                  </div>
                }
                @for (f of flags; track f.key) {
                  <div class="row-sw">
                    <div><strong>{{ f.label }}</strong><small>{{ f.hint }}</small></div>
                    <adm-switch [checked]="d()[f.key]" [label]="f.label" (toggled)="set(f.key, $event)" />
                  </div>
                }
              </div>
            </section>
          </div>

          <aside class="preview" aria-label="Aperçu en boutique">
            <span class="eyebrow">Aperçu en boutique</span>
            <div class="pv" inert aria-hidden="true">
              <app-product-card [product]="preview()" />
            </div>
            @if (!d().is_active) {
              <p class="pv-note"><app-icon name="eye-off" [size]="15" /> Ce produit est masqué : il n'apparaîtra pas en boutique.</p>
            }
          </aside>
        </div>
      }
      @if (open()) {
        <div drawer-footer class="d-foot">
          @if (isEdit()) {
            <button type="button" class="btn btn-ghost danger" (click)="remove()" [disabled]="saving()">
              <app-icon name="trash" [size]="16" /> Supprimer
            </button>
          }
          <span class="grow"></span>
          <button type="button" class="btn btn-ghost" (click)="requestClose()" [disabled]="saving()">Annuler</button>
          <button type="button" class="btn btn-primary" (click)="save()" [disabled]="saving() || uploading()">
            @if (saving()) { <span class="spinner"></span> Enregistrement… } @else { <app-icon name="check" [size]="18" [stroke]="2.6" /> {{ isEdit() ? 'Enregistrer' : 'Créer le produit' }} }
          </button>
        </div>
      }
    </app-drawer>
  `,
})
export class ProductEditorComponent {
  private api = inject(AdminApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  readonly open = input(false);
  readonly product = input<AdminProduct | null>(null);
  readonly categories = input<Category[]>([]);
  readonly saved = output<AdminProduct>();
  readonly deleted = output<number>();
  readonly closed = output<void>();

  protected readonly goals = GOALS;
  protected readonly flags: { key: BoolKey; label: string; hint: string }[] = [
    { key: 'is_active', label: 'Visible en boutique', hint: 'Masqué = invisible pour les clients.' },
    { key: 'is_new', label: 'Nouveauté', hint: 'Affiche le badge « Nouveau ».' },
    { key: 'is_bestseller', label: 'Best-seller', hint: 'Affiche le badge « Best-seller ».' },
    { key: 'free_delivery', label: 'Livraison gratuite', hint: 'Livraison offerte pour ce produit.' },
  ];

  protected readonly d = signal<Draft>(fromProduct(null));
  private readonly initial = signal('');
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly blocked = signal<string | null>(null);
  protected readonly optText = signal('');

  protected readonly isEdit = computed(() => this.product() !== null);
  protected readonly dirty = computed(() => JSON.stringify(this.d()) !== this.initial());

  protected readonly price = computed(() => num(this.d().price));
  protected readonly compare = computed(() => num(this.d().compare_at_price));
  protected readonly discount = computed(() => {
    const p = this.price();
    const c = this.compare();
    return p >= 0 && c > p ? Math.round(((c - p) / c) * 100) : 0;
  });
  protected readonly compareIgnored = computed(() => !Number.isNaN(this.compare()) && this.discount() === 0);
  protected readonly savings = computed(() => this.compare() - this.price());

  protected readonly errors = computed(() => {
    const d = this.d();
    const e: Partial<Record<ErrorKey, string>> = {};
    if (d.name_fr.trim().length < 2) e.name_fr = 'Le nom doit contenir au moins 2 caractères.';
    const p = this.price();
    if (Number.isNaN(p)) e.price = 'Indiquez un prix.';
    else if (p < 0) e.price = 'Le prix ne peut pas être négatif.';
    else if (p > 1_000_000) e.price = 'Prix trop élevé.';
    if (d.category_id === null) e.category_id = 'Choisissez une catégorie.';
    if (d.track_stock) {
      const s = num(d.stock_quantity);
      if (!Number.isInteger(s) || s < 0 || s > 1_000_000) e.stock = 'Entrez un nombre entier positif.';
    }
    if (d.short_description_fr.length > 500) e.short = 'La description courte est limitée à 500 caractères.';
    return e;
  });

  protected readonly preview = computed<Product>(() => {
    const d = this.d();
    const cmp = this.discount() > 0 ? String(this.compare()) : null;
    const qty = num(d.stock_quantity);
    let status: StockStatus = 'in_stock';
    if (d.track_stock && qty <= 0) status = 'out_of_stock';
    else if (d.track_stock && qty <= 5) status = 'low_stock';
    return {
      id: this.product()?.id ?? 0,
      category_id: d.category_id ?? 0,
      name_fr: d.name_fr.trim() || 'Nom du produit',
      name_ar: orNull(d.name_ar),
      slug: 'apercu',
      brand: orNull(d.brand),
      goal: orNull(d.goal),
      short_description_fr: null,
      short_description_ar: null,
      full_description_fr: null,
      full_description_ar: null,
      nutrition_facts: null,
      usage_fr: null,
      usage_ar: null,
      weight_label: orNull(d.weight_label),
      option_label: orNull(d.option_label),
      options: d.options,
      price: Number.isNaN(this.price()) ? '0' : String(this.price()),
      compare_at_price: cmp,
      image_url: d.image_url,
      is_new: d.is_new,
      is_bestseller: d.is_bestseller,
      free_delivery: d.free_delivery,
      stock_status: status,
      created_at: new Date().toISOString(),
    };
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const p = this.product();
      untracked(() => {
        const draft = fromProduct(p);
        this.d.set(draft);
        this.initial.set(JSON.stringify(draft));
        this.submitted.set(false);
        this.blocked.set(null);
        this.optText.set('');
        this.uploading.set(false);
      });
    });
  }

  protected show(k: ErrorKey): boolean {
    return this.submitted() && !!this.errors()[k];
  }

  protected set<K extends keyof Draft>(key: K, value: Draft[K]): void {
    this.d.update((d) => ({ ...d, [key]: value }));
  }

  protected txt(key: TextKey, ev: Event): void {
    this.set(key, inputValue(ev));
  }

  protected setCategory(ev: Event): void {
    const v = inputValue(ev);
    this.set('category_id', v ? Number(v) : null);
  }

  protected onOptInput(ev: Event): void {
    const v = inputValue(ev);
    if (v.includes(',')) {
      this.optText.set(v);
      this.addOptions();
    } else this.optText.set(v);
  }

  protected onOptKey(ev: Event): void {
    const k = (ev as KeyboardEvent).key;
    if (k === 'Enter' || k === ',') {
      ev.preventDefault();
      this.addOptions();
    } else if (k === 'Backspace' && !this.optText() && this.d().options.length) {
      this.set('options', this.d().options.slice(0, -1));
    }
  }

  protected addOptions(): void {
    const parts = this.optText().split(',').map((s) => s.trim().slice(0, 60)).filter(Boolean);
    if (!parts.length) {
      this.optText.set('');
      return;
    }
    const next = [...this.d().options];
    for (const p of parts) {
      if (next.length < 40 && !next.some((o) => o.toLowerCase() === p.toLowerCase())) next.push(p);
    }
    this.set('options', next);
    this.optText.set('');
  }

  protected removeOption(o: string): void {
    this.set('options', this.d().options.filter((x) => x !== o));
  }

  protected async requestClose(): Promise<void> {
    if (this.saving()) return;
    if (this.dirty()) {
      const ok = await this.confirm.ask({
        title: 'Abandonner les modifications ?',
        message: 'Les changements non enregistrés seront perdus.',
        confirmLabel: 'Abandonner',
        cancelLabel: 'Continuer',
        danger: true,
      });
      if (!ok) return;
    }
    this.closed.emit();
  }

  private payload(): ProductInput {
    const d = this.d();
    return {
      category_id: d.category_id ?? undefined,
      name_fr: d.name_fr.trim(),
      name_ar: orNull(d.name_ar),
      brand: orNull(d.brand),
      goal: orNull(d.goal),
      short_description_fr: orNull(d.short_description_fr),
      short_description_ar: orNull(d.short_description_ar),
      full_description_fr: orNull(d.full_description_fr),
      full_description_ar: orNull(d.full_description_ar),
      nutrition_facts: orNull(d.nutrition_facts),
      usage_fr: orNull(d.usage_fr),
      usage_ar: orNull(d.usage_ar),
      weight_label: orNull(d.weight_label),
      option_label: orNull(d.option_label),
      options: d.options,
      price: this.price().toFixed(2),
      compare_at_price: this.discount() > 0 ? this.compare().toFixed(2) : null,
      image_url: d.image_url,
      is_active: d.is_active,
      is_new: d.is_new,
      is_bestseller: d.is_bestseller,
      free_delivery: d.free_delivery,
      stock_quantity: d.track_stock ? Math.trunc(num(d.stock_quantity)) : null,
    };
  }

  protected save(): void {
    this.submitted.set(true);
    if (Object.keys(this.errors()).length) {
      this.toast.error('Corrigez les champs signalés en rouge.');
      return;
    }
    this.saving.set(true);
    const p = this.product();
    const req = p ? this.api.updateProduct(p.id, this.payload()) : this.api.createProduct(this.payload());
    req.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(p ? 'Produit mis à jour' : 'Produit créé 🎉');
        this.saved.emit(res);
        this.closed.emit();
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }

  protected async remove(): Promise<void> {
    const p = this.product();
    if (!p) return;
    const ok = await this.confirm.ask({
      title: `Supprimer « ${p.name_fr} » ?`,
      message: 'Le produit sera définitivement supprimé. Si vous voulez seulement le retirer de la boutique, masquez-le plutôt.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    this.saving.set(true);
    this.api.deleteProduct(p.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Produit supprimé');
        this.deleted.emit(p.id);
        this.closed.emit();
      },
      error: (e) => {
        this.saving.set(false);
        const msg = errorMessage(e);
        this.toast.error(msg);
        if (e?.status === 409) this.blocked.set(`${msg} Vous pouvez le masquer pour le retirer de la boutique.`);
      },
    });
  }

  protected hideInstead(): void {
    const p = this.product();
    if (!p) return;
    this.saving.set(true);
    this.api.quickUpdateProduct(p.id, { is_active: false }).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success('Produit masqué');
        this.saved.emit(res);
        this.closed.emit();
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
