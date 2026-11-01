import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CartLineInput, OrderConfirmation, OrderCreate, Quote } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private http = inject(HttpClient);

  quote(items: CartLineInput[]): Observable<Quote> {
    return this.http.post<Quote>(`${environment.apiUrl}/cart/quote`, { items });
  }

  place(order: OrderCreate): Observable<OrderConfirmation> {
    return this.http.post<OrderConfirmation>(`${environment.apiUrl}/orders`, order);
  }

  contact(payload: {
    name: string;
    email?: string | null;
    phone?: string | null;
    subject?: string | null;
    message: string;
    consent: boolean;
    website?: string;
  }): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(`${environment.apiUrl}/contact`, payload);
  }
}
