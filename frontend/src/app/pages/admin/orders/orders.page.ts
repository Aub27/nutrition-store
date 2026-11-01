import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { DrawerComponent } from '../../../shared/components/drawer.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { MediaComponent } from '../../../shared/components/media.component';
import { MoneyPipe } from '../../../shared/pipes/i18n.pipes';
import { Order, OrderStatus } from '../../../shared/models';
import { AdminBadgesService } from '../shared/admin-badges.service';
import { inputValue, relativeTime } from '../shared/format';
import { errorMessage } from '../shared/http-error';
import { STATUS_META, STATUS_ORDER, canAnonymize, canCancel, nextStep } from '../shared/status';
import { OrderDetailComponent } from './order-detail.component';

const COLUMN_CAP = 30;

@Component({
  selector: 'adm-orders',
  imports: [DrawerComponent, IconComponent, MediaComponent, MoneyPipe, OrderDetailComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['../shared/admin-common.css', './orders.page.css'],
  template: `
    <div class="page">
      <div class="toolbar">
        <div class="search">
          <app-icon name="search" [size]="18" />
          <input
            class="input"
            type="search"
            placeholder="N° de commande, nom, téléphone…"
            aria-label="Rechercher une commande"
            [value]="q()"
            (input)="onSearch($event)"
          />
        </div>
        <span class="grow"></span>
        <span class="live" [class.on]="!loading()"><i></i> Mise à jour auto · 45 s</span>
        <button type="button" class="btn btn-ghost btn-sm" (click)="load(false)" [disabled]="refreshing()">
          <app-icon name="clock" [size]="16" [class.spin]="refreshing()" /> Actualiser
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm d-only"
          (click)="showCancelled.set(!showCancelled())"
          [attr.aria-pressed]="showCancelled()"
        >
          <app-icon [name]="showCancelled() ? 'eye-off' : 'eye'" [size]="16" />
          {{ showCancelled() ? 'Masquer' : 'Afficher' }} les annulées ({{ counts()['CANCELLED'] }})
        </button>
      </div>

      <div class="m-chips chips" role="tablist" aria-label="Statut des commandes">
        @for (c of columns(); track c.meta.key) {
          <button
            type="button"
            role="tab"
            class="chip"
            [class.is-active]="mobileStatus() === c.meta.key"
            [attr.aria-selected]="mobileStatus() === c.meta.key"
            (click)="mobileStatus.set(c.meta.key)"
          >
            {{ c.meta.column }} <span class="n">{{ c.total }}</span>
          </button>
        }
      </div>

      @if (error(); as e) {
        <div class="banner err" role="alert"><app-icon name="alert" [size]="18" /> <span>{{ e }}</span></div>
      }

      @if (loading()) {
        <div class="board">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="col"><div class="skeleton sk-head"></div><div class="skeleton sk-card"></div><div class="skeleton sk-card"></div></div>
          }
        </div>
      } @else if (totalAll() === 0 && !q()) {
        <div class="empty-state card">
          <span class="orb"><app-icon name="cart" [size]="36" /></span>
          <h3>Aucune commande pour le moment</h3>
          <p class="muted">Dès qu'un client passera commande, elle apparaîtra ici dans « Nouvelles » avec une notification.</p>
        </div>
      } @else {
        <div class="board">
          @for (c of columns(); track c.meta.key) {
            <section
              class="col"
              [style.--c]="c.meta.color"
              [style.--soft]="c.meta.soft"
              [class.c-off]="c.meta.key === 'CANCELLED' && !showCancelled()"
              [class.m-off]="mobileStatus() !== c.meta.key"
              [attr.aria-label]="c.meta.column"
            >
              <header class="col-head">
                <span class="col-ico"><app-icon [name]="c.meta.icon" [size]="16" [stroke]="2.4" /></span>
                <h3>{{ c.meta.column }}</h3>
                <span class="col-n">{{ c.total }}</span>
              </header>
              <div class="col-body">
                @for (o of c.shown; track o.id) {
                  <article class="ocard" [class.is-new]="o.status === 'NEW'" [class.busy]="busy().has(o.id)">
                    <button type="button" class="ocard-open" (click)="open(o)" [attr.aria-label]="'Ouvrir la commande ' + o.order_number">
                      <span class="o-top">
                        <strong class="o-num">{{ o.order_number }}</strong>
                        <time class="o-ago">{{ ago(o.created_at) }}</time>
                      </span>
                      <span class="o-who">
                        <strong>{{ firstName(o) }}</strong>
                        <span><app-icon name="pin" [size]="13" /> {{ o.city }}</span>
                      </span>
                    </button>
                    <div class="o-bottom">
                      <span class="thumbs">
                        @for (it of o.items.slice(0, 3); track it.id) {
                          <span class="th"><app-media [url]="it.image_url_snapshot" [alt]="it.product_name_snapshot" [iconSize]="14" [seed]="it.product_id ?? it.id" /></span>
                        }
                        @if (o.items.length > 3) {
                          <span class="th more">+{{ o.items.length - 3 }}</span>
                        }
                      </span>
                      <span class="o-sum">
                        <strong>{{ o.order_total | money }}</strong>
                        <small>{{ itemCount(o) }} article{{ itemCount(o) > 1 ? 's' : '' }}</small>
                      </span>
                      @if (next(o); as n) {
                        <button
                          type="button"
                          class="adv"
                          [disabled]="busy().has(o.id)"
                          (click)="quickAdvance(o, $event)"
                          [attr.aria-label]="n.label"
                          [attr.title]="n.label"
                        >
                          <app-icon [name]="n.icon" [size]="18" [stroke]="2.4" />
                        </button>
                      }
                    </div>
                  </article>
                } @empty {
                  <div class="col-empty">
                    <app-icon [name]="c.meta.icon" [size]="22" />
                    <span>{{ q() ? 'Aucun résultat' : 'Rien ici pour le moment' }}</span>
                  </div>
                }
                @if (c.total > c.shown.length) {
                  <button type="button" class="more-btn" (click)="expand(c.meta.key)">Afficher les {{ c.total - c.shown.length }} autres</button>
                }
              </div>
            </section>
          }
        </div>
      }
    </div>

    <app-drawer [open]="!!selected()" [label]="'Détail de la commande'" width="580px" (closed)="close()">
      @if (selected(); as o) {
        <div drawer-title class="d-title">
          <h3>{{ o.order_number }}</h3>
          <span class="st" [style.--c]="meta(o).color" [style.--soft]="meta(o).soft">{{ meta(o).label }}</span>
          <small>{{ ago(o.created_at) }}</small>
        </div>
      }
      @if (selected(); as o) {
        <adm-order-detail [order]="o" (updated)="replace($event)" />
      }
      @if (selected(); as o) {
        <div drawer-footer class="d-foot">
          @if (next(o); as n) {
            <button type="button" class="btn btn-primary btn-block" [disabled]="busy().has(o.id)" (click)="advance(o, n.status)">
              @if (busy().has(o.id)) {
                <span class="spinner"></span>
              } @else {
                <app-icon [name]="n.icon" [size]="18" [stroke]="2.4" />
              }
              {{ n.label }}
            </button>
          }
          <div class="d-sec">
            @if (canCancel(o.status)) {
              <button type="button" class="btn btn-ghost btn-sm danger" [disabled]="busy().has(o.id)" (click)="cancel(o)">
                <app-icon name="close" [size]="15" /> Annuler la commande
              </button>
            }
            @if (canAnonymize(o.status) && !o.anonymized_at) {
              <button type="button" class="btn btn-ghost btn-sm danger" [disabled]="busy().has(o.id)" (click)="anonymize(o)">
                <app-icon name="shield" [size]="15" /> Anonymiser les données client
              </button>
            }
          </div>
        </div>
      }
    </app-drawer>
  `,
})
export class OrdersPage {
  private api = inject(AdminApiService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);
  private badges = inject(AdminBadgesService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private qp = toSignal(this.route.queryParamMap);

  protected readonly orders = signal<Order[]>([]);
  protected readonly loading = signal(true);
  protected readonly refreshing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly q = signal('');
  protected readonly showCancelled = signal(false);
  protected readonly mobileStatus = signal<OrderStatus>('NEW');
  protected readonly selected = signal<Order | null>(null);
  protected readonly busy = signal<ReadonlySet<number>>(new Set());
  protected readonly expanded = signal<ReadonlySet<OrderStatus>>(new Set());
  private readonly pendingOpen = signal<number | null>(null);
  private readonly loaded = signal(false);
  private searchTimer = 0;

  protected readonly counts = computed(() => {
    const out: Record<OrderStatus, number> = { NEW: 0, CONFIRMED: 0, WAITING_DELIVERY: 0, DELIVERED: 0, CANCELLED: 0 };
    for (const o of this.orders()) out[o.status]++;
    return out;
  });
  protected readonly totalAll = computed(() => this.orders().length);

  protected readonly columns = computed(() => {
    const list = [...this.orders()].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return STATUS_ORDER.map((key) => {
      const all = list.filter((o) => o.status === key);
      const open = this.expanded().has(key);
      return { meta: STATUS_META[key], total: all.length, shown: open ? all : all.slice(0, COLUMN_CAP) };
    });
  });

  protected readonly canCancel = canCancel;
  protected readonly canAnonymize = canAnonymize;

  constructor() {
    effect(() => {
      const id = Number(this.qp()?.get('open'));
      untracked(() => this.pendingOpen.set(id > 0 ? id : null));
    });
    effect(() => {
      const id = this.pendingOpen();
      const list = this.orders();
      if (!id || !this.loaded()) return;
      untracked(() => {
        this.pendingOpen.set(null);
        const found = list.find((o) => o.id === id);
        if (found) this.selected.set(found);
        else {
          this.toast.error('Commande introuvable.');
          this.clearParam();
        }
      });
    });

    this.load(true);
    const timer = window.setInterval(() => this.load(true, true), 45_000);
    inject(DestroyRef).onDestroy(() => {
      window.clearInterval(timer);
      window.clearTimeout(this.searchTimer);
    });
  }

  protected ago(iso: string): string {
    return relativeTime(iso);
  }
  protected firstName(o: Order): string {
    return o.customer_name.trim().split(/\s+/)[0] || 'Client';
  }
  protected itemCount(o: Order): number {
    return o.items.reduce((n, i) => n + i.quantity, 0);
  }
  protected next = (o: Order) => nextStep(o.status);
  protected meta = (o: Order) => STATUS_META[o.status];

  protected onSearch(ev: Event): void {
    this.q.set(inputValue(ev));
    window.clearTimeout(this.searchTimer);
    this.searchTimer = window.setTimeout(() => this.load(false, true), 300);
  }

  protected expand(key: OrderStatus): void {
    this.expanded.update((s) => new Set(s).add(key));
  }

  /** `silent` refreshes keep the board visible (no skeleton). */
  protected load(first: boolean, silent = false): void {
    if (first) this.loading.set(true);
    else if (!silent) this.refreshing.set(true);
    this.api.orders({ q: this.q().trim() || undefined, limit: 500 }).subscribe({
      next: (list) => {
        this.orders.set(list);
        const cur = this.selected();
        if (cur) {
          const fresh = list.find((o) => o.id === cur.id);
          if (fresh) this.selected.set(fresh);
        }
        this.error.set(null);
        this.loaded.set(true);
        this.loading.set(false);
        this.refreshing.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.refreshing.set(false);
        this.loaded.set(true);
        if (!silent || !this.orders().length) this.error.set(errorMessage(e, 'Impossible de charger les commandes.'));
      },
    });
  }

  protected open(o: Order): void {
    this.selected.set(o);
  }

  protected close(): void {
    this.selected.set(null);
    if (this.qp()?.has('open')) this.clearParam();
  }

  protected replace(o: Order): void {
    this.orders.update((list) => list.map((x) => (x.id === o.id ? o : x)));
    if (this.selected()?.id === o.id) this.selected.set(o);
  }

  protected async quickAdvance(o: Order, ev: Event): Promise<void> {
    ev.stopPropagation();
    const n = nextStep(o.status);
    if (!n) return;
    if (n.status === 'DELIVERED') {
      const ok = await this.confirm.ask({
        title: `Marquer ${o.order_number} comme livrée ?`,
        message: 'La commande passera en « Livrées ». Cette étape ne peut pas être annulée.',
        confirmLabel: 'Marquer comme livrée',
      });
      if (!ok) return;
    }
    this.advance(o, n.status);
  }

  protected advance(o: Order, status: Exclude<OrderStatus, 'NEW'>): void {
    this.setBusy(o.id, true);
    this.api.setOrderStatus(o.id, status).subscribe({
      next: (updated) => {
        this.setBusy(o.id, false);
        this.replace(updated);
        this.badges.refresh();
        this.toast.success(`${updated.order_number} : ${STATUS_META[updated.status].label.toLowerCase()}`);
      },
      error: (e) => {
        this.setBusy(o.id, false);
        this.toast.error(errorMessage(e));
      },
    });
  }

  protected async cancel(o: Order): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Annuler la commande ${o.order_number} ?`,
      message: 'Le stock des produits commandés sera automatiquement restauré. Cette action est irréversible.',
      confirmLabel: 'Annuler la commande',
      cancelLabel: 'Retour',
      danger: true,
    });
    if (ok) this.advance(o, 'CANCELLED');
  }

  protected async anonymize(o: Order): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Anonymiser les données client ?',
      message: `Le nom, le téléphone, l'e-mail et l'adresse de ${o.order_number} seront définitivement effacés. Les montants et articles sont conservés. Cette action est irréversible.`,
      confirmLabel: 'Anonymiser',
      danger: true,
    });
    if (!ok) return;
    this.setBusy(o.id, true);
    this.api.anonymizeOrder(o.id).subscribe({
      next: (updated) => {
        this.setBusy(o.id, false);
        this.replace(updated);
        this.toast.success('Données client anonymisées');
      },
      error: (e) => {
        this.setBusy(o.id, false);
        this.toast.error(errorMessage(e));
      },
    });
  }

  private setBusy(id: number, on: boolean): void {
    this.busy.update((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  private clearParam(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { open: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
