import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { formatMoney, formatNumber } from '../shared/format';

/** Number that counts up to its value (skipped when the user prefers reduced motion). */
@Component({
  selector: 'adm-count',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ text() }}`,
})
export class CountUpComponent {
  readonly value = input.required<number>();
  readonly kind = input<'int' | 'money'>('int');

  private readonly shown = signal(0);
  private raf = 0;
  protected readonly text = computed(() => {
    const v = Math.round(this.shown() * 100) / 100;
    return this.kind() === 'money' ? formatMoney(v) : formatNumber(Math.round(v));
  });

  constructor() {
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    effect(() => {
      const target = this.value();
      untracked(() => {
        cancelAnimationFrame(this.raf);
        const from = this.shown();
        if (reduced || from === target) {
          this.shown.set(target);
          return;
        }
        const start = performance.now();
        const duration = 900;
        const step = (now: number): void => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          this.shown.set(from + (target - from) * eased);
          if (t < 1) this.raf = requestAnimationFrame(step);
        };
        this.raf = requestAnimationFrame(step);
      });
    });
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.raf));
  }
}
