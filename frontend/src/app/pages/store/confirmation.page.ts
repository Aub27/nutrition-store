import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { OrderConfirmation } from '../../shared/models';
import { IconComponent } from '../../shared/components/icon.component';
import { MoneyPipe, TPipe } from '../../shared/pipes/i18n.pipes';

@Component({
  selector: 'app-confirmation',
  imports: [RouterLink, IconComponent, TPipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container wrap">
      @if (order(); as o) {
        <div class="card box reveal">
          <div class="confetti" aria-hidden="true">
            @for (i of dots; track i) {
              <span [style.--i]="i"></span>
            }
          </div>
          <div class="tick"><app-icon name="check" [size]="44" [stroke]="2.8" /></div>
          <h1>{{ 'confirm.title' | t }}</h1>
          <div class="num">
            <small>{{ 'confirm.number' | t }}</small>
            <strong>{{ o.order_number }}</strong>
          </div>
          <p class="next">{{ 'confirm.next' | t }}</p>
          <div class="recap">
            <div><span>{{ 'cart.subtotal' | t }}</span><b>{{ o.subtotal | money }}</b></div>
            <div><span>{{ 'cart.delivery' | t }}</span><b>{{ +o.delivery_fee === 0 ? ('common.free' | t) : (o.delivery_fee | money) }}</b></div>
            <div class="grand"><span>{{ 'cart.total' | t }}</span><b>{{ o.order_total | money }}</b></div>
            <p class="cod"><app-icon name="cash" [size]="16" /> {{ 'cart.codNote' | t }}</p>
          </div>
          <p class="muted keep">{{ 'confirm.keep' | t }}</p>
          <a routerLink="/" class="btn btn-primary btn-lg">{{ 'confirm.home' | t }}</a>
        </div>
      } @else {
        <div class="empty-state card">
          <div class="orb"><app-icon name="package" [size]="34" /></div>
          <h3>{{ 'confirm.none' | t }}</h3>
          <a routerLink="/boutique" class="btn btn-primary">{{ 'cart.continue' | t }}</a>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .wrap {
      padding-block: 3rem 4rem;
      max-width: 680px;
    }
    .box {
      position: relative;
      overflow: hidden;
      padding: clamp(1.8rem, 5vw, 3rem);
      display: grid;
      gap: 1.2rem;
      justify-items: center;
      text-align: center;
      box-shadow: var(--sh-lg);
    }
    .tick {
      width: 92px;
      height: 92px;
      border-radius: 30px;
      display: grid;
      place-items: center;
      color: #fff;
      background: var(--grad);
      box-shadow: var(--glow);
      animation: pop 0.8s var(--ease) both;
    }
    @keyframes pop {
      from {
        transform: scale(0.3) rotate(-30deg);
        opacity: 0;
      }
    }
    h1 {
      font-size: clamp(1.6rem, 4vw, 2.2rem);
    }
    .num {
      display: grid;
      gap: 0.2rem;
      padding: 1rem 2rem;
      border-radius: var(--r);
      background: var(--grad-soft);
      border: 1.5px dashed var(--p-300);
    }
    .num small {
      color: var(--muted);
      font-weight: 600;
    }
    .num strong {
      font-family: var(--font-display);
      font-size: 1.8rem;
      letter-spacing: 0.08em;
      color: var(--p-600);
    }
    .next {
      max-width: 46ch;
    }
    .recap {
      width: 100%;
      display: grid;
      gap: 0.5rem;
      padding: 1.1rem 1.3rem;
      border-radius: var(--r);
      border: 1px solid var(--line);
      text-align: start;
    }
    .recap div {
      display: flex;
      justify-content: space-between;
    }
    .recap span {
      color: var(--muted);
    }
    .grand {
      padding-top: 0.6rem;
      border-top: 1px dashed var(--line);
      font-size: 1.15rem;
    }
    .grand span {
      color: var(--ink);
      font-weight: 700;
    }
    .cod {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      justify-content: center;
      color: var(--p-600);
      font-weight: 600;
      font-size: 0.88rem;
      margin-top: 0.3rem;
    }
    .keep {
      font-size: 0.85rem;
    }
    .confetti span {
      position: absolute;
      inset-block-start: -10px;
      inset-inline-start: calc(var(--i) * 7%);
      width: 8px;
      height: 14px;
      border-radius: 3px;
      background: hsl(calc(80 + var(--i) * 9) 80% 52%);
      animation: fall calc(2.5s + var(--i) * 0.15s) ease-in both;
      animation-delay: calc(var(--i) * 0.07s);
      opacity: 0;
    }
    @keyframes fall {
      0% {
        transform: translateY(0) rotate(0);
        opacity: 1;
      }
      100% {
        transform: translateY(520px) rotate(540deg);
        opacity: 0;
      }
    }
  `,
})
export class ConfirmationPage {
  private router = inject(Router);
  protected i18n = inject(I18nService);
  protected dots = Array.from({ length: 14 }, (_, i) => i);

  protected order = signal<OrderConfirmation | null>(this.read());
  protected hasOrder = computed(() => this.order() !== null);

  private read(): OrderConfirmation | null {
    const state = (this.router.getCurrentNavigation()?.extras.state ?? history.state) as { order?: OrderConfirmation } | undefined;
    const o = state?.order;
    return o && typeof o.order_number === 'string' ? o : null;
  }
}
