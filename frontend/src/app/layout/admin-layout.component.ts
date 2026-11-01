import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AdminApiService } from '../core/services/admin-api.service';
import { AdminAuthService } from '../core/services/admin-auth.service';
import { SiteSettingsService } from '../core/services/site-settings.service';
import { ToastService } from '../core/services/toast.service';
import { AdminNotification } from '../shared/models';
import { IconComponent } from '../shared/components/icon.component';
import { AdminBadgesService } from '../pages/admin/shared/admin-badges.service';
import { relativeTime } from '../pages/admin/shared/format';
import { errorMessage } from '../pages/admin/shared/http-error';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  badge?: 'orders' | 'messages';
}

const NAV: NavItem[] = [
  { path: '/admin/dashboard', label: 'Tableau de bord', icon: 'home' },
  { path: '/admin/orders', label: 'Commandes', icon: 'cart', badge: 'orders' },
  { path: '/admin/products', label: 'Produits', icon: 'package' },
  { path: '/admin/categories', label: 'Catégories', icon: 'grid' },
  { path: '/admin/messages', label: 'Messages', icon: 'chat', badge: 'messages' },
  { path: '/admin/settings', label: 'Paramètres', icon: 'sliders' },
  { path: '/admin/security', label: 'Sécurité', icon: 'shield' },
];

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell" [class.collapsed]="collapsed()" [class.drawer-open]="mobileOpen()">
      <a class="skip" href="#adm-main">Aller au contenu</a>

      @if (mobileOpen()) {
        <div class="scrim" (click)="mobileOpen.set(false)"></div>
      }

      <aside class="side" aria-label="Navigation d'administration">
        <div class="brand">
          <span class="logo">{{ initial() }}</span>
          <div class="brand-txt">
            <strong>{{ title() }}</strong>
            <small>Administration</small>
          </div>
          <button type="button" class="close-m" (click)="mobileOpen.set(false)" aria-label="Fermer le menu">
            <app-icon name="close" [size]="20" />
          </button>
        </div>

        <nav class="nav">
          @for (item of items(); track item.path) {
            <a
              class="nav-link"
              [routerLink]="item.path"
              routerLinkActive="active"
              [attr.title]="collapsed() ? item.label : null"
            >
              <span class="ico"><app-icon [name]="item.icon" [size]="20" /></span>
              <span class="lbl">{{ item.label }}</span>
              @if (item.count > 0) {
                <span class="count" [attr.aria-label]="item.count + ' à traiter'">{{ item.count > 99 ? '99+' : item.count }}</span>
              }
            </a>
          }
        </nav>

        <div class="side-foot">
          <a class="shop" href="/" target="_blank" rel="noopener">
            <app-icon name="globe" [size]="18" />
            <span class="lbl">Voir la boutique</span>
          </a>
          <button type="button" class="fold" (click)="collapsed.set(!collapsed())" [attr.aria-label]="collapsed() ? 'Déplier le menu' : 'Replier le menu'">
            <app-icon [name]="collapsed() ? 'chevron-right' : 'chevron-left'" [size]="18" />
            <span class="lbl">Réduire</span>
          </button>
        </div>
      </aside>

      <div class="main">
        <header class="top">
          <button type="button" class="burger" (click)="mobileOpen.set(true)" aria-label="Ouvrir le menu">
            <app-icon name="menu" [size]="22" />
          </button>
          <h1 class="page-title">{{ pageTitle() }}</h1>
          <span class="grow"></span>

          <a class="view-shop" href="/" target="_blank" rel="noopener">
            <app-icon name="globe" [size]="17" /> <span>Voir la boutique</span>
          </a>

          <div class="notif" #notifBox>
            <button
              type="button"
              class="bell"
              (click)="toggleNotifs()"
              aria-haspopup="true"
              [attr.aria-expanded]="notifOpen()"
              [attr.aria-label]="'Notifications' + (unread() ? ' (' + unread() + ' non lues)' : '')"
            >
              <app-icon name="bell" [size]="21" />
              @if (unread() > 0) {
                <span class="dot">{{ unread() > 9 ? '9+' : unread() }}</span>
              }
            </button>
            @if (notifOpen()) {
              <div class="pop" role="dialog" aria-label="Notifications">
                <div class="pop-head">
                  <strong>Notifications</strong>
                  <button type="button" class="link" (click)="markAll()" [disabled]="unread() === 0">Tout marquer comme lu</button>
                </div>
                <div class="pop-list">
                  @for (n of notifs(); track n.id) {
                    <button type="button" class="n-item" [class.unread]="!n.is_read" (click)="openNotif(n)">
                      <span class="n-ico"><app-icon [name]="n.order_id ? 'cart' : 'bell'" [size]="17" /></span>
                      <span class="n-txt">
                        <strong>{{ n.title }}</strong>
                        <small>{{ n.message }}</small>
                        <em>{{ ago(n.created_at) }}</em>
                      </span>
                      @if (!n.is_read) {
                        <span class="n-dot" aria-hidden="true"></span>
                      }
                    </button>
                  } @empty {
                    <div class="n-empty">
                      <app-icon name="bell" [size]="26" />
                      <p>Aucune notification pour le moment.</p>
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          <div class="me">
            <span class="avatar" aria-hidden="true">{{ adminInitial() }}</span>
            <span class="me-name">{{ auth.adminName() || 'Admin' }}</span>
          </div>
          <button type="button" class="logout" (click)="logout()" aria-label="Se déconnecter" title="Se déconnecter">
            <app-icon name="logout" [size]="19" />
          </button>
        </header>

        <main id="adm-main" class="content"><router-outlet /></main>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .skip {
      position: absolute;
      inset-inline-start: -999px;
      z-index: 2000;
      background: #fff;
      padding: 0.6rem 1rem;
      border-radius: 10px;
    }
    .skip:focus {
      inset-inline-start: 1rem;
      inset-block-start: 1rem;
    }
    .shell {
      --side-w: 268px;
      min-block-size: 100dvh;
      display: grid;
      grid-template-columns: var(--side-w) minmax(0, 1fr);
      background: var(--bg);
      transition: grid-template-columns 0.35s var(--ease);
    }
    .shell.collapsed {
      --side-w: 86px;
    }
    .side {
      position: sticky;
      inset-block-start: 0;
      block-size: 100dvh;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1.1rem 0.85rem;
      color: #e9defc;
      background: radial-gradient(500px 300px at 0% 0%, rgba(147, 51, 234, 0.45), transparent 60%),
        radial-gradient(400px 300px at 100% 100%, rgba(217, 70, 239, 0.28), transparent 60%), #1a0b36;
      overflow: hidden;
      z-index: 50;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.3rem 0.45rem 0.9rem;
      border-block-end: 1px solid rgba(255, 255, 255, 0.09);
    }
    .logo {
      flex: none;
      inline-size: 44px;
      block-size: 44px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 1.35rem;
      color: #fff;
      background: var(--grad);
      box-shadow: var(--glow);
    }
    .brand-txt {
      min-inline-size: 0;
      display: grid;
      line-height: 1.15;
    }
    .brand-txt strong {
      font-family: var(--font-display);
      color: #fff;
      font-size: 1.08rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .brand-txt small {
      font-size: 0.68rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--p-300);
    }
    .close-m {
      display: none;
      margin-inline-start: auto;
      color: #fff;
      inline-size: 40px;
      block-size: 40px;
      place-items: center;
      border-radius: 12px;
    }
    .nav {
      display: grid;
      gap: 0.3rem;
      align-content: start;
      flex: 1;
      overflow-y: auto;
    }
    .nav-link,
    .shop,
    .fold {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.8rem;
      padding: 0.15rem 0.5rem 0.15rem 0.35rem;
      min-block-size: 48px;
      border-radius: 16px;
      color: #cdbcf0;
      font-weight: 600;
      font-size: 0.95rem;
      transition: background 0.25s, color 0.25s, transform 0.25s var(--ease), box-shadow 0.25s;
      text-align: start;
    }
    .nav-link:hover,
    .shop:hover,
    .fold:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
    }
    .nav-link:hover .ico {
      transform: scale(1.1);
    }
    .nav-link.active {
      color: #fff;
      background: var(--grad);
      box-shadow: var(--glow);
    }
    .ico {
      flex: none;
      inline-size: 40px;
      block-size: 40px;
      display: grid;
      place-items: center;
      transition: transform 0.25s var(--ease);
    }
    .lbl {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .count {
      flex: none;
      min-inline-size: 24px;
      block-size: 24px;
      padding-inline: 0.4rem;
      border-radius: 999px;
      display: grid;
      place-items: center;
      font-size: 0.72rem;
      font-weight: 800;
      color: #fff;
      background: var(--sale);
      box-shadow: 0 0 0 3px rgba(255, 45, 120, 0.25);
      animation: pulse 2.4s ease-in-out infinite;
    }
    .nav-link.active .count {
      background: #fff;
      color: var(--p-700);
      box-shadow: none;
    }
    @keyframes pulse {
      50% {
        box-shadow: 0 0 0 6px rgba(255, 45, 120, 0);
      }
    }
    .side-foot {
      display: grid;
      gap: 0.3rem;
      padding-block-start: 0.8rem;
      border-block-start: 1px solid rgba(255, 255, 255, 0.09);
    }
    .shop,
    .fold {
      padding-inline-start: 0.85rem;
      min-block-size: 44px;
      font-size: 0.88rem;
    }
    .shop app-icon,
    .fold app-icon {
      inline-size: 20px;
      flex: none;
    }
    .collapsed .brand-txt,
    .collapsed .lbl,
    .collapsed .count {
      display: none;
    }
    .collapsed .nav-link,
    .collapsed .shop,
    .collapsed .fold {
      justify-content: center;
      padding-inline: 0;
    }
    .collapsed .nav-link {
      padding-inline: 0;
    }
    .collapsed .brand {
      justify-content: center;
      padding-inline: 0;
    }

    .main {
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
    }
    .top {
      position: sticky;
      inset-block-start: 0;
      z-index: 40;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-block-size: 68px;
      padding-inline: clamp(1rem, 2.4vw, 2rem);
      background: rgba(251, 249, 255, 0.82);
      backdrop-filter: blur(16px) saturate(160%);
      -webkit-backdrop-filter: blur(16px) saturate(160%);
      border-block-end: 1px solid var(--line);
    }
    .grow {
      flex: 1;
    }
    .page-title {
      font-size: 1.35rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .burger {
      display: none;
      inline-size: 44px;
      block-size: 44px;
      border-radius: 14px;
      place-items: center;
      background: #fff;
      border: 1px solid var(--line);
      color: var(--p-600);
    }
    .view-shop {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.5rem 0.95rem;
      border-radius: 999px;
      font-weight: 650;
      font-size: 0.86rem;
      color: var(--p-600);
      border: 1.5px solid var(--p-200);
      background: #fff;
      transition: background 0.2s, border-color 0.2s;
    }
    .view-shop:hover {
      background: var(--p-50);
      border-color: var(--p-400);
    }
    .notif {
      position: relative;
    }
    .bell {
      position: relative;
      inline-size: 44px;
      block-size: 44px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      background: #fff;
      border: 1px solid var(--line);
      color: var(--p-700);
      transition: transform 0.25s var(--ease), box-shadow 0.25s;
    }
    .bell:hover {
      box-shadow: var(--sh);
      transform: translateY(-1px);
    }
    .dot {
      position: absolute;
      inset-block-start: -6px;
      inset-inline-end: -6px;
      min-inline-size: 20px;
      block-size: 20px;
      padding-inline: 0.3rem;
      border-radius: 999px;
      background: var(--sale);
      color: #fff;
      font-size: 0.68rem;
      font-weight: 800;
      display: grid;
      place-items: center;
      border: 2px solid var(--bg);
    }
    .pop {
      position: absolute;
      inset-block-start: calc(100% + 10px);
      inset-inline-end: 0;
      inline-size: min(390px, calc(100vw - 2rem));
      background: #fff;
      border: 1px solid var(--line);
      border-radius: var(--r-lg);
      box-shadow: var(--sh-lg);
      overflow: hidden;
      animation: pop-in 0.3s var(--ease) both;
      transform-origin: top right;
    }
    @keyframes pop-in {
      from {
        opacity: 0;
        transform: translateY(-8px) scale(0.97);
      }
    }
    .pop-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.95rem 1.1rem;
      border-block-end: 1px solid var(--line);
    }
    .pop-head strong {
      font-family: var(--font-display);
      font-size: 1.05rem;
      color: var(--ink);
    }
    .link {
      font-size: 0.82rem;
      font-weight: 650;
      color: var(--p-600);
    }
    .link:hover:not(:disabled) {
      text-decoration: underline;
    }
    .link:disabled {
      color: var(--muted);
      opacity: 0.6;
      cursor: default;
    }
    .pop-list {
      max-block-size: min(60dvh, 440px);
      overflow-y: auto;
    }
    .n-item {
      inline-size: 100%;
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.85rem 1.1rem;
      text-align: start;
      border-block-end: 1px solid var(--line);
      transition: background 0.2s;
    }
    .n-item:last-child {
      border-block-end: 0;
    }
    .n-item:hover {
      background: var(--p-50);
    }
    .n-item.unread {
      background: #faf6ff;
    }
    .n-ico {
      flex: none;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: var(--grad-soft);
      color: var(--p-500);
      border: 1px solid var(--line);
    }
    .n-txt {
      display: grid;
      gap: 0.1rem;
      min-inline-size: 0;
      flex: 1;
    }
    .n-txt strong {
      font-size: 0.9rem;
      color: var(--ink);
    }
    .n-txt small {
      color: var(--muted);
      font-size: 0.82rem;
    }
    .n-txt em {
      font-style: normal;
      font-size: 0.72rem;
      color: var(--p-400);
      font-weight: 650;
    }
    .n-dot {
      flex: none;
      inline-size: 9px;
      block-size: 9px;
      margin-block-start: 0.4rem;
      border-radius: 50%;
      background: var(--grad);
    }
    .n-empty {
      display: grid;
      justify-items: center;
      gap: 0.5rem;
      padding: 2.2rem 1rem;
      color: var(--muted);
      font-size: 0.9rem;
    }
    .me {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding-inline: 0.35rem 0.9rem;
      block-size: 44px;
      border-radius: 999px;
      background: #fff;
      border: 1px solid var(--line);
    }
    .avatar {
      inline-size: 34px;
      block-size: 34px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: var(--grad);
      color: #fff;
      font-weight: 700;
      font-size: 0.9rem;
    }
    .me-name {
      font-weight: 650;
      font-size: 0.88rem;
      color: var(--ink-2);
      max-inline-size: 140px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .logout {
      inline-size: 44px;
      block-size: 44px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      color: var(--muted);
      transition: background 0.2s, color 0.2s;
    }
    .logout:hover {
      background: #fff0f2;
      color: var(--danger);
    }
    .content {
      flex: 1;
      min-inline-size: 0;
    }

    @media (max-width: 1100px) {
      .view-shop span {
        display: none;
      }
      .view-shop {
        padding: 0.5rem 0.7rem;
      }
    }
    @media (max-width: 900px) {
      .shell,
      .shell.collapsed {
        grid-template-columns: minmax(0, 1fr);
        --side-w: 290px;
      }
      .side {
        position: fixed;
        inset-block: 0;
        inset-inline-start: 0;
        inline-size: var(--side-w);
        z-index: 1000;
        transform: translateX(-105%);
        transition: transform 0.4s var(--ease);
        box-shadow: var(--sh-lg);
      }
      :host-context([dir='rtl']) .side {
        transform: translateX(105%);
      }
      .drawer-open .side {
        transform: none;
      }
      .scrim {
        position: fixed;
        inset: 0;
        z-index: 999;
        background: rgba(20, 7, 42, 0.55);
        backdrop-filter: blur(3px);
        animation: fade 0.25s both;
      }
      @keyframes fade {
        from {
          opacity: 0;
        }
      }
      .burger,
      .close-m {
        display: grid;
      }
      .fold,
      .view-shop,
      .me-name {
        display: none;
      }
      .collapsed .brand-txt,
      .collapsed .lbl {
        display: revert;
      }
      .collapsed .count {
        display: grid;
      }
      .collapsed .nav-link,
      .collapsed .shop {
        justify-content: flex-start;
        padding-inline: 0.35rem 0.5rem;
      }
      .me {
        padding-inline: 0.35rem;
      }
      .top {
        gap: 0.5rem;
      }
      .page-title {
        font-size: 1.15rem;
      }
      .pop {
        position: fixed;
        inset-inline: 1rem;
        inset-block-start: 76px;
        inline-size: auto;
      }
    }
  `,
})
export class AdminLayoutComponent {
  protected readonly auth = inject(AdminAuthService);
  private api = inject(AdminApiService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private badges = inject(AdminBadgesService);
  private settings = inject(SiteSettingsService);
  private destroyRef = inject(DestroyRef);
  private notifBox = viewChild<ElementRef<HTMLElement>>('notifBox');

  protected readonly collapsed = signal(false);
  protected readonly mobileOpen = signal(false);
  protected readonly notifOpen = signal(false);
  protected readonly notifs = signal<AdminNotification[]>([]);
  protected readonly pageTitle = signal('');

  protected readonly unread = computed(() => this.notifs().filter((n) => !n.is_read).length);
  protected readonly title = computed(() => this.settings.settings()?.site_title || 'Boutique');
  protected readonly initial = computed(() => this.title().trim().charAt(0).toUpperCase() || 'N');
  protected readonly adminInitial = computed(() => this.auth.adminName().trim().charAt(0).toUpperCase() || 'A');
  protected readonly items = computed(() =>
    NAV.map((n) => ({
      ...n,
      count: n.badge === 'orders' ? this.badges.newOrders() : n.badge === 'messages' ? this.badges.unreadMessages() : 0,
    })),
  );

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.mobileOpen.set(false);
        this.notifOpen.set(false);
        this.updateTitle();
      });
    this.updateTitle();

    this.refresh();
    const timer = window.setInterval(() => this.refresh(), 60_000);
    this.destroyRef.onDestroy(() => window.clearInterval(timer));
  }

  @HostListener('document:click', ['$event'])
  protected onDocClick(ev: MouseEvent): void {
    if (!this.notifOpen()) return;
    const box = this.notifBox()?.nativeElement;
    if (box && !box.contains(ev.target as Node)) this.notifOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.notifOpen.set(false);
    this.mobileOpen.set(false);
  }

  protected ago(iso: string): string {
    return relativeTime(iso);
  }

  protected toggleNotifs(): void {
    this.notifOpen.set(!this.notifOpen());
    if (this.notifOpen()) this.loadNotifs();
  }

  protected openNotif(n: AdminNotification): void {
    this.notifOpen.set(false);
    if (!n.is_read) {
      this.notifs.update((list) => list.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      this.api.markNotification(n.id, true).subscribe({ error: () => undefined });
    }
    if (n.order_id) this.router.navigate(['/admin/orders'], { queryParams: { open: n.order_id } });
  }

  protected markAll(): void {
    this.notifs.update((list) => list.map((x) => ({ ...x, is_read: true })));
    this.api.markAllNotificationsRead().subscribe({
      error: (e) => {
        this.toast.error(errorMessage(e));
        this.loadNotifs();
      },
    });
  }

  protected logout(): void {
    this.auth.logout().subscribe(() => this.router.navigate(['/admin/login']));
  }

  private refresh(): void {
    this.loadNotifs();
    this.badges.refresh();
  }

  private loadNotifs(): void {
    this.api.notifications({ limit: 30 }).subscribe({
      next: (list) => this.notifs.set(list),
      error: () => undefined,
    });
  }

  private updateTitle(): void {
    let r = this.router.routerState.snapshot.root;
    while (r.firstChild) r = r.firstChild;
    this.pageTitle.set(r.title ?? '');
  }
}
