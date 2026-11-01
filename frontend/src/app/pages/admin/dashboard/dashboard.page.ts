import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { AdminAuthService } from '../../../core/services/admin-auth.service';
import { IconComponent } from '../../../shared/components/icon.component';
import { MediaComponent } from '../../../shared/components/media.component';
import { MoneyPipe } from '../../../shared/pipes/i18n.pipes';
import { DashboardStats, OrderStatus } from '../../../shared/models';
import { formatLongDay } from '../shared/format';
import { errorMessage } from '../shared/http-error';
import { STATUS_META, STATUS_ORDER } from '../shared/status';
import { CountUpComponent } from './count-up.component';
import { SalesChartComponent } from './sales-chart.component';

interface Kpi {
  label: string;
  value: number;
  kind: 'int' | 'money';
  icon: string;
  a: string;
  b: string;
  link: string;
  hint: string;
  alert?: boolean;
}

@Component({
  selector: 'adm-dashboard',
  imports: [NgTemplateOutlet, RouterLink, IconComponent, MediaComponent, MoneyPipe, CountUpComponent, SalesChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['../shared/admin-common.css', './dashboard.page.css'],
  template: `
    <div class="page">
      <header class="hello">
        <div>
          <span class="eyebrow">{{ today }}</span>
          <h2>{{ greeting() }}, <span class="text-grad">{{ firstName() }}</span> 👋</h2>
          <p class="muted">Voici l'essentiel de votre activité, en un coup d'œil.</p>
        </div>
        <div class="quick">
          <a class="btn btn-primary" routerLink="/admin/products" [queryParams]="{ new: 1 }">
            <app-icon name="plus" [size]="18" [stroke]="2.4" /> Ajouter un produit
          </a>
          <a class="btn btn-ghost" routerLink="/admin/orders"><app-icon name="cart" [size]="18" /> Voir les commandes</a>
        </div>
      </header>

      @if (loading()) {
        <div class="kpis">
          @for (i of [1, 2, 3, 4, 5]; track i) {
            <div class="skeleton sk-kpi"></div>
          }
        </div>
        <div class="row">
          <div class="skeleton sk-chart"></div>
          <div class="skeleton sk-chart"></div>
        </div>
      } @else if (error(); as e) {
        <div class="banner err" role="alert">
          <app-icon name="alert" [size]="20" />
          <div>
            <strong>Impossible de charger le tableau de bord.</strong>
            <p>{{ e }}</p>
            <button type="button" class="btn btn-sm btn-ghost retry" (click)="load()">Réessayer</button>
          </div>
        </div>
      } @else if (stats(); as s) {
        @if (needsSetup()) {
          <section class="start card" aria-labelledby="start-title">
            <div class="start-head">
              <div>
                <span class="eyebrow">Premiers pas</span>
                <h3 id="start-title">Lancez votre boutique en 4 étapes</h3>
                <p class="muted">Une fois ces étapes terminées, vos premières ventes arriveront ici.</p>
              </div>
              <div class="ring" [style.--p]="progress()">
                <strong>{{ doneCount() }}/4</strong>
              </div>
            </div>
            <ol class="steps">
              @for (st of steps(); track st.n) {
                <li class="step" [class.done]="st.done">
                  @if (st.external) {
                    <a [href]="st.link" target="_blank" rel="noopener" class="step-in">
                      <ng-container *ngTemplateOutlet="stepBody; context: { $implicit: st }" />
                    </a>
                  } @else {
                    <a [routerLink]="st.link" [queryParams]="st.query" class="step-in">
                      <ng-container *ngTemplateOutlet="stepBody; context: { $implicit: st }" />
                    </a>
                  }
                </li>
              }
            </ol>
          </section>
        }

        <section class="kpis" aria-label="Indicateurs clés">
          @for (k of kpis(); track k.label; let i = $index) {
            <a class="kpi card" [routerLink]="k.link" [style.--a]="k.a" [style.--b]="k.b" [style.animation-delay.ms]="i * 70" [class.alert]="k.alert">
              <span class="k-ico"><app-icon [name]="k.icon" [size]="22" /></span>
              <span class="k-val"><adm-count [value]="k.value" [kind]="k.kind" /></span>
              <span class="k-lbl">{{ k.label }}</span>
              <span class="k-hint">{{ k.hint }}</span>
            </a>
          }
        </section>

        <div class="row">
          <section class="card panel">
            <div class="p-head">
              <div>
                <h3>Ventes · 14 derniers jours</h3>
                <p class="muted">Chiffre d'affaires quotidien</p>
              </div>
              <div class="total">
                <small>Total période</small>
                <strong>{{ periodRevenue() | money }}</strong>
              </div>
            </div>
            <adm-sales-chart [points]="s.sales_last_14_days" />
          </section>

          <section class="card panel">
            <div class="p-head">
              <div>
                <h3>Pipeline des commandes</h3>
                <p class="muted">{{ s.total_orders }} commande{{ s.total_orders > 1 ? 's' : '' }} au total</p>
              </div>
              <a class="more" routerLink="/admin/orders">Kanban <app-icon name="arrow-right" [size]="15" /></a>
            </div>
            @if (s.total_orders > 0) {
              <div class="bar" role="img" [attr.aria-label]="pipelineLabel()">
                @for (seg of pipeline(); track seg.key) {
                  @if (seg.count > 0) {
                    <span class="seg" [style.flex-grow]="seg.count" [style.background]="seg.color" [attr.title]="seg.label + ' : ' + seg.count"></span>
                  }
                }
              </div>
            } @else {
              <div class="bar empty"></div>
            }
            <ul class="legend">
              @for (seg of pipeline(); track seg.key) {
                <li>
                  <span class="lg-dot" [style.background]="seg.color"></span>
                  <span class="lg-name">{{ seg.label }}</span>
                  <strong>{{ seg.count }}</strong>
                  <small>{{ seg.pct }}%</small>
                </li>
              }
            </ul>
          </section>
        </div>

        <div class="row two">
          <section class="card panel">
            <div class="p-head">
              <div>
                <h3>Meilleures ventes</h3>
                <p class="muted">Produits les plus commandés</p>
              </div>
            </div>
            @if (s.top_products.length) {
              <ol class="top">
                @for (p of s.top_products; track p.name; let i = $index) {
                  <li>
                    <span class="rank" [class.r1]="i === 0" [class.r2]="i === 1" [class.r3]="i === 2">{{ i + 1 }}</span>
                    <div class="t-main">
                      <div class="t-line">
                        <strong>{{ p.name }}</strong>
                        <span>{{ p.revenue | money }}</span>
                      </div>
                      <div class="t-bar"><i [style.width.%]="(p.quantity / maxQty()) * 100"></i></div>
                      <small>{{ p.quantity }} vendu{{ p.quantity > 1 ? 's' : '' }}</small>
                    </div>
                  </li>
                }
              </ol>
            } @else {
              <div class="soft-empty">
                <span class="orb"><app-icon name="trending" [size]="26" /></span>
                <strong>Pas encore de ventes</strong>
                <p>Vos produits les plus populaires s'afficheront ici.</p>
              </div>
            }
          </section>

          <section class="card panel">
            <div class="p-head">
              <div>
                <h3>Stock faible</h3>
                <p class="muted">Produits à réapprovisionner</p>
              </div>
              <a class="more" routerLink="/admin/products" [queryParams]="{ filter: 'low_stock' }">Tout voir <app-icon name="arrow-right" [size]="15" /></a>
            </div>
            @if (s.low_stock.length) {
              <ul class="low">
                @for (p of s.low_stock; track p.id) {
                  <li>
                    <a routerLink="/admin/products" [queryParams]="{ filter: 'low_stock' }" class="low-card" [class.out]="p.stock_quantity === 0">
                      <span class="thumb"><app-media [url]="p.image_url" [alt]="p.name_fr" [iconSize]="22" [seed]="p.id" /></span>
                      <span class="l-name">{{ p.name_fr }}</span>
                      <span class="l-badge">{{ p.stock_quantity === 0 ? 'Rupture' : 'Reste ' + p.stock_quantity }}</span>
                    </a>
                  </li>
                }
              </ul>
            } @else {
              <div class="soft-empty">
                <span class="orb ok"><app-icon name="shield" [size]="26" /></span>
                <strong>{{ s.active_products === 0 ? 'Aucun produit pour l’instant' : 'Tout est en ordre' }}</strong>
                <p>{{ s.active_products === 0 ? 'Ajoutez vos produits pour suivre votre stock.' : 'Aucun produit en stock faible.' }}</p>
              </div>
            }
          </section>
        </div>
      }
    </div>

    <ng-template #stepBody let-st>
      <span class="st-n">
        @if (st.done) {
          <app-icon name="check" [size]="18" [stroke]="3" />
        } @else {
          {{ st.n }}
        }
      </span>
      <span class="st-txt">
        <strong>{{ st.title }}</strong>
        <small>{{ st.desc }}</small>
      </span>
      <app-icon name="arrow-right" [size]="18" />
    </ng-template>
  `,
})
export class DashboardPage {
  private api = inject(AdminApiService);
  private auth = inject(AdminAuthService);

  protected readonly today = formatLongDay(new Date());
  protected readonly stats = signal<DashboardStats | null>(null);
  protected readonly categoryCount = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly greeting = computed(() => {
    const h = new Date().getHours();
    return h < 5 || h >= 18 ? 'Bonsoir' : h < 12 ? 'Bonjour' : 'Bon après-midi';
  });
  protected readonly firstName = computed(() => this.auth.adminName().trim().split(/\s+/)[0] || 'Admin');

  protected readonly needsSetup = computed(() => {
    const s = this.stats();
    return !!s && (s.active_products === 0 || s.total_orders === 0);
  });

  protected readonly steps = computed(() => {
    const s = this.stats();
    return [
      { n: 1, title: 'Configurer la boutique', desc: 'Nom, contact, livraison et annonce.', link: '/admin/settings', query: {}, done: false, external: false },
      { n: 2, title: 'Créer vos catégories', desc: 'Organisez votre catalogue par univers.', link: '/admin/categories', query: {}, done: this.categoryCount() > 0, external: false },
      { n: 3, title: 'Ajouter votre premier produit', desc: 'Photo, prix, stock et variantes.', link: '/admin/products', query: { new: 1 }, done: (s?.active_products ?? 0) > 0, external: false },
      { n: 4, title: 'Tester une commande', desc: 'Passez une commande depuis la boutique.', link: '/', query: {}, done: (s?.total_orders ?? 0) > 0, external: true },
    ];
  });
  protected readonly doneCount = computed(() => this.steps().filter((x) => x.done).length);
  protected readonly progress = computed(() => (this.doneCount() / 4) * 100);

  protected readonly kpis = computed<Kpi[]>(() => {
    const s = this.stats();
    if (!s) return [];
    const newOrders = s.by_status.NEW ?? 0;
    return [
      { label: "Commandes aujourd'hui", value: s.orders_today, kind: 'int', icon: 'cart', a: '#7c3aed', b: '#a855f7', link: '/admin/orders', hint: `${s.total_orders} au total` },
      { label: 'À traiter', value: newOrders, kind: 'int', icon: 'bell', a: '#d946ef', b: '#ff5fb7', link: '/admin/orders', hint: newOrders ? 'Nouvelles commandes en attente' : 'Rien en attente', alert: newOrders > 0 },
      { label: "Chiffre d'affaires du mois", value: Number(s.revenue_month), kind: 'money', icon: 'trending', a: '#6d28d9', b: '#d946ef', link: '/admin/orders', hint: `${Number(s.revenue_total).toLocaleString('fr-FR')} DH depuis le début` },
      { label: 'Panier moyen', value: Number(s.average_basket), kind: 'money', icon: 'cash', a: '#9333ea', b: '#f472b6', link: '/admin/orders', hint: 'Par commande' },
      { label: 'Produits actifs', value: s.active_products, kind: 'int', icon: 'package', a: '#5521ae', b: '#9b6dff', link: '/admin/products', hint: 'Visibles en boutique' },
    ];
  });

  protected readonly periodRevenue = computed(() =>
    (this.stats()?.sales_last_14_days ?? []).reduce((sum, p) => sum + Number(p.revenue), 0),
  );

  protected readonly pipeline = computed(() => {
    const s = this.stats();
    const total = s?.total_orders || 0;
    return STATUS_ORDER.map((key: OrderStatus) => {
      const count = s?.by_status[key] ?? 0;
      return {
        key,
        label: STATUS_META[key].column,
        color: STATUS_META[key].color,
        count,
        pct: total ? Math.round((count / total) * 100) : 0,
      };
    });
  });
  protected readonly pipelineLabel = computed(() =>
    this.pipeline()
      .map((p) => `${p.label} : ${p.count}`)
      .join(', '),
  );
  protected readonly maxQty = computed(() => Math.max(1, ...(this.stats()?.top_products ?? []).map((p) => p.quantity)));

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      stats: this.api.stats(),
      cats: this.api.categories().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ stats, cats }) => {
        this.stats.set(stats);
        this.categoryCount.set(cats.length);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }
}
