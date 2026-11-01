import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

/** Promise-based replacement for window.confirm() that matches the design system. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly current = signal<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  ask(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => this.current.set({ ...options, resolve }));
  }

  answer(value: boolean): void {
    const c = this.current();
    this.current.set(null);
    c?.resolve(value);
  }
}
