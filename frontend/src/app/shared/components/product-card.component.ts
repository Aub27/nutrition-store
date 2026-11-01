import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { LocPipe, MoneyPipe, TPipe } from '../pipes/i18n.pipes';
import { Product } from '../models';
import { IconComponent } from './icon.component';
import { MediaComponent } from './media.component';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, IconComponent, MediaComponent, TPipe, LocPipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="pc" [class.is-out]="soldOut()">
      <a class="pc-media" [routerLink]="['/produit', product().slug]" [attr.aria-label]="product() | loc: 'name'">
        <app-media [url]="product().image_url" [alt]="product() | loc: 'name'" [label]="product().brand ?? ''" [seed]="product().id" />
        <div class="pc-badges">
          @if (discount() > 0) {
            <span class="badge badge-sale">-{{ discount() }}%</span>
          }
          @if (product().is_new) {
            <span class="badge badge-new">{{ 'common.new' | t }}</span>
          }
          @if (product().is_bestseller && discount() === 0 && !product().is_new) {
            <span class="badge badge-best">{{ 'common.bestseller' | t }}</span>
          }
        </div>
        @if (soldOut()) {
          <div class="pc-sold">{{ 'common.outOfStock' | t }}</div>
        }
      </a>
      <div class="pc-body">
        @if (product().brand) {
          <span class="pc-brand">{{ product().brand }}</span>
        }
        <h3 class="pc-title">
          <a [routerLink]="['/produit', product().slug]">{{ product() | loc: 'name' }}</a>
        </h3>
        <div class="pc-meta">
          @if (product().free_delivery) {
            <span class="badge badge-free"><app-icon name="truck" [size]="12" /> {{ 'common.freeDelivery' | t }}</span>
          }
          @if (product().stock_status === 'low_stock') {
            <span class="pc-low">{{ 'common.lowStock' | t }}</span>
          }
        </div>
        <div class="pc-foot">
          <div class="pc-price">
            <strong>{{ product().price | money }}</strong>
            @if (product().compare_at_price) {
              <s>{{ product().compare_at_price | money }}</s>
            }
          </div>
          <button
            type="button"
            class="pc-add"
            [disabled]="soldOut()"
            (click)="onAdd()"
            [attr.aria-label]="'common.add' | t"
          >
            <app-icon [name]="needsOption() ? 'arrow-right' : 'plus'" [size]="20" [stroke]="2.4" />
          </button>
        </div>
      </div>
    </article>
  `,
  styles: `
    :host {
      display: block;
    }
    .pc {
      position: relative;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #fff;
      border: 1px solid var(--line);
      border-radius: var(--r-lg);
      overflow: hidden;
      transition: transform 0.4s var(--ease), box-shadow 0.4s var(--ease), border-color 0.3s;
    }
    .pc:hover {
      transform: translateY(-6px);
      box-shadow: var(--sh-lg);
      border-color: var(--p-200);
    }
    .pc-media {
      position: relative;
      display: block;
      aspect-ratio: 1 / 1;
      background: var(--p-50);
      overflow: hidden;
    }
    .pc-media :is(img, .ph) {
      transition: transform 0.7s var(--ease);
    }
    .pc:hover .pc-media :is(img, .ph) {
      transform: scale(1.06);
    }
    .pc-badges {
      position: absolute;
      inset: 0.75rem auto auto 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      align-items: flex-start;
    }
    .pc-sold {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      background: rgba(6, 25, 15, 0.55);
      color: #fff;
      font-weight: 700;
      letter-spacing: 0.04em;
      backdrop-filter: blur(2px);
    }
    .pc-body {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      padding: 1rem 1.1rem 1.1rem;
      flex: 1;
    }
    .pc-brand {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--p-500);
    }
    .pc-title {
      font-size: 1.02rem;
      font-weight: 650;
      line-height: 1.3;
      letter-spacing: -0.01em;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-height: 2.6em;
    }
    .pc-title a::after {
      content: none;
    }
    .pc-meta {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
      align-items: center;
      min-height: 22px;
    }
    .pc-low {
      font-size: 0.74rem;
      font-weight: 650;
      color: var(--warn);
    }
    .pc-foot {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 0.5rem;
      margin-top: auto;
      padding-top: 0.4rem;
    }
    .pc-price {
      display: grid;
      line-height: 1.15;
    }
    .pc-price strong {
      font-family: var(--font-display);
      font-size: 1.28rem;
      color: var(--ink);
    }
    .pc-price s {
      color: var(--muted);
      font-size: 0.85rem;
    }
    .pc-add {
      width: 46px;
      height: 46px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      color: #fff;
      background: var(--grad);
      box-shadow: var(--glow);
      transition: transform 0.25s var(--ease), box-shadow 0.25s;
    }
    .pc-add:hover {
      transform: scale(1.08) rotate(-4deg);
    }
    .pc-add:disabled {
      background: var(--line);
      box-shadow: none;
      color: var(--muted);
      cursor: not-allowed;
    }
    [dir='rtl'] .pc-add app-icon {
      transform: scaleX(-1);
    }
  `,
})
export class ProductCardComponent {
  readonly product = input.required<Product>();
  readonly add = output<Product>();
  readonly choose = output<Product>();
  protected i18n = inject(I18nService);

  protected readonly soldOut = computed(() => this.product().stock_status === 'out_of_stock');
  protected readonly needsOption = computed(() => this.product().options.length > 0);
  protected readonly discount = computed(() => {
    const p = this.product();
    if (!p.compare_at_price) return 0;
    const old = Number(p.compare_at_price);
    const now = Number(p.price);
    return old > now ? Math.round(((old - now) / old) * 100) : 0;
  });

  protected onAdd(): void {
    if (this.needsOption()) this.choose.emit(this.product());
    else this.add.emit(this.product());
  }
}
