import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AdminApiService, SettingsInput } from '../../../core/services/admin-api.service';
import { SiteSettingsService } from '../../../core/services/site-settings.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon.component';
import { SiteSettings } from '../../../shared/models';
import { formatMoney, inputValue, isEmail, orNull } from '../shared/format';
import { errorMessage } from '../shared/http-error';
import { ImageUploaderComponent } from '../shared/image-uploader.component';

interface Draft {
  site_title: string;
  tagline_fr: string;
  tagline_ar: string;
  logo_url: string | null;
  hero_image_url: string | null;
  contact_phone: string;
  contact_email: string;
  contact_address: string;
  whatsapp_number: string;
  instagram_url: string;
  facebook_url: string;
  announcement_fr: string;
  announcement_ar: string;
  delivery_fee: string;
  free_delivery_threshold: string;
}
type TextKey = { [K in keyof Draft]: Draft[K] extends string ? K : never }[keyof Draft];

const s = (v: string | null): string => v ?? '';
const num = (v: string): number => (v.trim() === '' ? NaN : Number(v.replace(',', '.')));

function fromSettings(x: SiteSettings): Draft {
  return {
    site_title: x.site_title,
    tagline_fr: s(x.tagline_fr),
    tagline_ar: s(x.tagline_ar),
    logo_url: x.logo_url,
    hero_image_url: x.hero_image_url,
    contact_phone: x.contact_phone,
    contact_email: x.contact_email,
    contact_address: s(x.contact_address),
    whatsapp_number: s(x.whatsapp_number),
    instagram_url: s(x.instagram_url),
    facebook_url: s(x.facebook_url),
    announcement_fr: s(x.announcement_fr),
    announcement_ar: s(x.announcement_ar),
    delivery_fee: String(Number(x.delivery_fee)),
    free_delivery_threshold: x.free_delivery_threshold === null ? '' : String(Number(x.free_delivery_threshold)),
  };
}

function badUrl(v: string): boolean {
  if (!v.trim()) return false;
  if (!v.trim().startsWith('https://')) return true;
  try {
    return new URL(v.trim()).protocol !== 'https:';
  } catch {
    return true;
  }
}

