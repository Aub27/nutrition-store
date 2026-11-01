import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from './icon.component';

/** Global overlay host: toasts + confirmation dialog. Mounted once in the root component. */
@Component({
  selector: 'app-overlays',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" aria-live="polite" aria-atomic="false">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [class]="'toast ' + t.type" role="status">
          <app-icon [name]="t.type === 'success' ? 'check' : t.type === 'error' ? 'alert' : 'sparkle'" [size]="18" [stroke]="2.4" />
          <span>{{ t.message }}</span>
          <button type="button" (click)="toast.dismiss(t.id)" aria-label="Close"><app-icon name="close" [size]="16" /></button>
        </div>
      }
    </div>

    @if (confirm.current(); as c) {
      <div class="cf-backdrop" (click)="confirm.answer(false)"></div>
      <div class="cf" role="alertdialog" aria-modal="true" [attr.aria-label]="c.title">
        <div class="cf-icon" [class.danger]="c.danger"><app-icon [name]="c.danger ? 'alert' : 'sparkle'" [size]="26" /></div>
        <h3>{{ c.title }}</h3>
        @if (c.message) {
          <p>{{ c.message }}</p>
        }
        <div class="cf-actions">
          <button type="button" class="btn btn-ghost" (click)="confirm.answer(false)">{{ c.cancelLabel ?? 'Annuler' }}</button>
          <button type="button" class="btn" [class.btn-danger]="c.danger" [class.btn-primary]="!c.danger" (click)="confirm.answer(true)">
            {{ c.confirmLabel ?? 'Confirmer' }}
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    .toasts {
      position: fixed;
      z-index: 1200;
      inset-block-end: 1.25rem;
      inset-inline-start: 50%;
      transform: translateX(-50%);
      display: grid;
      gap: 0.6rem;
      width: min(94vw, 420px);
      pointer-events: none;
    }
    .toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 0.7rem;
      padding: 0.85rem 1rem;
      border-radius: 16px;
      color: #fff;
      font-weight: 550;
      font-size: 0.92rem;
      background: var(--ink);
      box-shadow: var(--sh-lg);
      animation: pop 0.45s var(--ease) both;
    }
    .toast span {
      flex: 1;
    }
    .toast.success {
      background: linear-gradient(135deg, #1b0b3a, #3b1a7a);
      border: 1px solid rgba(217, 70, 239, 0.45);
    }
    .toast.success app-icon {
      color: #7dffb5;
    }
    .toast.error {
      background: #4a0f1d;
      border: 1px solid rgba(255, 90, 120, 0.5);
    }
    .toast button {
      color: rgba(255, 255, 255, 0.7);
      display: grid;
    }
    .cf-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1100;
      background: rgba(20, 7, 42, 0.55);
      backdrop-filter: blur(5px);
      animation: fade 0.2s both;
    }
    .cf {
      position: fixed;
      z-index: 1101;
      inset-block-start: 50%;
      inset-inline-start: 50%;
      transform: translate(-50%, -50%);
      width: min(92vw, 420px);
      background: #fff;
      border-radius: var(--r-lg);
      padding: 1.8rem;
      text-align: center;
      display: grid;
      gap: 0.6rem;
      justify-items: center;
      box-shadow: var(--sh-lg);
      animation: pop 0.35s var(--ease) both;
    }
    :host-context([dir='rtl']) .cf,
    :host-context([dir='rtl']) .toasts {
      transform: translate(50%, -50%);
    }
    :host-context([dir='rtl']) .toasts {
      transform: translateX(50%);
    }
    .cf-icon {
      width: 56px;
      height: 56px;
      border-radius: 18px;
      display: grid;
      place-items: center;
      background: var(--p-100);
      color: var(--p-600);
    }
    .cf-icon.danger {
      background: #ffe6ea;
      color: var(--danger);
    }
    .cf p {
      color: var(--muted);
    }
    .cf-actions {
      display: flex;
      gap: 0.7rem;
      margin-top: 0.8rem;
    }
    @keyframes pop {
      from {
        opacity: 0;
        translate: 0 14px;
        scale: 0.97;
      }
    }
    @keyframes fade {
      from {
        opacity: 0;
      }
    }
  `,
})
export class OverlaysComponent {
  protected toast = inject(ToastService);
  protected confirm = inject(ConfirmService);
}
