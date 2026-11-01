import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Product, Quote, QuoteLine } from '../../shared/models';
import { OrderService } from './order.service';

const CART_KEY = 'ns_cart_v1';
const MAX_LINE_QTY = 20;

export interface CartEntry {
  product_id: number;
  option: string | null;
  quantity: number;
  // Display snapshot used until the server quote arrives. Prices are always re-validated server-side.
  slug: string;
  name_fr: string;
  name_ar: string | null;
  image_url: string | null;
  unit_price: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private orders = inject(OrderService);

  private readonly _entries = signal<CartEntry[]>(this.load());
  private readonly _quote = signal<Quote | null>(null);
  readonly quoting = signal(false);

  readonly entries = this._entries.asReadonly();
  readonly quote = this._quote.asReadonly();
  readonly itemCount = computed(() => this._entries().reduce((n, e) => n + e.quantity, 0));
  readonly isEmpty = computed(() => this._entries().length === 0);

  /** Lines for display: server-priced when a fresh quote exists, otherwise the local snapshot. */
  readonly lines = computed<QuoteLine[]>(() => {
    const quote = this._quote();
    const entries = this._entries();
    return entries.map((e) => {
      const q = quote?.lines.find((l) => l.product_id === e.product_id && (l.option ?? null) === e.option);
      if (q) return { ...q, quantity: e.quantity, line_total: String(Number(q.unit_price) * e.quantity) };
      return {
        product_id: e.product_id,
        slug: e.slug,
        name_fr: e.name_fr,
        name_ar: e.name_ar,
        image_url: e.image_url,
        option: e.option,
        unit_price: String(e.unit_price),
        compare_at_price: null,
        quantity: e.quantity,
        line_total: String(e.unit_price * e.quantity),
        available: true,
        max_quantity: null,
        issue: null,
      };
    });
  });

  readonly subtotal = computed(() => {
    const q = this._quote();
    return q ? Number(q.subtotal) : this._entries().reduce((s, e) => s + e.unit_price * e.quantity, 0);
  });
  readonly deliveryFee = computed(() => Number(this._quote()?.delivery_fee ?? 0));
  readonly total = computed(() => (this._quote() ? Number(this._quote()!.total) : this.subtotal()));
  readonly freeDelivery = computed(() => this._quote()?.free_delivery ?? false);
  readonly amountToFree = computed(() => {
    const v = this._quote()?.amount_to_free_delivery;
    return v != null ? Number(v) : null;
  });
  readonly allAvailable = computed(() => this._quote()?.all_available ?? true);

  private quoteTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const entries = this._entries();
      try {
        localStorage.setItem(CART_KEY, JSON.stringify(entries));
      } catch {
        /* private mode / quota: cart just won't persist */
      }
    });
    if (this._entries().length) this.refresh();
  }

  add(product: Product, quantity = 1, option: string | null = null): void {
    const opt = product.options.length ? option : null;
    const entries = this._entries();
    const existing = entries.find((e) => e.product_id === product.id && e.option === opt);
    if (existing) {
      this.setQuantity(product.id, opt, existing.quantity + quantity);
      return;
    }
    this._entries.set([
      ...entries,
      {
        product_id: product.id,
        option: opt,
        quantity: Math.min(Math.max(1, quantity), MAX_LINE_QTY),
        slug: product.slug,
        name_fr: product.name_fr,
        name_ar: product.name_ar,
        image_url: product.image_url,
        unit_price: Number(product.price),
      },
    ]);
    this.refreshSoon();
  }

  setQuantity(productId: number, option: string | null, quantity: number): void {
    if (quantity <= 0) {
      this.remove(productId, option);
      return;
    }
    const q = Math.min(Math.floor(quantity), MAX_LINE_QTY);
    this._entries.update((list) =>
      list.map((e) => (e.product_id === productId && e.option === option ? { ...e, quantity: q } : e)),
    );
    this.refreshSoon();
  }

  remove(productId: number, option: string | null): void {
    this._entries.update((list) => list.filter((e) => !(e.product_id === productId && e.option === option)));
    this.refreshSoon();
  }

  clear(): void {
    this._entries.set([]);
    this._quote.set(null);
  }

  refreshSoon(): void {
    if (this.quoteTimer) clearTimeout(this.quoteTimer);
    this.quoteTimer = setTimeout(() => this.refresh(), 250);
  }

  refresh(): void {
    const entries = this._entries();
    if (!entries.length) {
      this._quote.set(null);
      return;
    }
    this.quoting.set(true);
    this.orders
      .quote(entries.map((e) => ({ product_id: e.product_id, quantity: e.quantity, option: e.option })))
      .subscribe({
        next: (quote) => {
          this._quote.set(quote);
          this.quoting.set(false);
        },
        error: () => this.quoting.set(false),
      });
  }

  /** Never trust localStorage: it can be edited by the user or by browser extensions. */
  private load(): CartEntry[] {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY) ?? '[]');
      if (!Array.isArray(raw)) return [];
      return raw
        .filter(
          (e) =>
            e &&
            Number.isInteger(e.product_id) &&
            e.product_id > 0 &&
            Number.isInteger(e.quantity) &&
            typeof e.slug === 'string' &&
            typeof e.name_fr === 'string',
        )
        .slice(0, 50)
        .map((e) => ({
          product_id: e.product_id,
          option: typeof e.option === 'string' ? e.option.slice(0, 100) : null,
          quantity: Math.min(Math.max(1, e.quantity), MAX_LINE_QTY),
          slug: e.slug.slice(0, 200),
          name_fr: e.name_fr.slice(0, 255),
          name_ar: typeof e.name_ar === 'string' ? e.name_ar.slice(0, 255) : null,
          image_url: typeof e.image_url === 'string' ? e.image_url : null,
          unit_price: Number.isFinite(Number(e.unit_price)) ? Number(e.unit_price) : 0,
        }));
    } catch {
      return [];
    }
  }
}
