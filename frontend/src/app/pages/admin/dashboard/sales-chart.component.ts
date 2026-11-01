import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { MoneyPipe } from '../../../shared/pipes/i18n.pipes';
import { formatChartDay, formatCompact, formatDayMonth } from '../shared/format';

export interface SalesPoint {
  date: string;
  orders: number;
  revenue: string;
}

const W = 720;
const H = 280;
const PAD = { l: 52, r: 18, t: 18, b: 34 };

/** Hand-built SVG area chart (no chart library). Hover or use ←/→ to inspect a day. */
@Component({
  selector: 'adm-sales-chart',
  imports: [MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="wrap"
      tabindex="0"
      role="group"
      [attr.aria-label]="summary()"
      (keydown.arrowleft)="move(-1, $event)"
      (keydown.arrowright)="move(1, $event)"
      (keydown.escape)="active.set(null)"
      (blur)="active.set(null)"
      (mouseleave)="active.set(null)"
    >
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <linearGradient id="adm-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"             stop-color="#22a447" stop-opacity="0.38" />
            <stop offset="100%" stop-color="#84cc16" stop-opacity="0.02" />
          </linearGradient>
          <linearGradient id="adm-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"             stop-color="#0f8a4b" />
            <stop offset="100%" stop-color="#84cc16" />
          </linearGradient>
        </defs>

        @for (g of grid(); track g.y) {
          <line [attr.x1]="PADL" [attr.x2]="W - PADR" [attr.y1]="g.y" [attr.y2]="g.y" class="grid" />
          <text [attr.x]="PADL - 10" [attr.y]="g.y + 4" class="ylab" text-anchor="end">{{ g.label }}</text>
        }
        @for (p of pts(); track p.i; let i = $index) {
          @if (i % labelEvery() === 0 || i === pts().length - 1) {
            <text [attr.x]="p.x" [attr.y]="H - 10" class="xlab" text-anchor="middle">{{ p.short }}</text>
          }
        }

        <path [attr.d]="area()" fill="url(#adm-area)" class="area" />
        <path [attr.d]="line()" class="line" stroke="url(#adm-line)" />

        @if (activePoint(); as a) {
          <line [attr.x1]="a.x" [attr.x2]="a.x" [attr.y1]="PADT" [attr.y2]="H - PADB" class="cursor" />
          <circle [attr.cx]="a.x" [attr.cy]="a.y" r="9" class="halo" />
          <circle [attr.cx]="a.x" [attr.cy]="a.y" r="5" class="pt" />
        }

        @for (p of pts(); track p.i) {
          <rect
            [attr.x]="p.x - colW() / 2"
            [attr.y]="0"
            [attr.width]="colW()"
            [attr.height]="H"
            fill="transparent"
            (mouseenter)="active.set(p.i)"
            (touchstart)="active.set(p.i)"
          />
        }
      </svg>

      @if (activePoint(); as a) {
        <div class="tip" [class.flip]="a.x / W > 0.65" [style.left.%]="(a.x / W) * 100" [style.top.%]="(a.y / H) * 100" role="status">
          <strong>{{ a.full }}</strong>
          <span class="rev">{{ a.revenue | money }}</span>
          <span class="ord">{{ a.orders }} commande{{ a.orders > 1 ? 's' : '' }}</span>
        </div>
      }

      @if (empty()) {
        <div class="none">Les ventes apparaîtront ici dès la première commande.</div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .wrap {
      position: relative;
      border-radius: var(--r);
      outline-offset: 4px;
    }
    svg {
      inline-size: 100%;
      block-size: auto;
      overflow: visible;
    }
    .grid {
      stroke: #dcefe2;
      stroke-dasharray: 3 5;
    }
    .ylab,
    .xlab {
      fill: var(--muted);
      font-size: 11px;
      font-family: var(--font-body);
    }
    .line {
      fill: none;
      stroke-width: 3.2;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: 2000;
      stroke-dashoffset: 2000;
      animation: draw 1.6s var(--ease) 0.1s forwards;
    }
    .area {
      opacity: 0;
      animation: fadein 1s ease 0.5s forwards;
    }
    @keyframes draw {
      to {
        stroke-dashoffset: 0;
      }
    }
    @keyframes fadein {
      to {
        opacity: 1;
      }
    }
    .cursor {
      stroke: var(--p-300);
      stroke-width: 1.5;
      stroke-dasharray: 4 4;
    }
    .halo {
      fill: rgba(22, 163, 74, 0.18);
    }
    .pt {
      fill: #fff;
      stroke: #22a447;
      stroke-width: 3;
    }
    .tip {
      position: absolute;
      transform: translate(-50%, calc(-100% - 16px));
      display: grid;
      gap: 0.1rem;
      padding: 0.6rem 0.85rem;
      border-radius: 14px;
      background: var(--ink);
      color: #fff;
      font-size: 0.78rem;
      white-space: nowrap;
      pointer-events: none;
      box-shadow: var(--sh-lg);
      animation: tip 0.2s var(--ease) both;
    }
    .tip.flip {
      transform: translate(-85%, calc(-100% - 16px));
    }
    @keyframes tip {
      from {
        opacity: 0;
      }
    }
    .tip strong {
      text-transform: capitalize;
      color: var(--p-200);
      font-weight: 600;
    }
    .rev {
      font-family: var(--font-display);
      font-size: 1.1rem;
      font-weight: 700;
    }
    .ord {
      color: rgba(255, 255, 255, 0.7);
    }
    .none {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      text-align: center;
      padding: 1rem;
      color: var(--muted);
      font-weight: 600;
      font-size: 0.9rem;
      pointer-events: none;
    }
  `,
})
export class SalesChartComponent {
  readonly points = input.required<SalesPoint[]>();

  protected readonly W = W;
  protected readonly H = H;
  protected readonly PADL = PAD.l;
  protected readonly PADR = PAD.r;
  protected readonly PADT = PAD.t;
  protected readonly PADB = PAD.b;
  protected readonly active = signal<number | null>(null);

  private readonly max = computed(() => {
    const top = Math.max(0, ...this.points().map((p) => Number(p.revenue)));
    if (top <= 0) return 100;
    const pow = Math.pow(10, Math.floor(Math.log10(top)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s * 4 >= top) ?? pow * 10;
    return step * 4;
  });

  protected readonly empty = computed(() => this.points().every((p) => Number(p.revenue) === 0 && p.orders === 0));
  protected readonly colW = computed(() => (W - PAD.l - PAD.r) / Math.max(1, this.points().length - 1));
  protected readonly labelEvery = computed(() => (this.points().length > 10 ? 2 : 1));

  protected readonly pts = computed(() => {
    const list = this.points();
    const n = list.length;
    const inner = W - PAD.l - PAD.r;
    const h = H - PAD.t - PAD.b;
    return list.map((p, i) => {
      const rev = Number(p.revenue);
      return {
        i,
        x: PAD.l + (n <= 1 ? inner / 2 : (i / (n - 1)) * inner),
        y: PAD.t + h - (rev / this.max()) * h,
        revenue: p.revenue,
        orders: p.orders,
        short: formatDayMonth(p.date),
        full: formatChartDay(p.date),
      };
    });
  });

  protected readonly grid = computed(() => {
    const h = H - PAD.t - PAD.b;
    return [0, 1, 2, 3, 4].map((k) => ({
      y: PAD.t + h - (k / 4) * h,
      label: k === 0 ? '0' : formatCompact((this.max() * k) / 4),
    }));
  });

  protected readonly line = computed(() => this.smooth());
  protected readonly area = computed(() => {
    const p = this.pts();
    if (!p.length) return '';
    const base = H - PAD.b;
    return `${this.smooth()} L ${p[p.length - 1].x} ${base} L ${p[0].x} ${base} Z`;
  });

  protected readonly activePoint = computed(() => {
    const i = this.active();
    return i === null ? null : (this.pts()[i] ?? null);
  });

  protected readonly summary = computed(() => {
    const total = this.points().reduce((s, p) => s + Number(p.revenue), 0);
    return `Graphique des ventes sur ${this.points().length} jours, total ${Math.round(total)} DH. Utilisez les flèches gauche et droite pour parcourir les jours.`;
  });

  protected move(dir: number, ev: Event): void {
    ev.preventDefault();
    const n = this.points().length;
    if (!n) return;
    const cur = this.active();
    this.active.set(cur === null ? (dir > 0 ? 0 : n - 1) : Math.min(n - 1, Math.max(0, cur + dir)));
  }

  /** Catmull-Rom → cubic Bézier for a smooth curve that stays within the plot. */
  private smooth(): string {
    const p = this.pts();
    if (!p.length) return '';
    if (p.length === 1) return `M ${p[0].x} ${p[0].y}`;
    const base = H - PAD.b;
    let d = `M ${p[0].x} ${p[0].y}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] ?? p[i];
      const p1 = p[i];
      const p2 = p[i + 1];
      const p3 = p[i + 2] ?? p2;
      const c1y = Math.min(base, Math.max(PAD.t, p1.y + (p2.y - p0.y) / 6));
      const c2y = Math.min(base, Math.max(PAD.t, p2.y - (p3.y - p1.y) / 6));
      d += ` C ${p1.x + (p2.x - p0.x) / 6} ${c1y}, ${p2.x - (p3.x - p1.x) / 6} ${c2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }
}
