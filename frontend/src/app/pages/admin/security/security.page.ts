import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { AdminAuthService } from '../../../core/services/admin-auth.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon.component';
import { AuditLog } from '../../../shared/models';
import { dayKey, formatLongDay, formatTime, inputValue, parseDate, relativeTime } from '../shared/format';
import { errorMessage } from '../shared/http-error';
import { STATUS_META } from '../shared/status';

interface ActionMeta {
  label: string;
  icon: string;
  tone: 'ok' | 'bad' | 'info' | 'warn';
  security?: boolean;
}

const ACTIONS: Record<string, ActionMeta> = {
  login: { label: 'Connexion', icon: 'user', tone: 'ok', security: true },
  login_failed: { label: 'Échec de connexion', icon: 'alert', tone: 'bad', security: true },
  logout_all: { label: 'Déconnexion de tous les appareils', icon: 'logout', tone: 'warn', security: true },
  password_changed: { label: 'Mot de passe modifié', icon: 'lock', tone: 'warn', security: true },
  product_created: { label: 'Produit créé', icon: 'plus', tone: 'ok' },
  product_updated: { label: 'Produit modifié', icon: 'edit', tone: 'info' },
  product_quick_update: { label: 'Produit ajusté (stock ou visibilité)', icon: 'sliders', tone: 'info' },
  product_deleted: { label: 'Produit supprimé', icon: 'trash', tone: 'bad' },
  category_created: { label: 'Catégorie créée', icon: 'plus', tone: 'ok' },
  category_updated: { label: 'Catégorie modifiée', icon: 'edit', tone: 'info' },
  category_deleted: { label: 'Catégorie supprimée', icon: 'trash', tone: 'bad' },
  categories_reordered: { label: 'Catégories réordonnées', icon: 'list', tone: 'info' },
  order_status: { label: 'Statut de commande modifié', icon: 'truck', tone: 'info' },
  order_note: { label: 'Note de commande modifiée', icon: 'edit', tone: 'info' },
  order_anonymized: { label: 'Commande anonymisée', icon: 'shield', tone: 'bad', security: true },
  message_deleted: { label: 'Message supprimé', icon: 'trash', tone: 'bad' },
  settings_updated: { label: 'Paramètres mis à jour', icon: 'sliders', tone: 'info' },
  image_uploaded: { label: 'Image envoyée', icon: 'image', tone: 'info' },
};

const ENTITIES: Record<string, string> = {
  product: 'Produit',
  category: 'Catégorie',
  order: 'Commande',
  upload: 'Fichier',
  settings: 'Paramètres',
  message: 'Message',
};

