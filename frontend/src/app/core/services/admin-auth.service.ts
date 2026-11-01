import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SessionInfo } from '../../shared/models';

/**
 * Admin session state. The JWT lives in an HttpOnly cookie that JavaScript cannot read, so an XSS bug
 * cannot steal it. The CSRF token is returned by the API and only kept in memory.
 */
@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/admin/auth`;

  private readonly _session = signal<SessionInfo | null>(null);
  private restored = false;

  readonly session = this._session.asReadonly();
  readonly isLoggedIn = computed(() => this._session() !== null);
  readonly adminName = computed(() => this._session()?.admin_name ?? '');
  readonly csrfToken = computed(() => this._session()?.csrf_token ?? null);

  login(email: string, password: string): Observable<SessionInfo> {
    return this.http.post<SessionInfo>(`${this.url}/login`, { email, password }).pipe(
      tap((s) => {
        this._session.set(s);
        this.restored = true;
      }),
    );
  }

  /** Called by the route guard on first load / page refresh. */
  restore(): Observable<boolean> {
    if (this._session()) return of(true);
    if (this.restored) return of(false);
    return this.http.get<SessionInfo>(`${this.url}/me`).pipe(
      tap((s) => this._session.set(s)),
      map(() => true),
      catchError(() => of(false)),
      tap(() => (this.restored = true)),
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.url}/logout`, {}).pipe(
      catchError(() => of(void 0)),
      tap(() => this.clearLocal()),
    );
  }

  logoutEverywhere(): Observable<void> {
    return this.http.post<void>(`${this.url}/logout-all`, {}).pipe(tap(() => this.clearLocal()));
  }

  changePassword(current_password: string, new_password: string): Observable<void> {
    return this.http
      .post<void>(`${this.url}/change-password`, { current_password, new_password })
      .pipe(tap(() => this.clearLocal()));
  }

  clearLocal(): void {
    this._session.set(null);
    this.restored = true;
  }
}
