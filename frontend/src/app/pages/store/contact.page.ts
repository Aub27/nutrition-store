import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { OrderService } from '../../core/services/order.service';
import { SiteSettingsService } from '../../core/services/site-settings.service';
import { ToastService } from '../../core/services/toast.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { IconComponent } from '../../shared/components/icon.component';
import { TPipe } from '../../shared/pipes/i18n.pipes';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-contact',
  imports: [ReactiveFormsModule, RouterLink, IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="head">
      <div class="container">
        <span class="eyebrow">{{ 'nav.contact' | t }}</span>
        <h1>{{ 'contact.title' | t }}</h1>
        <p class="muted">{{ 'contact.subtitle' | t }}</p>
      </div>
    </section>

    <div class="container grid">
      <aside class="info">
        @if (settings(); as s) {
          <a class="ic card" [href]="'tel:' + s.contact_phone.replace(' ', '')">
            <span class="ico"><app-icon name="phone" [size]="22" /></span>
            <span><small>{{ 'contact.phone' | t }}</small><strong>{{ s.contact_phone }}</strong></span>
          </a>
          <a class="ic card" [href]="'mailto:' + s.contact_email">
            <span class="ico"><app-icon name="mail" [size]="22" /></span>
            <span><small>{{ 'contact.email' | t }}</small><strong>{{ s.contact_email }}</strong></span>
          </a>
          @if (s.contact_address) {
            <div class="ic card">
              <span class="ico"><app-icon name="pin" [size]="22" /></span>
              <span><small>{{ 'contact.address' | t }}</small><strong>{{ s.contact_address }}</strong></span>
            </div>
          }
          @if (whatsapp(); as wa) {
            <a class="ic card wa" [href]="wa" target="_blank" rel="noopener noreferrer">
              <span class="ico"><app-icon name="whatsapp" [size]="22" /></span>
              <span><strong>{{ 'contact.whatsapp' | t }}</strong></span>
            </a>
          }
        }
      </aside>

      <form class="card form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (sent()) {
          <div class="ok">
            <div class="tick"><app-icon name="check" [size]="34" [stroke]="2.8" /></div>
            <p>{{ 'contact.sent' | t }}</p>
          </div>
        } @else {
          <div class="row">
            <div class="field">
              <label for="cn">{{ 'contact.name' | t }} *</label>
              <input id="cn" class="input" formControlName="name" maxlength="100" autocomplete="name" [class.is-invalid]="bad('name')" />
              @if (bad('name')) { <span class="field-error">{{ 'checkout.err.name' | t }}</span> }
            </div>
            <div class="field">
              <label for="ce">{{ 'contact.email' | t }}</label>
              <input id="ce" class="input" type="email" formControlName="email" autocomplete="email" [class.is-invalid]="bad('email')" />
              @if (bad('email')) { <span class="field-error">{{ 'checkout.err.email' | t }}</span> }
            </div>
          </div>
          <div class="row">
            <div class="field">
              <label for="cp">{{ 'contact.phone' | t }}</label>
              <input id="cp" class="input" type="tel" formControlName="phone" autocomplete="tel" maxlength="30" />
            </div>
            <div class="field">
              <label for="cs">{{ 'contact.subject' | t }}</label>
              <input id="cs" class="input" formControlName="subject" maxlength="150" />
            </div>
          </div>
          <div class="field">
            <label for="cm">{{ 'contact.message' | t }} *</label>
            <textarea id="cm" class="textarea" rows="6" formControlName="message" maxlength="2000" [class.is-invalid]="bad('message')"></textarea>
            @if (bad('message')) { <span class="field-error">{{ 'contact.err.message' | t }}</span> }
          </div>
          <!-- Honeypot: hidden from people, bots fill it and get silently dropped by the API. -->
          <div class="hp" aria-hidden="true"><label>Website <input tabindex="-1" autocomplete="off" formControlName="website" /></label></div>
          <label class="check">
            <input type="checkbox" formControlName="consent" />
            <span>{{ 'checkout.consent' | t }} <a routerLink="/confidentialite" target="_blank" class="lnk">{{ 'checkout.privacyLink' | t }}</a></span>
          </label>
          @if (bad('consent')) { <span class="field-error">{{ 'checkout.err.consent' | t }}</span> }
          @if (error()) { <div class="alert" role="alert">{{ error() }}</div> }
          <button class="btn btn-primary btn-lg" type="submit" [disabled]="sending()">
            @if (sending()) { <span class="spinner"></span> } @else { <app-icon name="arrow-right" [size]="18" /> }
            {{ 'contact.send' | t }}
          </button>
        }
      </form>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .head {
      background: var(--grad-soft);
      border-bottom: 1px solid var(--line);
      padding-block: 2.5rem;
    }
    h1 {
      font-size: clamp(2rem, 4.5vw, 3rem);
    }
    .grid {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 1.5rem;
      padding-block: 2.5rem 3rem;
      align-items: start;
    }
    .info {
      display: grid;
      gap: 1rem;
    }
    .ic {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.1rem 1.2rem;
      transition: transform 0.3s var(--ease), box-shadow 0.3s;
    }
    a.ic:hover {
      transform: translateY(-3px);
      box-shadow: var(--sh);
    }
    .ic span:last-child {
      display: grid;
      line-height: 1.3;
      min-width: 0;
    }
    .ic small {
      color: var(--muted);
      font-weight: 600;
    }
    .ic strong {
      overflow-wrap: anywhere;
    }
    .ico {
      width: 50px;
      height: 50px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      background: var(--grad);
      color: #fff;
      flex: none;
      box-shadow: var(--glow);
    }
    .ic.wa .ico {
      background: linear-gradient(135deg, #25d366, #0fa958);
    }
    .form {
      padding: 1.8rem;
      display: grid;
      gap: 1.1rem;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    .hp {
      position: absolute;
      inset-inline-start: -9999px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    }
    .lnk {
      color: var(--p-600);
      font-weight: 650;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .alert {
      padding: 0.85rem 1rem;
      border-radius: 14px;
      background: #ffe6ea;
      color: #a3132b;
      font-weight: 600;
    }
    .ok {
      display: grid;
      gap: 1rem;
      justify-items: center;
      text-align: center;
      padding: 2rem 0;
    }
    .tick {
      width: 72px;
      height: 72px;
      border-radius: 24px;
      display: grid;
      place-items: center;
      color: #fff;
      background: var(--grad);
      box-shadow: var(--glow);
    }
    @media (max-width: 860px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 560px) {
      .row {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class ContactPage {
  private api = inject(OrderService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  private i18n = inject(I18nService);
  protected settings = inject(SiteSettingsService).settings;

  protected sending = signal(false);
  protected sent = signal(false);
  protected error = signal<string | null>(null);
  private submitted = signal(false);

  protected form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    email: ['', [Validators.email]],
    phone: [''],
    subject: [''],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
    consent: [false, [Validators.requiredTrue]],
    website: [''],
  });

  protected whatsapp(): string | null {
    const digits = (this.settings()?.whatsapp_number ?? '').replace(/\D/g, '');
    return digits.length >= 8 ? `https://wa.me/${digits}` : null;
  }

  protected bad(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || this.submitted());
  }

  protected submit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.sending()) return;
    const v = this.form.getRawValue();
    this.sending.set(true);
    this.error.set(null);
    this.api
      .contact({
        name: v.name,
        email: v.email || null,
        phone: v.phone || null,
        subject: v.subject || null,
        message: v.message,
        consent: v.consent,
        website: v.website,
      })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.sent.set(true);
          this.toast.success(this.i18n.t('contact.sent'));
        },
        error: (err: HttpErrorResponse) => {
          this.sending.set(false);
          this.error.set(err.status === 429 ? this.i18n.t('checkout.err.rate') : this.i18n.t('common.error'));
        },
      });
  }
}
