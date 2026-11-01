import { Injectable, signal } from '@angular/core';

/** Tiny UI state shared by the storefront shell (cart drawer, mobile menu). */
@Injectable({ providedIn: 'root' })
export class UiService {
  readonly cartOpen = signal(false);
  readonly menuOpen = signal(false);

  openCart(): void {
    this.menuOpen.set(false);
    this.cartOpen.set(true);
  }

  closeCart(): void {
    this.cartOpen.set(false);
  }

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  closeAll(): void {
    this.cartOpen.set(false);
    this.menuOpen.set(false);
  }
}
