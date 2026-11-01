import { Injectable, inject, signal } from '@angular/core';
import { AdminApiService } from '../../../core/services/admin-api.service';

/** Counters shown in the sidebar; pages call refresh() after changing orders or messages. */
@Injectable({ providedIn: 'root' })
export class AdminBadgesService {
  private api = inject(AdminApiService);

  readonly newOrders = signal(0);
  readonly unreadMessages = signal(0);

  refresh(): void {
    this.api.stats().subscribe({
      next: (s) => {
        this.newOrders.set(s.by_status.NEW ?? 0);
        this.unreadMessages.set(s.unread_messages ?? 0);
      },
      error: () => undefined,
    });
  }
}
