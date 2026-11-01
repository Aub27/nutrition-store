import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon.component';
import { ContactMessage } from '../../../shared/models';
import { AdminBadgesService } from '../shared/admin-badges.service';
import { formatDateTime, mailHref, relativeTime, telHref, whatsappHref } from '../shared/format';
import { errorMessage } from '../shared/http-error';

@Component({
  selector: 'adm-messages',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['../shared/admin-common.css', './messages.page.css'],
  template: `
    <div class="page">
      <div class="toolbar">
        <div class="chips" role="group" aria-label="Filtrer les messages">
          <button type="button" class="chip" [class.is-active]="filter() === 'all'" [attr.aria-pressed]="filter() === 'all'" (click)="filter.set('all')">
            Tous <span class="n">{{ items().length }}</span>
          </button>
          <button type="button" class="chip" [class.is-active]="filter() === 'unread'" [attr.aria-pressed]="filter() === 'unread'" (click)="filter.set('unread')">
            Non lus <span class="n">{{ unreadCount() }}</span>
          </button>
        </div>
        <span class="grow"></span>
        <button type="button" class="btn btn-ghost btn-sm" (click)="load()"><app-icon name="clock" [size]="16" /> Actualiser</button>
      </div>

      @if (error(); as e) {
        <div class="banner err" role="alert"><app-icon name="alert" [size]="18" /> <span>{{ e }}</span></div>
      }

      @if (loading()) {
        <div class="panes">
          <div class="list-pane card">
            @for (i of [1, 2, 3, 4, 5]; track i) { <div class="skeleton sk"></div> }
          </div>
          <div class="read-pane card d-only"><div class="skeleton sk-big"></div></div>
        </div>
      } @else if (items().length === 0 && !error()) {
        <div class="empty-state card">
          <span class="orb"><app-icon name="inbox" [size]="38" /></span>
          <h3>Boîte de réception vide</h3>
          <p class="muted">Les messages envoyés via le formulaire de contact de votre boutique apparaîtront ici.</p>
        </div>
      } @else {
        <div class="panes" [class.reading]="!!selected()">
          <div class="list-pane card">
            @for (m of visible(); track m.id) {
              <button type="button" class="msg" [class.unread]="!m.is_read" [class.active]="selectedId() === m.id" (click)="select(m)">
                <span class="av" aria-hidden="true">{{ initial(m) }}</span>
                <span class="m-main">
                  <span class="m-top"><strong>{{ m.name }}</strong><time>{{ ago(m.created_at) }}</time></span>
                  <span class="m-sub">{{ m.subject || 'Sans objet' }}</span>
                  <span class="m-prev">{{ m.message }}</span>
                </span>
                @if (!m.is_read) { <span class="dot" aria-label="Non lu"></span> }
              </button>
            } @empty {
              <div class="none"><app-icon name="check" [size]="26" /><p>Aucun message non lu 🎉</p></div>
            }
          </div>

          <div class="read-pane card" [class.d-only]="!selected()">
            @if (selected(); as m) {
              <header class="r-head">
                <button type="button" class="icon-btn back" (click)="selectedId.set(null)" aria-label="Retour à la liste"><app-icon name="arrow-left" [size]="20" /></button>
                <span class="av lg" aria-hidden="true">{{ initial(m) }}</span>
                <div class="r-who">
                  <h3>{{ m.name }}</h3>
                  <small>{{ dt(m.created_at) }} · {{ ago(m.created_at) }}</small>
                </div>
                <span class="grow"></span>
                <button type="button" class="icon-btn" (click)="toggleRead(m)" [attr.aria-label]="m.is_read ? 'Marquer comme non lu' : 'Marquer comme lu'" [attr.title]="m.is_read ? 'Marquer comme non lu' : 'Marquer comme lu'">
                  <app-icon [name]="m.is_read ? 'inbox' : 'check'" [size]="19" />
                </button>
                <button type="button" class="icon-btn danger" (click)="remove(m)" aria-label="Supprimer le message"><app-icon name="trash" [size]="19" /></button>
              </header>

              <div class="r-body">
                <h4>{{ m.subject || 'Sans objet' }}</h4>
                <p class="text">{{ m.message }}</p>
              </div>

              <footer class="r-foot">
                <span class="eyebrow">Répondre</span>
                <div class="reply">
                  @if (mail(m); as h) {
                    <a class="btn btn-primary btn-sm" [href]="h"><app-icon name="mail" [size]="16" /> E-mail</a>
                  }
                  @if (tel(m); as t) {
                    <a class="btn btn-ghost btn-sm" [href]="t"><app-icon name="phone" [size]="16" /> {{ m.phone }}</a>
                  }
                  @if (wa(m); as w) {
                    <a class="btn btn-ghost btn-sm wa" [href]="w" target="_blank" rel="noopener"><app-icon name="whatsapp" [size]="16" /> WhatsApp</a>
                  }
                  @if (!mail(m) && !tel(m)) {
                    <span class="muted">Aucun moyen de contact fourni.</span>
                  }
                </div>
                @if (m.email) { <small class="muted">{{ m.email }}</small> }
              </footer>
            } @else {
              <div class="pick">
                <span class="orb"><app-icon name="chat" [size]="34" /></span>
                <strong>Sélectionnez un message</strong>
                <p class="muted">Son contenu s'affichera ici.</p>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class MessagesPage {
  private api = inject(AdminApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private badges = inject(AdminBadgesService);

  protected readonly items = signal<ContactMessage[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly filter = signal<'all' | 'unread'>('all');
  protected readonly selectedId = signal<number | null>(null);

  protected readonly unreadCount = computed(() => this.items().filter((m) => !m.is_read).length);
  protected readonly visible = computed(() => {
    const list = [...this.items()].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return this.filter() === 'unread' ? list.filter((m) => !m.is_read) : list;
  });
  protected readonly selected = computed(() => this.items().find((m) => m.id === this.selectedId()) ?? null);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.api.messages().subscribe({
      next: (list) => {
        this.items.set(list);
        this.error.set(null);
        this.loading.set(false);
        this.badges.refresh();
      },
      error: (e) => {
        this.error.set(errorMessage(e, 'Impossible de charger les messages.'));
        this.loading.set(false);
      },
    });
  }

  protected initial(m: ContactMessage): string {
    return m.name.trim().charAt(0).toUpperCase() || '?';
  }
  protected ago(iso: string): string {
    return relativeTime(iso);
  }
  protected dt(iso: string): string {
    return formatDateTime(iso);
  }
  protected mail(m: ContactMessage): string | null {
    return mailHref(m.email, m.subject ? `Re: ${m.subject}` : 'Votre message');
  }
  protected tel(m: ContactMessage): string | null {
    return telHref(m.phone);
  }
  protected wa(m: ContactMessage): string | null {
    return whatsappHref(m.phone);
  }

  protected select(m: ContactMessage): void {
    this.selectedId.set(m.id);
    if (!m.is_read) this.setRead(m, true, false);
  }

  protected toggleRead(m: ContactMessage): void {
    this.setRead(m, !m.is_read, true);
  }

  private setRead(m: ContactMessage, value: boolean, announce: boolean): void {
    this.patch(m.id, { is_read: value });
    this.api.markMessage(m.id, value).subscribe({
      next: () => {
        this.badges.refresh();
        if (announce) this.toast.success(value ? 'Marqué comme lu' : 'Marqué comme non lu');
      },
      error: (e) => {
        this.patch(m.id, { is_read: !value });
        this.toast.error(errorMessage(e));
      },
    });
  }

  private patch(id: number, p: Partial<ContactMessage>): void {
    this.items.update((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }

  protected async remove(m: ContactMessage): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Supprimer ce message ?',
      message: `Le message de ${m.name} sera définitivement supprimé.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    this.api.deleteMessage(m.id).subscribe({
      next: () => {
        this.items.update((l) => l.filter((x) => x.id !== m.id));
        if (this.selectedId() === m.id) this.selectedId.set(null);
        this.badges.refresh();
        this.toast.success('Message supprimé');
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }
}
