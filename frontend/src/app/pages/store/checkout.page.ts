import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CartService } from '../../core/services/cart.service';
import { OrderService } from '../../core/services/order.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { IconComponent } from '../../shared/components/icon.component';
import { MediaComponent } from '../../shared/components/media.component';
import { LocPipe, MoneyPipe, TPipe } from '../../shared/pipes/i18n.pipes';

/** Mirrors the backend rule: Moroccan mobile/landline, with or without +212. */
export function moroccanPhone(control: AbstractControl): ValidationErrors | null {
  const raw = String(control.value ?? '').replace(/[\s.\-()]/g, '');
  return /^(?:\+212|00212|0)[5-7]\d{8}$/.test(raw) ? null : { phone: true };
}

@Component({
  selector: 'app-checkout',
  imports: [ReactiveFormsModule, RouterLink, IconComponent, MediaComponent, TPipe, LocPipe, MoneyPipe],
  templateUrl: './checkout.page.html',
  styleUrl: './checkout.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutPage {
  protected cart = inject(CartService);
  private orders = inject(OrderService);
  private router = inject(Router);
  protected i18n = inject(I18nService);
  private fb = inject(FormBuilder);

  protected submitting = signal(false);
  protected serverError = signal<string | null>(null);
  protected submitted = signal(false);

  protected form = this.fb.nonNullable.group({
    customer_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    phone_number: ['', [Validators.required, moroccanPhone]],
    email: ['', [Validators.email, Validators.maxLength(255)]],
    address_line_1: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(300)]],
    address_line_2: ['', [Validators.maxLength(300)]],
    city: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    postal_code: ['', [Validators.maxLength(20)]],
    customer_note: ['', [Validators.maxLength(500)]],
    consent: [false, [Validators.requiredTrue]],
  });

  protected empty = computed(() => this.cart.isEmpty());

  constructor() {
    // Always show server-side prices on the checkout screen.
    effect(() => {
      if (!this.cart.isEmpty() && !this.cart.quote()) this.cart.refresh();
    });
  }

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || this.submitted());
  }

  protected submit(): void {
    this.submitted.set(true);
    this.serverError.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting() || this.cart.isEmpty()) return;
    if (!this.cart.allAvailable()) {
      this.serverError.set(this.i18n.t('checkout.err.cart'));
      return;
    }

    const v = this.form.getRawValue();
    this.submitting.set(true);
    this.orders
      .place({
        customer_name: v.customer_name,
        phone_number: v.phone_number,
        email: v.email || null,
        address_line_1: v.address_line_1,
        address_line_2: v.address_line_2 || null,
        city: v.city,
        postal_code: v.postal_code || null,
        customer_note: v.customer_note || null,
        payment_method: 'CASH_ON_DELIVERY',
        consent: v.consent,
        items: this.cart.entries().map((e) => ({ product_id: e.product_id, quantity: e.quantity, option: e.option })),
      })
      .subscribe({
        next: (order) => {
          this.cart.clear();
          this.submitting.set(false);
          // Only the order number travels in navigation state — no personal data in the URL or storage.
          this.router.navigate(['/commande/confirmation'], { state: { order } });
        },
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          if (err.status === 429) this.serverError.set(this.i18n.t('checkout.err.rate'));
          else if (err.status === 400 && typeof err.error?.detail === 'string') {
            this.serverError.set(err.error.detail);
            this.cart.refresh();
          } else this.serverError.set(this.i18n.t('common.error'));
        },
      });
  }
}
