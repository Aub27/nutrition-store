import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { Order } from '../../../shared/models';
import { IconComponent } from '../../../shared/components/icon.component';
import { MediaComponent } from '../../../shared/components/media.component';
import { MoneyPipe } from '../../../shared/pipes/i18n.pipes';
import { formatDateTime, mailHref, telHref, whatsappHref } from '../shared/format';
import { errorMessage } from '../shared/http-error';

interface Step {
  label: string;
  date: string | null;
  done: boolean;
  tone: 'ok' | 'bad' | 'now';
}

/** Read-mostly order sheet shown in the orders drawer; also owns the internal note editor. */
@Component({
  selector: 'adm-order-detail',
  imports: [IconComponent, MediaComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['../shared/admin-common.css', './order-detail.component.css'],
  template: `
    @let o = order();
    @if (o.anonymized_at) {
      <div class="banner warn anon">
        <app-icon name="shield" [size]="18" />
        <span>Données client anonymisées le {{ dt(o.anonymized_at) }}.</span>
      </div>
    }

    <section class="blk">
      <h4><app-icon name="user" [size]="16" /> Client</h4>
      <div class="cust">
        <strong class="name">{{ o.customer_name }}</strong>
        <div class="contact">
          @if (tel(); as t) {
            <a class="pill" [href]="t"><app-icon name="phone" [size]="15" /> {{ o.phone_number }}</a>
          } @else {
            <span class="pill off"><app-icon name="phone" [size]="15" /> {{ o.phone_number }}</span>
          }
          @if (wa(); as w) {
            <a class="pill wa" [href]="w" target="_blank" rel="noopener"><app-icon name="whatsapp" [size]="15" /> WhatsApp</a>
          }
          @if (mail(); as m) {
            <a class="pill" [href]="m"><app-icon name="mail" [size]="15" /> {{ o.email }}</a>
          } @else if (o.email) {
            <span class="pill off"><app-icon name="mail" [size]="15" /> {{ o.email }}</span>
          }
        </div>
        <p class="addr">
          <app-icon name="pin" [size]="16" />
          <span>
            {{ o.address_line_1 }}
            @if (o.address_line_2) {
              <br />{{ o.address_line_2 }}
            }
            <br />{{ o.postal_code }} {{ o.city }}, {{ o.country }}
          </span>
        </p>
        @if (o.customer_note) {
          <blockquote class="note-c"><small>Note du client</small>{{ o.customer_note }}</blockquote>
        }
      </div>
    </section>

    <section class="blk">
      <h4><app-icon name="package" [size]="16" /> Articles ({{ count() }})</h4>
      <ul class="items">
        @for (it of o.items; track it.id) {
          <li>
            <span class="thumb"><app-media [url]="it.image_url_snapshot" [alt]="it.product_name_snapshot" [iconSize]="22" [seed]="it.product_id ?? it.id" /></span>
            <span class="i-main">
              <strong>{{ it.product_name_snapshot }}</strong>
              @if (it.option_label) {
                <span class="opt">{{ it.option_label }}</span>
              }
              <small>{{ it.quantity }} × {{ it.unit_price_snapshot | money }}</small>
            </span>
            <strong class="i-total">{{ it.line_total | money }}</strong>
          </li>
        }
      </ul>
      <dl class="totals">
        <div><dt>Sous-total</dt><dd>{{ o.subtotal | money }}</dd></div>
        <div><dt>Livraison</dt><dd>{{ freeShipping() ? 'Offerte' : (o.delivery_fee | money) }}</dd></div>
        <div class="grand"><dt>Total</dt><dd>{{ o.order_total | money }}</dd></div>
      </dl>
      <span class="badge badge-soft cod"><app-icon name="cash" [size]="14" /> Paiement à la livraison (espèces)</span>
    </section>

    <section class="blk">
      <h4><app-icon name="clock" [size]="16" /> Historique</h4>
      <ol class="tl">
        @for (s of steps(); track s.label) {
          <li [class.done]="s.done" [class.bad]="s.tone === 'bad'">
            <span class="node"></span>
            <strong>{{ s.label }}</strong>
            <small>{{ s.date ? dt(s.date) : s.done ? '—' : 'En attente' }}</small>
          </li>
        }
      </ol>
    </section>

    <section class="blk">
      <h4><app-icon name="edit" [size]="16" /> Note interne</h4>
      <textarea
        class="textarea"
        rows="3"
        maxlength="1000"
        placeholder="Visible uniquement par l'équipe (ex. : client rappelé, livraison samedi…)"
        aria-label="Note interne"
        [value]="note()"
        (input)="note.set(val($event))"
      ></textarea>
      <div class="note-actions">
        <button type="button" class="btn btn-sm btn-ghost" [disabled]="!dirty() || saving()" (click)="saveNote()">
          @if (saving()) {
            <span class="spinner dark"></span>
          }
          Enregistrer la note
        </button>
      </div>
    </section>
  `,
})
export class OrderDetailComponent {
  private api = inject(AdminApiService);
  private toast = inject(ToastService);

  readonly order = input.required<Order>();
  readonly updated = output<Order>();

  protected readonly note = linkedSignal(() => this.order().admin_note ?? '');
  protected readonly saving = signal(false);
  protected readonly dirty = computed(() => this.note().trim() !== (this.order().admin_note ?? '').trim());
  protected readonly count = computed(() => this.order().items.reduce((n, i) => n + i.quantity, 0));
  protected readonly freeShipping = computed(() => Number(this.order().delivery_fee) === 0);
  protected readonly tel = computed(() => telHref(this.order().phone_number));
  protected readonly wa = computed(() => whatsappHref(this.order().phone_number));
  protected readonly mail = computed(() => mailHref(this.order().email));

  protected readonly steps = computed<Step[]>(() => {
    const o = this.order();
    const shipped = o.status === 'WAITING_DELIVERY' || o.status === 'DELIVERED';
    const list: Step[] = [
      { label: 'Commande reçue', date: o.created_at, done: true, tone: 'ok' },
      { label: 'Confirmée', date: o.confirmed_at, done: !!o.confirmed_at, tone: 'ok' },
      { label: 'En livraison', date: null, done: shipped, tone: 'ok' },
      { label: 'Livrée', date: o.delivered_at, done: !!o.delivered_at, tone: 'ok' },
    ];
    if (o.status === 'CANCELLED') {
      return [list[0], ...list.slice(1).filter((s) => s.done), { label: 'Annulée', date: o.cancelled_at, done: true, tone: 'bad' }];
    }
    return list;
  });

  protected dt(iso: string): string {
    return formatDateTime(iso);
  }

  protected val(ev: Event): string {
    return (ev.target as HTMLTextAreaElement).value;
  }

  protected saveNote(): void {
    this.saving.set(true);
    const value = this.note().trim();
    this.api.setOrderNote(this.order().id, value || null).subscribe({
      next: (o) => {
        this.saving.set(false);
        this.toast.success('Note enregistrée');
        this.updated.emit(o);
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
