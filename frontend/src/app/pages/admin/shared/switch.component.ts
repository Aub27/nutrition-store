import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Accessible on/off switch. State lives in the parent (one-way in, event out) so rollbacks just work. */
@Component({
  selector: 'adm-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      role="switch"
      class="sw"
      [class.on]="checked()"
      [attr.aria-checked]="checked()"
      [attr.aria-label]="label()"
      [disabled]="disabled()"
      (click)="$event.stopPropagation(); toggled.emit(!checked())"
    >
      <span class="knob"></span>
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }
    .sw {
      position: relative;
      inline-size: 46px;
      block-size: 26px;
      border-radius: 999px;
      background: #d9d2ea;
      transition: background 0.25s, box-shadow 0.25s;
    }
    .sw.on {
      background: var(--grad);
      box-shadow: 0 6px 14px -6px rgba(147, 51, 234, 0.7);
    }
    .knob {
      position: absolute;
      inset-block-start: 3px;
      inset-inline-start: 3px;
      inline-size: 20px;
      block-size: 20px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 2px 4px rgba(20, 7, 42, 0.25);
      transition: transform 0.3s var(--ease);
    }
    .sw.on .knob {
      transform: translateX(20px);
    }
    :host-context([dir='rtl']) .sw.on .knob {
      transform: translateX(-20px);
    }
    .sw:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
})
export class SwitchComponent {
  readonly checked = input(false);
  readonly label = input('');
  readonly disabled = input(false);
  readonly toggled = output<boolean>();
}