@Component({
  selector: 'adm-settings',
  imports: [IconComponent, ImageUploaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['../shared/admin-common.css', './settings.page.css'],
  template: `
    <div class="page wrap">
      @if (loading()) {
        <div class="skeleton sk"></div><div class="skeleton sk"></div><div class="skeleton sk"></div>
      } @else if (loadError(); as e) {
        <div class="banner err" role="alert">
          <app-icon name="alert" [size]="18" />
          <div><p>{{ e }}</p><button type="button" class="btn btn-sm btn-ghost retry" (click)="load()">Réessayer</button></div>
        </div>
      } @else {
        <section class="sec">
          <div class="sec-head"><span class="sec-ico"><app-icon name="sparkle" [size]="18" /></span><div><h3>Identité</h3><p>Le nom et le logo de votre boutique</p></div></div>
          <div class="grid-2">
            <div class="field span-2">
              <label for="s-title">Nom de la boutique <span class="req">*</span></label>
              <input id="s-title" class="input" [class.is-invalid]="show('title')" maxlength="80" [value]="d().site_title" (input)="txt('site_title', $event)" />
              @if (show('title')) { <span class="field-error">{{ errors().title }}</span> }
            </div>
            <div class="field">
              <label for="s-tag-fr">Slogan (FR)</label>
              <input id="s-tag-fr" class="input" maxlength="255" [value]="d().tagline_fr" (input)="txt('tagline_fr', $event)" />
            </div>
            <div class="field">
              <label for="s-tag-ar">Slogan (AR)</label>
              <input id="s-tag-ar" class="input" dir="rtl" maxlength="255" [value]="d().tagline_ar" (input)="txt('tagline_ar', $event)" />
            </div>
            <div class="field span-2">
              <span class="label">Logo</span>
              <adm-image-uploader [url]="d().logo_url" label="Logo de la boutique" [square]="true" (urlChange)="set('logo_url', $event)" (uploading)="uploading.set($event)" />
            </div>
            <div class="field span-2">
              <span class="label">Photo de la bannière d'accueil</span>
              <p class="hint">Une photo d'entraînement ou de produits, idéalement horizontale (1600 × 900 px minimum). Elle s'affiche en grand sur la page d'accueil, sous un voile sombre pour garder le texte lisible.</p>
              <adm-image-uploader [url]="d().hero_image_url" label="Photo de la bannière" (urlChange)="set('hero_image_url', $event)" (uploading)="uploading.set($event)" />
            </div>
          </div>
        </section>

        <section class="sec">
          <div class="sec-head"><span class="sec-ico"><app-icon name="phone" [size]="18" /></span><div><h3>Contact</h3><p>Affiché sur la boutique et dans le pied de page</p></div></div>
          <div class="grid-2">
            <div class="field">
              <label for="s-phone">Téléphone <span class="req">*</span></label>
              <input id="s-phone" class="input" type="tel" inputmode="tel" maxlength="50" [class.is-invalid]="show('phone')" [value]="d().contact_phone" (input)="txt('contact_phone', $event)" placeholder="06 12 34 56 78" />
              @if (show('phone')) { <span class="field-error">{{ errors().phone }}</span> }
            </div>
            <div class="field">
              <label for="s-mail">E-mail <span class="req">*</span></label>
              <input id="s-mail" class="input" type="email" inputmode="email" [class.is-invalid]="show('email')" [value]="d().contact_email" (input)="txt('contact_email', $event)" placeholder="contact@maboutique.ma" />
              @if (show('email')) { <span class="field-error">{{ errors().email }}</span> }
            </div>
            <div class="field span-2">
              <label for="s-addr">Adresse</label>
              <input id="s-addr" class="input" maxlength="255" [value]="d().contact_address" (input)="txt('contact_address', $event)" />
            </div>
            <div class="field">
              <label for="s-wa">Numéro WhatsApp</label>
              <input id="s-wa" class="input" type="tel" inputmode="tel" maxlength="50" [value]="d().whatsapp_number" (input)="txt('whatsapp_number', $event)" placeholder="+212 6 12 34 56 78" />
              <span class="hint">Avec l'indicatif pays pour un lien WhatsApp fiable.</span>
            </div>
            <div class="field"></div>
            <div class="field">
              <label for="s-ig"><app-icon name="instagram" [size]="14" /> Instagram</label>
              <input id="s-ig" class="input" type="url" inputmode="url" [class.is-invalid]="show('ig')" [value]="d().instagram_url" (input)="txt('instagram_url', $event)" placeholder="https://instagram.com/…" />
              @if (show('ig')) { <span class="field-error">{{ errors().ig }}</span> }
            </div>
            <div class="field">
              <label for="s-fb"><app-icon name="facebook" [size]="14" /> Facebook</label>
              <input id="s-fb" class="input" type="url" inputmode="url" [class.is-invalid]="show('fb')" [value]="d().facebook_url" (input)="txt('facebook_url', $event)" placeholder="https://facebook.com/…" />
              @if (show('fb')) { <span class="field-error">{{ errors().fb }}</span> }
            </div>
          </div>
        </section>

        <section class="sec">
          <div class="sec-head"><span class="sec-ico"><app-icon name="bell" [size]="18" /></span><div><h3>Annonce</h3><p>Bandeau affiché tout en haut de la boutique (laissez vide pour le masquer)</p></div></div>
          <div class="grid-2">
            <div class="field">
              <label for="s-an-fr">Texte (FR)</label>
              <input id="s-an-fr" class="input" maxlength="255" [value]="d().announcement_fr" (input)="txt('announcement_fr', $event)" placeholder="Ex. : Livraison offerte dès 500 DH 🚚" />
            </div>
            <div class="field">
              <label for="s-an-ar">Texte (AR)</label>
              <input id="s-an-ar" class="input" dir="rtl" maxlength="255" [value]="d().announcement_ar" (input)="txt('announcement_ar', $event)" />
            </div>
          </div>
          <div class="bar-prev" [class.empty]="!d().announcement_fr.trim()" aria-hidden="true">
            <small>Aperçu</small>
            <span>{{ d().announcement_fr.trim() || 'Aucune annonce affichée' }}</span>
          </div>
        </section>

        <section class="sec">
          <div class="sec-head"><span class="sec-ico"><app-icon name="truck" [size]="18" /></span><div><h3>Livraison</h3><p>Frais appliqués à chaque commande</p></div></div>
          <div class="grid-2">
            <div class="field">
              <label for="s-fee">Frais de livraison <span class="req">*</span></label>
              <div class="affix">
                <input id="s-fee" class="input" type="number" min="0" step="0.01" inputmode="decimal" [class.is-invalid]="show('fee')" [value]="d().delivery_fee" (input)="txt('delivery_fee', $event)" />
                <span>DH</span>
              </div>
              @if (show('fee')) { <span class="field-error">{{ errors().fee }}</span> }
            </div>
            <div class="field">
              <label for="s-thr">Seuil de livraison gratuite</label>
              <div class="affix">
                <input id="s-thr" class="input" type="number" min="0" step="0.01" inputmode="decimal" [class.is-invalid]="show('thr')" [value]="d().free_delivery_threshold" (input)="txt('free_delivery_threshold', $event)" placeholder="Aucun" />
                <span>DH</span>
              </div>
              @if (show('thr')) { <span class="field-error">{{ errors().thr }}</span> }
            </div>
          </div>
          <p class="sentence"><app-icon name="truck" [size]="18" /> {{ deliverySentence() }}</p>
        </section>

        <section class="sec">
          <div class="sec-head"><span class="sec-ico"><app-icon name="cash" [size]="18" /></span><div><h3>Paiement</h3><p>Moyens de paiement proposés aux clients</p></div></div>
          <div class="pay">
            <div class="pay-card on">
              <span class="pay-ico"><app-icon name="cash" [size]="22" /></span>
              <div><strong>Paiement à la livraison</strong><small>Espèces, à la réception de la commande</small></div>
              <span class="badge badge-free"><app-icon name="check" [size]="12" [stroke]="3" /> Activé</span>
            </div>
            <div class="pay-card off" aria-disabled="true">
              <span class="pay-ico"><app-icon name="lock" [size]="22" /></span>
              <div><strong>Paiement par carte</strong><small>Bientôt disponible</small></div>
              <span class="badge badge-soft">Bientôt</span>
            </div>
          </div>
        </section>
      }
    </div>

    @if (dirty()) {
      <div class="savebar" role="region" aria-label="Enregistrer les modifications">
        <span class="sb-txt"><i></i> Modifications non enregistrées</span>
        <button type="button" class="btn btn-sm btn-glass" (click)="reset()" [disabled]="saving()">Annuler</button>
        <button type="button" class="btn btn-sm btn-light" (click)="save()" [disabled]="saving() || uploading()">
          @if (saving()) { <span class="spinner dark"></span> } @else { <app-icon name="check" [size]="16" [stroke]="2.8" /> }
          Enregistrer
        </button>
      </div>
    }
  `,
})
export class SettingsPage {
  private api = inject(AdminApiService);
  private site = inject(SiteSettingsService);
  private toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly submitted = signal(false);
  protected readonly d = signal<Draft>({
    site_title: '',
    tagline_fr: '',
    tagline_ar: '',
    logo_url: null,
    hero_image_url: null,
    contact_phone: '',
    contact_email: '',
    contact_address: '',
    whatsapp_number: '',
    instagram_url: '',
    facebook_url: '',
    announcement_fr: '',
    announcement_ar: '',
    delivery_fee: '0',
    free_delivery_threshold: '',
  });
  private readonly baseline = signal('');

  protected readonly dirty = computed(() => !this.loading() && JSON.stringify(this.d()) !== this.baseline());

  protected readonly errors = computed(() => {
    const d = this.d();
    const e: { title?: string; phone?: string; email?: string; ig?: string; fb?: string; fee?: string; thr?: string } = {};
    if (d.site_title.trim().length < 2) e.title = 'Le nom doit contenir au moins 2 caractères.';
    if (!d.contact_phone.trim()) e.phone = 'Le téléphone est obligatoire.';
    if (!isEmail(d.contact_email)) e.email = 'Adresse e-mail invalide.';
    if (badUrl(d.instagram_url)) e.ig = 'Le lien doit commencer par https://';
    if (badUrl(d.facebook_url)) e.fb = 'Le lien doit commencer par https://';
    const fee = num(d.delivery_fee);
    if (Number.isNaN(fee) || fee < 0 || fee > 100000) e.fee = 'Indiquez un montant valide (0 ou plus).';
    const thr = num(d.free_delivery_threshold);
    if (d.free_delivery_threshold.trim() && (Number.isNaN(thr) || thr < 0 || thr > 100000)) e.thr = 'Indiquez un montant valide ou laissez vide.';
    return e;
  });

  protected readonly deliverySentence = computed(() => {
    const fee = num(this.d().delivery_fee);
    const thr = num(this.d().free_delivery_threshold);
    if (Number.isNaN(fee)) return 'Indiquez les frais de livraison.';
    if (fee === 0) return 'La livraison est offerte pour toutes les commandes.';
    if (!Number.isNaN(thr) && thr > 0) return `Livraison à ${formatMoney(fee)}, offerte dès ${formatMoney(thr)} d'achat.`;
    return `Livraison à ${formatMoney(fee)} pour toutes les commandes (pas de seuil de gratuité).`;
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.settings().subscribe({
      next: (x) => {
        this.apply(x);
        this.loading.set(false);
      },
      error: (e) => {
        this.loadError.set(errorMessage(e, 'Impossible de charger les paramètres.'));
        this.loading.set(false);
      },
    });
  }

  private apply(x: SiteSettings): void {
    const draft = fromSettings(x);
    this.d.set(draft);
    this.baseline.set(JSON.stringify(draft));
    this.submitted.set(false);
  }

  protected reset(): void {
    this.d.set(JSON.parse(this.baseline()) as Draft);
    this.submitted.set(false);
  }

  protected show(k: 'title' | 'phone' | 'email' | 'ig' | 'fb' | 'fee' | 'thr'): boolean {
    return this.submitted() && !!this.errors()[k];
  }

  protected set<K extends keyof Draft>(key: K, value: Draft[K]): void {
    this.d.update((d) => ({ ...d, [key]: value }));
  }

  protected txt(key: TextKey, ev: Event): void {
    this.set(key, inputValue(ev));
  }

  protected save(): void {
    this.submitted.set(true);
    if (Object.keys(this.errors()).length) {
      this.toast.error('Corrigez les champs signalés en rouge.');
      return;
    }
    const d = this.d();
    const thr = num(d.free_delivery_threshold);
    const payload: SettingsInput = {
      site_title: d.site_title.trim(),
      tagline_fr: orNull(d.tagline_fr),
      tagline_ar: orNull(d.tagline_ar),
      logo_url: d.logo_url,
      hero_image_url: d.hero_image_url,
      contact_phone: d.contact_phone.trim(),
      contact_email: d.contact_email.trim(),
      contact_address: orNull(d.contact_address),
      whatsapp_number: orNull(d.whatsapp_number),
      instagram_url: orNull(d.instagram_url),
      facebook_url: orNull(d.facebook_url),
      announcement_fr: orNull(d.announcement_fr),
      announcement_ar: orNull(d.announcement_ar),
      delivery_fee: num(d.delivery_fee).toFixed(2),
      free_delivery_threshold: Number.isNaN(thr) ? null : thr.toFixed(2),
    };
    this.saving.set(true);
    this.api.updateSettings(payload).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.apply(updated);
        this.site.set(updated);
        this.toast.success('Paramètres enregistrés');
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
