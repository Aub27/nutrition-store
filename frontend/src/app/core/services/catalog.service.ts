import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Category, Goal, Page, Product, ProductQuery } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  categories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.base}/categories`);
  }

  category(slug: string): Observable<Category> {
    return this.http.get<Category>(`${this.base}/categories/${encodeURIComponent(slug)}`);
  }

  goals(): Observable<Goal[]> {
    return this.http.get<Goal[]>(`${this.base}/goals`);
  }

  brands(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/brands`);
  }

  products(query: ProductQuery = {}): Observable<Page<Product>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '' || value === false) continue;
      params = params.set(key, String(value));
    }
    return this.http.get<Page<Product>>(`${this.base}/products`, { params });
  }

  product(slug: string): Observable<Product> {
    return this.http.get<Product>(`${this.base}/products/${encodeURIComponent(slug)}`);
  }

  related(slug: string): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.base}/products/${encodeURIComponent(slug)}/related`);
  }
}