function humanize(action: string): string {
  const t = action.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function humanDetail(log: AuditLog): string {
  if (!log.detail || log.action === 'image_uploaded') return '';
  return log.detail.replace(/\b(NEW|CONFIRMED|WAITING_DELIVERY|DELIVERED|CANCELLED)\b/g, (m) => STATUS_META[m as keyof typeof STATUS_META].label);
}

@Component({
  selector: 'adm-security',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['../shared/admin-common.css', './security.page.css'],
  template: `
    <div class="page">
      <div class="cols">
        <div class="left">
          <section class="sec">
            <div class="sec-head"><span class="sec-ico"><app-icon name="lock" [size]="18" /></span><div><h3>Changer le mot de passe</h3><p>Vous serez déconnecté après le changement.</p></div></div>
            <form (submit)="submit($event)" novalidate class="form">
              <div class="field">
                <label for="pw-cur">Mot de passe actuel</label>
                <div class="pw">
                  <input id="pw-cur" class="input" [type]="show() ? 'text' : 'password'" autocomplete="current-password" [value]="current()" (input)="current.set(val($event))" />
                </div>
              </div>
              <div class="field">
                <label for="pw-new">Nouveau mot de passe</label>
                <div class="pw">
                  <input id="pw-new" class="input" [type]="show() ? 'text' : 'password'" autocomplete="new-password" [value]="next()" (input)="next.set(val($event))" />
                  <button type="button" class="eye" (click)="show.set(!show())" [attr.aria-label]="show() ? 'Masquer les mots de passe' : 'Afficher les mots de passe'" [attr.aria-pressed]="show()">
                    <app-icon [name]="show() ? 'eye-off' : 'eye'" [size]="18" />
                  </button>
                </div>
                <div class="meter" [attr.data-level]="level()" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
                <ul class="rules" aria-label="Exigences du mot de passe">
                  <li [class.ok]="rules().length"><app-icon [name]="rules().length ? 'check' : 'minus'" [size]="14" [stroke]="3" /> Au moins 12 caractères <small>({{ next().length }})</small></li>
                  <li [class.ok]="rules().classes >= 3"><app-icon [name]="rules().classes >= 3 ? 'check' : 'minus'" [size]="14" [stroke]="3" /> 3 types sur 4 : minuscules, majuscules, chiffres, symboles <small>({{ rules().classes }}/4)</small></li>
                  <li [class.ok]="rules().bytes"><app-icon [name]="rules().bytes ? 'check' : 'minus'" [size]="14" [stroke]="3" /> 72 octets maximum</li>
                </ul>
              </div>
              <div class="field">
                <label for="pw-conf">Confirmer le nouveau mot de passe</label>
                <input id="pw-conf" class="input" [class.is-invalid]="confirm().length > 0 && !rules().match" [type]="show() ? 'text' : 'password'" autocomplete="new-password" [value]="confirm()" (input)="confirm.set(val($event))" />
                @if (confirm().length > 0 && !rules().match) { <span class="field-error">Les mots de passe ne correspondent pas.</span> }
              </div>
              @if (error(); as e) {
                <div class="banner err" role="alert"><app-icon name="alert" [size]="18" /><span>{{ e }}</span></div>
              }
              <button type="submit" class="btn btn-primary" [disabled]="!valid() || saving()">
                @if (saving()) { <span class="spinner"></span> } @else { <app-icon name="shield" [size]="18" /> }
                Mettre à jour le mot de passe
              </button>
            </form>
          </section>

          <section class="sec danger-zone">
            <div class="sec-head"><span class="sec-ico red"><app-icon name="logout" [size]="18" /></span><div><h3>Appareils connectés</h3><p>Fermez toutes les sessions ouvertes, y compris celle-ci.</p></div></div>
            <p class="muted small">Utile si vous avez utilisé un ordinateur partagé ou suspectez un accès non autorisé.</p>
            <button type="button" class="btn btn-ghost out" (click)="logoutAll()" [disabled]="leaving()">
              <app-icon name="logout" [size]="18" /> Déconnecter tous les appareils
            </button>
          </section>
        </div>

        <section class="sec audit">
          <div class="sec-head">
            <span class="sec-ico"><app-icon name="clock" [size]="18" /></span>
            <div><h3>Journal d'activité</h3><p>Les 100 dernières actions de l'administration</p></div>
            <span class="grow"></span>
            <div class="chips">
              <button type="button" class="chip" [class.is-active]="!onlySecurity()" (click)="onlySecurity.set(false)">Tout</button>
              <button type="button" class="chip" [class.is-active]="onlySecurity()" (click)="onlySecurity.set(true)">Sécurité</button>
            </div>
          </div>

          @if (loading()) {
            @for (i of [1, 2, 3, 4, 5]; track i) { <div class="skeleton sk"></div> }
          } @else if (logError(); as e) {
            <div class="banner err" role="alert"><app-icon name="alert" [size]="18" /><span>{{ e }}</span></div>
          } @else if (groups().length === 0) {
            <div class="empty"><app-icon name="clock" [size]="28" /><p>Aucune activité à afficher.</p></div>
          } @else {
            <div class="feed">
              @for (g of groups(); track g.key) {
                <h4 class="day">{{ g.label }}</h4>
                <ol class="tl">
                  @for (e of g.items; track e.id) {
                    <li class="ev" [attr.data-tone]="e.meta.tone">
                      <span class="ev-ico"><app-icon [name]="e.meta.icon" [size]="15" [stroke]="2.3" /></span>
                      <div class="ev-main">
                        <div class="ev-top"><strong>{{ e.meta.label }}</strong><time [attr.title]="e.full">{{ e.time }}</time></div>
                        @if (e.detail) { <p class="ev-detail">{{ e.detail }}</p> }
                        <p class="ev-meta">
                          @if (e.who) { <span><app-icon name="user" [size]="12" /> {{ e.who }}</span> }
                          @if (e.log.ip_address) { <span><app-icon name="globe" [size]="12" /> {{ e.log.ip_address }}</span> }
                          @if (e.entity) { <span class="ent">{{ e.entity }}</span> }
                        </p>
                      </div>
                    </li>
                  }
                </ol>
              }
            </div>
          }
        </section>
      </div>
    </div>
  `,
})
export class SecurityPage {
  private api = inject(AdminApiService);
  private auth = inject(AdminAuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private confirmDlg = inject(ConfirmService);

  protected readonly current = signal('');
  protected readonly next = signal('');
  protected readonly confirm = signal('');
  protected readonly show = signal(false);
  protected readonly saving = signal(false);
  protected readonly leaving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly logs = signal<AuditLog[]>([]);
  protected readonly loading = signal(true);
  protected readonly logError = signal<string | null>(null);
  protected readonly onlySecurity = signal(false);

  protected readonly rules = computed(() => {
    const p = this.next();
    const classes = [/[a-z]/.test(p), /[A-Z]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length;
    return {
      length: p.length >= 12,
      classes,
      bytes: p.length > 0 && new TextEncoder().encode(p).length <= 72,
      match: p.length > 0 && p === this.confirm(),
    };
  });
  protected readonly valid = computed(() => {
    const r = this.rules();
    return !!this.current() && r.length && r.classes >= 3 && r.bytes && r.match && this.next() !== this.current();
  });
  protected readonly level = computed(() => {
    const r = this.rules();
    if (!this.next()) return 0;
    return Math.min(4, (r.length ? 1 : 0) + (r.classes >= 3 ? 1 : 0) + (r.classes === 4 ? 1 : 0) + (this.next().length >= 16 ? 1 : 0));
  });

  protected readonly groups = computed(() => {
    const entries = this.logs()
      .filter((l) => !this.onlySecurity() || ACTIONS[l.action]?.security)
      .map((log) => ({
        id: log.id,
        log,
        meta: ACTIONS[log.action] ?? { label: humanize(log.action), icon: 'sparkle', tone: 'info' as const },
        detail: humanDetail(log),
        who: log.admin_email,
        entity: log.entity_type ? `${ENTITIES[log.entity_type] ?? log.entity_type}${log.entity_id ? ' #' + log.entity_id : ''}` : '',
        time: formatTime(log.created_at),
        full: `${relativeTime(log.created_at)}`,
      }));
    const map = new Map<string, { key: string; label: string; items: typeof entries }>();
    for (const e of entries) {
      const key = dayKey(e.log.created_at);
      if (!map.has(key)) map.set(key, { key, label: formatLongDay(parseDate(e.log.created_at)), items: [] });
      map.get(key)!.items.push(e);
    }
    return [...map.values()];
  });

  constructor() {
    this.api.auditLogs(100).subscribe({
      next: (l) => {
        this.logs.set(l);
        this.loading.set(false);
      },
      error: (e) => {
        this.logError.set(errorMessage(e, "Impossible de charger le journal d'activité."));
        this.loading.set(false);
      },
    });
  }

  protected val(ev: Event): string {
    return inputValue(ev);
  }

  protected submit(ev: Event): void {
    ev.preventDefault();
    if (!this.valid() || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.auth.changePassword(this.current(), this.next()).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Mot de passe modifié. Reconnectez-vous avec le nouveau.');
        this.router.navigate(['/admin/login']);
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(errorMessage(e, 'Impossible de modifier le mot de passe.'));
      },
    });
  }

  protected async logoutAll(): Promise<void> {
    const ok = await this.confirmDlg.ask({
      title: 'Déconnecter tous les appareils ?',
      message: 'Toutes les sessions ouvertes, y compris celle-ci, seront fermées. Vous devrez vous reconnecter.',
      confirmLabel: 'Tout déconnecter',
      danger: true,
    });
    if (!ok) return;
    this.leaving.set(true);
    this.auth.logoutEverywhere().subscribe({
      next: () => {
        this.leaving.set(false);
        this.toast.success('Tous les appareils ont été déconnectés.');
        this.router.navigate(['/admin/login']);
      },
      error: (e) => {
        this.leaving.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
