import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { SiteSettingsService } from '../../core/services/site-settings.service';
import { IconComponent } from '../../shared/components/icon.component';
import { MediaComponent } from '../../shared/components/media.component';
import { LocPipe, MoneyPipe, TPipe } from '../../shared/pipes/i18n.pipes';

@Component({
  selector: 'app-cart',
  imports: [RouterLink, IconComponent, MediaComponent, TPipe, LocPipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container wrap">
      <h1>{{ 'cart.title' | t }}</h1>

      @if (cart.isEmpty()) {
        <div class="empty-state card">
          <div class="orb"><app-icon name="cart" [size]="34" /></div>
          <h3>{{ 'cart.empty.title' | t }}</h3>
          <p class="muted">{{ 'cart.empty.desc' | t }}</p>
          <a routerLink="/boutique" class="btn btn-primary">{{ 'cart.continue' | t }}</a>
        </div>
      } @else {
        <div class="layout">
          <div class="lines card">
            @for (l of cart.lines(); track l.product_id + '-' + l.option) {
              <div class="line" [class.bad]="!l.available">
                <a class="img" [routerLink]="['/produit', l.slug]">
                  <app-media [url]="l.image_url" [alt]="l | loc: 'name'" [seed]="l.product_id" [iconSize]="30" />
                </a>
                <div class="main">
                  <a [routerLink]="['/produit', l.slug]" class="name">{{ l | loc: 'name' }}</a>
                  @if (l.option) {
                    <span class="muted">{{ l.option }}</span>
                  }
                  @if (l.issue) {
                    <span class="issue"><app-icon name="alert" [size]="14" /> {{ 'cart.issue.' + l.issue | t }}</span>
                  }
                  <span class="unit">{{ l.unit_price | money }}</span>
                </div>
                <div class="qty">
                  <button type="button" (click)="cart.setQuantity(l.product_id, l.option, l.quantity - 1)" aria-label="-"><app-icon name="minus" [size]="16" [stroke]="2.5" /></button>
                  <span>{{ l.quantity }}</span>
                  <button type="button" (click)="cart.setQuantity(l.product_id, l.option, l.quantity + 1)" aria-label="+"><app-icon name="plus" [size]="16" [stroke]="2.5" /></button>
                </div>
                <strong class="total">{{ l.line_total | money }}</strong>
                <button type="button" class="rm" (click)="cart.remove(l.product_id, l.option)" [attr.aria-label]="'cart.remove' | t"><app-icon name="trash" [size]="18" /></button>
              </div>
            }
          </div>

          <aside class="sum card">
            @if (threshold() && !cart.freeDelivery() && cart.amountToFree() !== null) {
              <p class="free"><app-icon name="truck" [size]="18" /> {{ 'cart.freeLeft' | t: { amount: cart.amountToFree() } }}</p>
            } @else if (cart.freeDelivery()) {
              <p class="free ok"><app-icon name="check" [size]="18" [stroke]="2.6" /> {{ 'cart.freeReached' | t }}</p>
            }
            <dl>
              <div><dt>{{ 'cart.subtotal' | t }}</dt><dd>{{ cart.subtotal() | money }}</dd></div>
              <div><dt>{{ 'cart.delivery' | t }}</dt><dd>{{ cart.freeDelivery() ? ('common.free' | t) : (cart.deliveryFee() | money) }}</dd></div>
              <div class="grand"><dt>{{ 'cart.total' | t }}</dt><dd>{{ cart.total() | money }}</dd></div>
            </dl>
            <p class="cod"><app-icon name="cash" [size]="18" /> {{ 'cart.codNote' | t }}</p>
            <a routerLink="/commande" class="btn btn-primary btn-lg btn-block" [class.is-disabled]="!cart.allAvailable()">
              {{ 'cart.checkout' | t }} <app-icon name="arrow-right" [size]="18" />
            </a>
            <a routerLink="/boutique" class="more">{{ 'cart.continue' | t }}</a>
          </aside>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .wrap {
      padding-block: 2.5rem 3rem;
    }
    h1 {
      font-size: clamp(1.9rem, 4vw, 2.7rem);
      margin-bottom: 1.6rem;
    }
    .layout {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 1.5rem;
      align-items: start;
    }
    .lines {
      padding: 0.5rem 1.4rem;
    }
    .line {
      display: grid;
      grid-template-columns: 92px 1fr auto auto auto;
      gap: 1.1rem;
      align-items: center;
      padding-block: 1.1rem;
      border-bottom: 1px dashed var(--line);
    }
    .line:last-child {
      border: 0;
    }
    .img {
      width: 92px;
      height: 92px;
      border-radius: 18px;
      overflow: hidden;
      background: var(--p-50);
    }
    .main {
      display: grid;
      gap: 0.2rem;
      min-width: 0;
    }
    .name {
      font-weight: 700;
      color: var(--ink);
      font-size: 1.02rem;
    }
    .issue {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      color: var(--danger);
      font-weight: 600;
      font-size: 0.82rem;
    }
    .unit {
      color: var(--p-600);
      font-weight: 650;
      font-size: 0.9rem;
    }
    .qty {
      display: inline-flex;
      align-items: center;
      border: 1.5px solid var(--line);
      border-radius: 999px;
    }
    .qty button {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      color: var(--p-600);
    }
    .qty button:hover {
      background: var(--p-50);
    }
    .qty span {
      min-width: 30px;
      text-align: center;
      font-weight: 800;
    }
    .total {
      font-family: var(--font-display);
      font-size: 1.15rem;
      min-width: 90px;
      text-align: end;
    }
    .rm {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      color: var(--muted);
    }
    .rm:hover {
      background: #ffe6ea;
      color: var(--danger);
    }
    .sum {
      position: sticky;
      inset-block-start: calc(var(--header-h) + 1rem);
      padding: 1.5rem;
      display: grid;
      gap: 1rem;
    }
    .free {
      display: flex;
      gap: 0.55rem;
      align-items: center;
      padding: 0.8rem 1rem;
      border-radius: 14px;
      background: var(--grad-soft);
      border: 1px solid var(--line);
      color: var(--p-700);
      font-weight: 650;
      font-size: 0.86rem;
    }
    .free.ok {
      background: #e7fbf1;
      border-color: #b7f0d3;
      color: #0b7a49;
    }
    dl {
      display: grid;
      gap: 0.6rem;
      margin: 0;
    }
    dl div {
      display: flex;
      justify-content: space-between;
    }
    dt {
      color: var(--muted);
    }
    dd {
      margin: 0;
      font-weight: 650;
    }
    .grand {
      padding-top: 0.8rem;
      border-top: 1px solid var(--line);
    }
    .grand dt {
      color: var(--ink);
      font-weight: 700;
    }
    .grand dd {
      font-family: var(--font-display);
      font-size: 1.6rem;
      font-weight: 800;
    }
    .cod {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
      align-items: center;
      color: var(--muted);
      font-size: 0.85rem;
    }
    .more {
      text-align: center;
      font-weight: 650;
      color: var(--p-600);
    }
    @media (max-width: 960px) {
      .layout {
        grid-template-columns: 1fr;
      }
      .sum {
        position: static;
      }
    }
    @media (max-width: 640px) {
      .line {
        grid-template-columns: 76px 1fr auto;
        grid-template-areas: 'img main rm' 'img qty total';
        row-gap: 0.6rem;
      }
      .img {
        grid-area: img;
        width: 76px;
        height: 76px;
      }
      .main {
        grid-area: main;
      }
      .qty {
        grid-area: qty;
        justify-self: start;
      }
      .total {
        grid-area: total;
      }
      .rm {
        grid-area: rm;
      }
    }
  `,
})
export class CartPage {
  protected cart = inject(CartService);
  private settings = inject(SiteSettingsService).settings;
  protected threshold = computed(() => this.settings()?.free_delivery_threshold ?? null);
}
