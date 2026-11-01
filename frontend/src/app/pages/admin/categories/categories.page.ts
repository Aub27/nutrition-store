import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApiService, CategoryInput } from '../../../core/services/admin-api.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { DrawerComponent } from '../../../shared/components/drawer.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { MediaComponent } from '../../../shared/components/media.component';
import { Category } from '../../../shared/models';
import { SLUG_RE, inputValue, orNull, slugify } from '../shared/format';
import { errorMessage } from '../shared/http-error';
import { ImageUploaderComponent } from '../shared/image-uploader.component';
import { SwitchComponent } from '../shared/switch.component';

interface CatDraft {
  name_fr: string;
  name_ar: string;
  slug: string;
  description_fr: string;
  description_ar: string;
  image_url: string | null;
  is_active: boolean;
}
type CatText = 'name_fr' | 'name_ar' | 'description_fr' | 'description_ar';

const BLANK: CatDraft = { name_fr: '', name_ar: '', slug: '', description_fr: '', description_ar: '', image_url: null, is_active: true };

@Component({
  selector: 'adm-categories',
  imports: [RouterLink, DrawerComponent, IconComponent, MediaComponent, SwitchComponent, ImageUploaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['../shared/admin-common.css', './categories.page.css'],
  template: `
    <div class="page narrow">
      <div class="toolbar">
        <div>
          <p class="muted lead">Organisez votre catalogue. Glissez-déposez les cartes ou utilisez les flèches pour changer l'ordre d'affichage en boutique.</p>
        </div>
        <span class="grow"></span>
        <button type="button" class="btn btn-primary" (click)="openCreate()">
          <app-icon name="plus" [size]="18" [stroke]="2.6" /> Nouvelle catégorie
        </button>
      </div>

      @if (error(); as e) {
        <div class="banner err" role="alert">
          <app-icon name="alert" [size]="18" />
          <div><p>{{ e }}</p><button type="button" class="btn btn-sm btn-ghost retry" (click)="load()">Réessayer</button></div>
        </div>
      }

      @if (loading()) {
        <div class="list">
          @for (i of [1, 2, 3, 4]; track i) { <div class="skeleton sk"></div> }
        </div>
      } @else if (items().length === 0 && !error()) {
        <div class="empty-state card">
          <span class="orb"><app-icon name="grid" [size]="38" /></span>
          <h3>Créez votre première catégorie</h3>
          <p class="muted">Les catégories (ex. « Protéines », « Vitamines », « Barres ») structurent votre boutique. Elles sont nécessaires avant d'ajouter des produits.</p>
          <button type="button" class="btn btn-primary btn-lg" (click)="openCreate()"><app-icon name="plus" [size]="18" [stroke]="2.6" /> Ajouter une catégorie</button>
        </div>
      } @else {
        <ul class="list" role="list" aria-label="Catégories">
          @for (c of items(); track c.id; let i = $index; let first = $first; let last = $last) {
            <li
              class="ccard"
              [class.is-dragging]="dragId() === c.id"
              [class.drop-before]="overId() === c.id && dragId() !== c.id && dropBefore()"
              [class.drop-after]="overId() === c.id && dragId() !== c.id && !dropBefore()"
              [class.is-off]="!c.is_active"
              [style.animation-delay.ms]="i * 40"
              draggable="true"
              (dragstart)="onDragStart(c, $event)"
              (dragover)="onDragOver(c, $event)"
              (drop)="onDrop(c, $event)"
              (dragend)="resetDrag()"
            >
              <span class="handle" aria-hidden="true" title="Glisser pour réordonner"><app-icon name="drag" [size]="20" [stroke]="2.6" /></span>
              <span class="rank">{{ i + 1 }}</span>
              <span class="thumb"><app-media [url]="c.image_url" [alt]="c.name_fr" [iconSize]="26" [seed]="c.id" /></span>
              <div class="info">
                <strong class="nm">{{ c.name_fr }}</strong>
                <span class="meta">
                  <code>/{{ c.slug }}</code>
                  <span class="count"><app-icon name="package" [size]="13" /> {{ c.product_count ?? 0 }} produit{{ (c.product_count ?? 0) > 1 ? 's' : '' }}</span>
                  @if (!c.is_active) { <span class="badge badge-soft">Masquée</span> }
                </span>
              </div>
              <div class="acts">
                <button type="button" class="icon-btn" (click)="move(c.id, -1)" [disabled]="first || saving()" [attr.aria-label]="'Monter ' + c.name_fr"><app-icon name="arrow-up" [size]="18" /></button>
                <button type="button" class="icon-btn" (click)="move(c.id, 1)" [disabled]="last || saving()" [attr.aria-label]="'Descendre ' + c.name_fr"><app-icon name="arrow-down" [size]="18" /></button>
                <adm-switch [checked]="c.is_active" [label]="c.is_active ? 'Masquer ' + c.name_fr : 'Afficher ' + c.name_fr" (toggled)="toggleActive(c, $event)" />
                <button type="button" class="icon-btn" (click)="openEdit(c)" [attr.aria-label]="'Modifier ' + c.name_fr"><app-icon name="edit" [size]="18" /></button>
                <button type="button" class="icon-btn danger" (click)="remove(c)" [attr.aria-label]="'Supprimer ' + c.name_fr"><app-icon name="trash" [size]="18" /></button>
              </div>
            </li>
          }
        </ul>
        <p class="tip"><app-icon name="sparkle" [size]="15" /> Pensez à <a routerLink="/admin/products" class="lnk">ajouter des produits</a> dans vos catégories.</p>
      }
    </div>

    <app-drawer [open]="editorOpen()" [label]="editingId() ? 'Modifier la catégorie' : 'Nouvelle catégorie'" width="520px" (closed)="requestClose()">
      @if (editorOpen()) {
        <div drawer-title class="d-title">
          <h3>{{ editingId() ? 'Modifier la catégorie' : 'Nouvelle catégorie' }}</h3>
        </div>
      }
      @if (editorOpen()) {
        <div class="form">
          <div class="field">
            <label for="c-name">Nom (français) <span class="req">*</span></label>
            <input id="c-name" class="input" [class.is-invalid]="show('name')" maxlength="255" [value]="d().name_fr" (input)="onName($event)" placeholder="Ex. : Protéines" />
            @if (show('name')) { <span class="field-error">{{ errors().name }}</span> }
          </div>
          <div class="field">
            <label for="c-name-ar">Nom (arabe)</label>
            <input id="c-name-ar" class="input" dir="rtl" maxlength="255" [value]="d().name_ar" (input)="txt('name_ar', $event)" />
          </div>
          <div class="field">
            <label for="c-slug">Identifiant d'URL (slug)</label>
            <input id="c-slug" class="input" [class.is-invalid]="show('slug')" maxlength="120" [value]="d().slug" (input)="onSlug($event)" placeholder="proteines" />
            @if (show('slug')) { <span class="field-error">{{ errors().slug }}</span> }
            @else { <span class="hint">{{ slugTouched() ? 'Lettres minuscules, chiffres et tirets.' : 'Généré automatiquement depuis le nom.' }}</span> }
          </div>
          <div class="field">
            <label for="c-desc">Description (FR)</label>
            <textarea id="c-desc" class="textarea" rows="3" [value]="d().description_fr" (input)="txt('description_fr', $event)"></textarea>
          </div>
          <div class="field">
            <label for="c-desc-ar">Description (AR)</label>
            <textarea id="c-desc-ar" class="textarea" dir="rtl" rows="3" [value]="d().description_ar" (input)="txt('description_ar', $event)"></textarea>
          </div>
          <div class="field">
            <span class="label">Image</span>
            <adm-image-uploader [url]="d().image_url" label="Image de la catégorie" (urlChange)="set('image_url', $event)" (uploading)="uploading.set($event)" />
          </div>
          <div class="row-sw">
            <div><strong>Visible en boutique</strong><small>Une catégorie masquée n'est pas affichée aux clients.</small></div>
            <adm-switch [checked]="d().is_active" label="Visible en boutique" (toggled)="set('is_active', $event)" />
          </div>
        </div>
      }
      @if (editorOpen()) {
        <div drawer-footer class="d-foot">
          <button type="button" class="btn btn-ghost" (click)="requestClose()" [disabled]="busy()">Annuler</button>
          <button type="button" class="btn btn-primary" (click)="save()" [disabled]="busy() || uploading()">
            @if (busy()) { <span class="spinner"></span> Enregistrement… } @else { <app-icon name="check" [size]="18" [stroke]="2.6" /> {{ editingId() ? 'Enregistrer' : 'Créer' }} }
          </button>
        </div>
      }
    </app-drawer>
  `,
})
export class CategoriesPage {
  private api = inject(AdminApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  protected readonly items = signal<Category[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly dragId = signal<number | null>(null);
  protected readonly overId = signal<number | null>(null);
  protected readonly dropBefore = signal(false);

  protected readonly editorOpen = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly d = signal<CatDraft>({ ...BLANK });
  protected readonly slugTouched = signal(false);
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly uploading = signal(false);
  private initial = '';

  protected readonly errors = computed(() => {
    const d = this.d();
    const e: { name?: string; slug?: string } = {};
    if (d.name_fr.trim().length < 2) e.name = 'Le nom doit contenir au moins 2 caractères.';
    if (!d.slug) e.slug = "Impossible de générer l'identifiant : saisissez-le manuellement.";
    else if (!SLUG_RE.test(d.slug)) e.slug = 'Utilisez uniquement des minuscules, chiffres et tirets (ex. whey-protein).';
    return e;
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.categories().subscribe({
      next: (list) => {
        this.items.set([...list].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id));
        this.error.set(null);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e, 'Impossible de charger les catégories.'));
        this.loading.set(false);
      },
    });
  }

  /* ── reorder ── */
  protected onDragStart(c: Category, ev: DragEvent): void {
    if (this.saving()) {
      ev.preventDefault();
      return;
    }
    this.dragId.set(c.id);
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', String(c.id));
    }
  }

  protected onDragOver(c: Category, ev: DragEvent): void {
    const from = this.dragId();
    if (from === null) return;
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
    const list = this.items();
    this.overId.set(c.id);
    this.dropBefore.set(list.findIndex((x) => x.id === from) > list.findIndex((x) => x.id === c.id));
  }

  protected onDrop(c: Category, ev: DragEvent): void {
    ev.preventDefault();
    const from = this.dragId();
    this.resetDrag();
    if (from === null || from === c.id) return;
    const list = [...this.items()];
    const fromIdx = list.findIndex((x) => x.id === from);
    const toIdx = list.findIndex((x) => x.id === c.id);
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    this.persistOrder(list);
  }

  protected resetDrag(): void {
    this.dragId.set(null);
    this.overId.set(null);
  }

  protected move(id: number, dir: -1 | 1): void {
    const list = [...this.items()];
    const i = list.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    this.persistOrder(list);
  }

  private persistOrder(next: Category[]): void {
    const previous = this.items();
    this.items.set(next);
    this.saving.set(true);
    this.api.reorderCategories(next.map((c) => c.id)).subscribe({
      next: () => this.saving.set(false),
      error: (e) => {
        this.items.set(previous);
        this.saving.set(false);
        this.toast.error(`Ordre non enregistré. ${errorMessage(e)}`);
      },
    });
  }

  protected toggleActive(c: Category, value: boolean): void {
    this.patch(c.id, { is_active: value });
    this.api.updateCategory(c.id, { is_active: value }).subscribe({
      next: () => this.toast.success(value ? 'Catégorie visible' : 'Catégorie masquée'),
      error: (e) => {
        this.patch(c.id, { is_active: !value });
        this.toast.error(errorMessage(e));
      },
    });
  }

  private patch(id: number, p: Partial<Category>): void {
    this.items.update((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }

  /* ── delete ── */
  protected async remove(c: Category): Promise<void> {
    const n = c.product_count ?? 0;
    if (n > 0) {
      this.toast.error(`« ${c.name_fr} » contient ${n} produit${n > 1 ? 's' : ''}. Déplacez-les ou supprimez-les avant de supprimer la catégorie.`);
      return;
    }
    const ok = await this.confirm.ask({
      title: `Supprimer « ${c.name_fr} » ?`,
      message: 'Cette catégorie sera définitivement supprimée.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    this.api.deleteCategory(c.id).subscribe({
      next: () => {
        this.items.update((l) => l.filter((x) => x.id !== c.id));
        this.toast.success('Catégorie supprimée');
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  /* ── editor ── */
  protected openCreate(): void {
    this.editingId.set(null);
    this.start({ ...BLANK }, false);
  }

  protected openEdit(c: Category): void {
    this.editingId.set(c.id);
    this.start(
      {
        name_fr: c.name_fr,
        name_ar: c.name_ar ?? '',
        slug: c.slug,
        description_fr: c.description_fr ?? '',
        description_ar: c.description_ar ?? '',
        image_url: c.image_url,
        is_active: c.is_active,
      },
      true,
    );
  }

  private start(draft: CatDraft, touched: boolean): void {
    this.d.set(draft);
    this.initial = JSON.stringify(draft);
    this.slugTouched.set(touched);
    this.submitted.set(false);
    this.uploading.set(false);
    this.editorOpen.set(true);
  }

  protected async requestClose(): Promise<void> {
    if (this.busy()) return;
    if (JSON.stringify(this.d()) !== this.initial) {
      const ok = await this.confirm.ask({
        title: 'Abandonner les modifications ?',
        message: 'Les changements non enregistrés seront perdus.',
        confirmLabel: 'Abandonner',
        cancelLabel: 'Continuer',
        danger: true,
      });
      if (!ok) return;
    }
    this.editorOpen.set(false);
  }

  protected show(k: 'name' | 'slug'): boolean {
    return this.submitted() && !!this.errors()[k];
  }

  protected set<K extends keyof CatDraft>(key: K, value: CatDraft[K]): void {
    this.d.update((d) => ({ ...d, [key]: value }));
  }

  protected txt(key: CatText, ev: Event): void {
    this.set(key, inputValue(ev));
  }

  protected onName(ev: Event): void {
    const name = inputValue(ev);
    this.d.update((d) => ({ ...d, name_fr: name, slug: this.slugTouched() ? d.slug : slugify(name) }));
  }

  protected onSlug(ev: Event): void {
    this.slugTouched.set(true);
    this.set('slug', inputValue(ev).toLowerCase().replace(/\s+/g, '-'));
  }

  protected save(): void {
    this.submitted.set(true);
    if (Object.keys(this.errors()).length) {
      this.toast.error('Corrigez les champs signalés en rouge.');
      return;
    }
    const d = this.d();
    const id = this.editingId();
    const payload: CategoryInput = {
      name_fr: d.name_fr.trim(),
      name_ar: orNull(d.name_ar),
      slug: d.slug,
      description_fr: orNull(d.description_fr),
      description_ar: orNull(d.description_ar),
      image_url: d.image_url,
      is_active: d.is_active,
    };
    if (id === null) payload.sort_order = this.items().length;
    this.busy.set(true);
    const req = id === null ? this.api.createCategory(payload) : this.api.updateCategory(id, payload);
    req.subscribe({
      next: (res) => {
        this.busy.set(false);
        this.items.update((l) => (id === null ? [...l, { ...res, product_count: res.product_count ?? 0 }] : l.map((x) => (x.id === res.id ? res : x))));
        this.toast.success(id === null ? 'Catégorie créée 🎉' : 'Catégorie mise à jour');
        this.editorOpen.set(false);
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
