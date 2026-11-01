import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AdminAuthService } from '../../../core/services/admin-auth.service';
import { SiteSettingsService } from '../../../core/services/site-settings.service';
import { IconComponent } from '../../../shared/components/icon.component';
import { inputValue } from '../shared/format';
import { errorMessage } from '../shared/http-error';

@Component({
  selector: 'adm-login',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stage">
      <span class="blob b1"></span>
      <span class="blob b2"></span>
      <span class="blob b3"></span>
      <span class="grain"></span>

      <main class="card glass-card">
        <div class="brand">
          <span class="logo">{{ initial() }}</span>
          <div>
            <strong>{{ title() }}</strong>
            <small>Espace administration</small>
          </div>
        </div>

        <h1>Bon retour 👋</h1>
        <p class="lead">Connectez-vous pour gérer vos commandes, vos produits et votre boutique.</p>

        <form (submit)="submit($event)" novalidate autocomplete="on">
          <div class="field">
            <label for="email">Adresse e-mail</label>
            <div class="control">
              <app-icon name="mail" [size]="18" />
              <input
                id="email"
                name="email"
                type="email"
                inputmode="email"
                autocomplete="username"
                placeholder="vous@exemple.com"
                [value]="email()"
                (input)="email.set(val($event))"
                required
              />
            </div>
          </div>

          <div class="field">
            <label for="password">Mot de passe</label>
            <div class="control">
              <app-icon name="lock" [size]="18" />
              <input
                id="password"
                name="password"
                [type]="show() ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="••••••••••••"
                [value]="password()"
                (input)="password.set(val($event))"
                required
              />
              <button
                type="button"
                class="eye"
                (click)="show.set(!show())"
                [attr.aria-label]="show() ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
                [attr.aria-pressed]="show()"
              >
                <app-icon [name]="show() ? 'eye-off' : 'eye'" [size]="18" />
              </button>
            </div>
          </div>

          @if (error(); as e) {
            <div class="error" role="alert">
              <app-icon name="alert" [size]="18" />
              <span>{{ e }}</span>
            </div>
          }

          <button type="submit" class="btn btn-lg btn-block go" [disabled]="loading() || !canSubmit()">
            @if (loading()) {
              <span class="spinner"></span> Connexion…
            } @else {
              Se connecter <app-icon name="arrow-right" [size]="18" />
            }
          </button>
        </form>

        <p class="foot"><app-icon name="shield" [size]="14" /> Connexion sécurisée · accès réservé</p>
      </main>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .stage {
      position: relative;
      min-block-size: 100dvh;
      display: grid;
      place-items: center;
      padding: 1.5rem;
      background: var(--grad-dark);
      overflow: hidden;
      isolation: isolate;
    }
    .blob {
      position: absolute;
      z-index: -1;
      border-radius: 50%;
      filter: blur(70px);
      opacity: 0.55;
      animation: float 14s ease-in-out infinite;
    }
    .b1 {
      inline-size: 460px;
      block-size: 460px;
      inset-block-start: -120px;
      inset-inline-start: -100px;
      background: linear-gradient(135deg, #16a34a, #84cc16);
    }
    .b2 {
      inline-size: 380px;
      block-size: 380px;
      inset-block-end: -120px;
      inset-inline-end: -60px;
      background: linear-gradient(135deg, #84cc16, #0f8a4b);
      animation-delay: -5s;
      animation-duration: 18s;
    }
    .b3 {
      inline-size: 260px;
      block-size: 260px;
      inset-block-start: 45%;
      inset-inline-start: 58%;
      background: #0f8a4b;
      animation-delay: -9s;
      opacity: 0.4;
    }
    .grain {
      position: absolute;
      inset: 0;
      z-index: -1;
      background-image: radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px);
      background-size: 26px 26px;
      mask-image: radial-gradient(circle at center, #000 30%, transparent 75%);
    }
    @keyframes float {
      0%,
      100% {
        transform: translate(0, 0) scale(1);
      }
      33% {
        transform: translate(40px, 30px) scale(1.08);
      }
      66% {
        transform: translate(-30px, 50px) scale(0.94);
      }
    }
    .card {
      inline-size: min(100%, 440px);
      padding: clamp(1.6rem, 5vw, 2.5rem);
      border-radius: var(--r-xl);
      color: #fff;
      background: rgba(255, 255, 255, 0.09);
      border: 1px solid rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(22px) saturate(140%);
      -webkit-backdrop-filter: blur(22px) saturate(140%);
      box-shadow: 0 40px 80px -30px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.25);
      animation: rise 0.8s var(--ease) both;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      margin-block-end: 1.6rem;
    }
    .logo {
      inline-size: 46px;
      block-size: 46px;
      border-radius: 15px;
      display: grid;
      place-items: center;
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 1.4rem;
      background: var(--grad);
      box-shadow: var(--glow);
    }
    .brand strong {
      display: block;
      font-family: var(--font-display);
      font-size: 1.1rem;
      line-height: 1.1;
    }
    .brand small {
      color: rgba(255, 255, 255, 0.65);
      font-size: 0.76rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h1 {
      color: #fff;
      font-size: 1.85rem;
    }
    .lead {
      color: rgba(255, 255, 255, 0.72);
      margin-block: 0.5rem 1.6rem;
      font-size: 0.95rem;
    }
    form {
      display: grid;
      gap: 1.1rem;
    }
    .field {
      display: grid;
      gap: 0.4rem;
    }
    label {
      font-size: 0.82rem;
      font-weight: 650;
      color: rgba(255, 255, 255, 0.85);
    }
    .control {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding-inline: 1rem 0.4rem;
      min-block-size: 52px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.08);
      border: 1.5px solid rgba(255, 255, 255, 0.18);
      color: rgba(255, 255, 255, 0.7);
      transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
    }
    .control:focus-within {
      border-color: var(--p-300);
      background: rgba(255, 255, 255, 0.14);
      box-shadow: 0 0 0 4px rgba(63, 203, 116, 0.2);
      color: #fff;
    }
    .control input {
      flex: 1;
      min-inline-size: 0;
      background: none;
      border: 0;
      outline: none;
      color: #fff;
      padding-block: 0.8rem;
    }
    .control input::placeholder {
      color: rgba(255, 255, 255, 0.38);
    }
    .control input:-webkit-autofill {
      -webkit-text-fill-color: #fff;
      transition: background-color 9999s;
    }
    .eye {
      inline-size: 42px;
      block-size: 42px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      color: rgba(255, 255, 255, 0.7);
    }
    .eye:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
    }
    .error {
      display: flex;
      gap: 0.6rem;
      align-items: flex-start;
      padding: 0.8rem 1rem;
      border-radius: 14px;
      background: rgba(255, 90, 31, 0.16);
      border: 1px solid rgba(255, 140, 90, 0.45);
      color: #ffdcc8;
      font-size: 0.9rem;
      animation: shake 0.4s;
    }
    .error app-icon {
      margin-block-start: 2px;
    }
    @keyframes shake {
      20%,
      60% {
        transform: translateX(-5px);
      }
      40%,
      80% {
        transform: translateX(5px);
      }
    }
    .go {
      background: #fff;
      color: var(--p-700);
      box-shadow: 0 14px 30px -10px rgba(0, 0, 0, 0.5);
      margin-block-start: 0.3rem;
    }
    .go:hover {
      background: var(--p-50);
      transform: translateY(-2px);
    }
    .go .spinner {
      border-color: var(--p-200);
      border-top-color: var(--p-600);
    }
    .foot {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.4rem;
      margin-block-start: 1.4rem;
      font-size: 0.78rem;
      color: rgba(255, 255, 255, 0.55);
    }
  `,
})
export class AdminLoginPage {
  private auth = inject(AdminAuthService);
  private router = inject(Router);
  private settings = inject(SiteSettingsService);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly show = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.auth.restore().subscribe((ok) => {
      if (ok) this.router.navigateByUrl('/admin/dashboard');
    });
  }

  protected title(): string {
    return this.settings.settings()?.site_title || 'Boutique';
  }

  protected initial(): string {
    return this.title().trim().charAt(0).toUpperCase() || 'N';
  }

  protected val(ev: Event): string {
    return inputValue(ev);
  }

  protected canSubmit(): boolean {
    return this.email().trim().length > 0 && this.password().length > 0;
  }

  protected submit(ev: Event): void {
    ev.preventDefault();
    if (this.loading() || !this.canSubmit()) return;
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(this.email().trim(), this.password()).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigateByUrl('/admin/dashboard');
      },
      error: (e: unknown) => {
        this.loading.set(false);
        this.password.set('');
        this.error.set(this.explain(e));
      },
    });
  }

  private explain(e: unknown): string {
    if (e instanceof HttpErrorResponse) {
      if (e.status === 401) return 'Identifiants invalides';
      if (e.status === 429) {
        const retry = Number(e.headers.get('Retry-After'));
        const hint = retry > 0 ? ` Réessayez dans environ ${Math.max(1, Math.ceil(retry / 60))} min.` : ' Réessayez dans quelques minutes.';
        return `Trop de tentatives de connexion : accès temporairement bloqué.${hint}`;
      }
      if (e.status === 422) return 'Adresse e-mail ou mot de passe invalide.';
    }
    return errorMessage(e, 'Connexion impossible. Réessayez.');
  }
}
