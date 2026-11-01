import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminNotification,
  AdminProduct,
  AuditLog,
  Category,
  ContactMessage,
  DashboardStats,
  Order,
  OrderStatus,
  Page,
  SiteSettings,
} from '../../shared/models';

/** Writable product/category payloads (what the admin forms send). */
export type ProductInput = Partial<
  Omit<AdminProduct, 'id' | 'created_at' | 'updated_at' | 'stock_status'>
>;
export type CategoryInput = Partial<Omit<Category, 'id' | 'product_count'>>;
export type SettingsInput = Partial<Omit<SiteSettings, 'supported_languages'>>;

/** Single entry point for every back-office call. Cookies + CSRF are added by apiInterceptor. */
@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin`;

  private params(obj: Record<string, string | number | boolean | undefined | null>): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    }
    return p;
  }

  // dashboard
  stats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.base}/dashboard/stats`);
  }

  // orders
  orders(filter: { status?: OrderStatus; q?: string; limit?: number } = {}): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.base}/orders`, { params: this.params(filter) });
  }
  setOrderStatus(id: number, status: Exclude<OrderStatus, 'NEW'>): Observable<Order> {
    return this.http.patch<Order>(`${this.base}/orders/${id}/status`, { status });
  }
  setOrderNote(id: number, admin_note: string | null): Observable<Order> {
    return this.http.patch<Order>(`${this.base}/orders/${id}/note`, { admin_note });
  }
  anonymizeOrder(id: number): Observable<Order> {
    return this.http.post<Order>(`${this.base}/orders/${id}/anonymize`, {});
  }

  // products
  products(
    f: { category_id?: number; is_active?: boolean; q?: string; low_stock?: boolean; page?: number; page_size?: number } = {},
  ): Observable<Page<AdminProduct>> {
    return this.http.get<Page<AdminProduct>>(`${this.base}/products`, { params: this.params(f) });
  }
  createProduct(data: ProductInput): Observable<AdminProduct> {
    return this.http.post<AdminProduct>(`${this.base}/products`, data);
  }
  updateProduct(id: number, data: ProductInput): Observable<AdminProduct> {
    return this.http.put<AdminProduct>(`${this.base}/products/${id}`, data);
  }
  quickUpdateProduct(
    id: number,
    data: { is_active?: boolean; stock_quantity?: number; track_stock?: boolean },
  ): Observable<AdminProduct> {
    return this.http.patch<AdminProduct>(`${this.base}/products/${id}`, data);
  }
  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/products/${id}`);
  }

  // categories
  categories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.base}/categories`);
  }
  createCategory(data: CategoryInput): Observable<Category> {
    return this.http.post<Category>(`${this.base}/categories`, data);
  }
  updateCategory(id: number, data: CategoryInput): Observable<Category> {
    return this.http.put<Category>(`${this.base}/categories/${id}`, data);
  }
  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/categories/${id}`);
  }
  reorderCategories(ids: number[]): Observable<void> {
    return this.http.put<void>(`${this.base}/categories/reorder`, { ids });
  }

  // notifications & messages
  notifications(f: { is_read?: boolean; limit?: number } = {}): Observable<AdminNotification[]> {
    return this.http.get<AdminNotification[]>(`${this.base}/notifications`, { params: this.params(f) });
  }
  markNotification(id: number, is_read: boolean): Observable<AdminNotification> {
    return this.http.patch<AdminNotification>(`${this.base}/notifications/${id}`, { is_read });
  }
  markAllNotificationsRead(): Observable<void> {
    return this.http.post<void>(`${this.base}/notifications/read-all`, {});
  }
  messages(f: { is_read?: boolean } = {}): Observable<ContactMessage[]> {
    return this.http.get<ContactMessage[]>(`${this.base}/messages`, { params: this.params(f) });
  }
  markMessage(id: number, is_read: boolean): Observable<ContactMessage> {
    return this.http.patch<ContactMessage>(`${this.base}/messages/${id}`, { is_read });
  }
  deleteMessage(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/messages/${id}`);
  }

  // settings, uploads, audit
  settings(): Observable<SiteSettings> {
    return this.http.get<SiteSettings>(`${this.base}/settings`);
  }
  updateSettings(data: SettingsInput): Observable<SiteSettings> {
    return this.http.put<SiteSettings>(`${this.base}/settings`, data);
  }
  upload(file: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ url: string }>(`${this.base}/uploads`, form);
  }
  auditLogs(limit = 100): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(`${this.base}/audit-logs`, { params: this.params({ limit }) });
  }
}
