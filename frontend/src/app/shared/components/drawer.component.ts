import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';
import { IconComponent } from './icon.component';

/** Accessible slide-over panel used by the cart (storefront) and the editors (admin). */
@Component({
  selector: 'app-drawer',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="backdrop" (click)="closed.emit()"></div>
      <aside
        class="panel"
        [class.left]="side() === 'left'"
        [style.--w]="width()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="label()"
      >
        <header class="head">
          <ng-content select="[drawer-title]" />
          <button type="button" class="x" (click)="closed.emit()" aria-label="Close"><app-icon name="close" [size]="22" /></button>
        </header>
        <div class="body"><ng-content /></div>
        <footer class="foot"><ng-content select="[drawer-footer]" /></footer>
      </aside>
    }
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 900;
      background: rgba(20, 7, 42, 0.5);
      backdrop-filter: blur(4px);
      animation: fade 0.25s ease both;
    }
    .panel {
      position: fixed;
      z-index: 901;
      inset-block: 0;
      inset-inline-end: 0;
      width: min(var(--w, 440px), 100vw);
      background: #fff;
      display: flex;
      flex-direction: column;
      box-shadow: var(--sh-lg);
      animation: slide-in 0.4s var(--ease) both;
    }
    .panel.left {
      inset-inline-end: auto;
      inset-inline-start: 0;
      animation-name: slide-in-left;
    }
    :host-context([dir='rtl']) .panel {
      animation-name: slide-in-left;
    }
    :host-context([dir='rtl']) .panel.left {
      animation-name: slide-in;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.1rem 1.4rem;
      border-bottom: 1px solid var(--line);
    }
    .x {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      color: var(--muted);
      transition: background 0.2s, color 0.2s;
    }
    .x:hover {
      background: var(--p-50);
      color: var(--p-600);
    }
    .body {
      flex: 1;
      overflow-y: auto;
      padding: 1.2rem 1.4rem;
      overscroll-behavior: contain;
    }
    .foot:empty {
      display: none;
    }
    .foot {
      border-top: 1px solid var(--line);
      padding: 1.1rem 1.4rem;
      background: var(--bg);
    }
    @keyframes fade {
      from {
        opacity: 0;
      }
    }
    @keyframes slide-in {
      from {
        transform: translateX(100%);
      }
    }
    @keyframes slide-in-left {
      from {
        transform: translateX(-100%);
      }
    }
  `,
})
export class DrawerComponent {
  readonly open = input(false);
  readonly label = input('');
  readonly width = input('440px');
  readonly side = input<'left' | 'right'>('right');
  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.closed.emit();
  }
}
