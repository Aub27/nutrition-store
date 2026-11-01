import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminAuthService } from '../services/admin-auth.service';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * - Sends the HttpOnly session cookie with every API call (`withCredentials`).
 * - Adds the CSRF header (kept in memory only, never in localStorage) to admin mutations.
 * - Never attaches credentials to third-party URLs.
 * - On 401 from the admin API, drops the local session and returns to the login page.
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);

  const isApi = req.url.startsWith(environment.apiUrl);
  if (!isApi) return next(req);

  const isAdmin = req.url.includes('/admin/');
  let request = req.clone({ withCredentials: true });
  const csrf = auth.csrfToken();
  if (isAdmin && csrf && !SAFE.has(req.method)) {
    request = request.clone({ setHeaders: { 'X-CSRF-Token': csrf } });
  }

  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      const isAuthEndpoint = req.url.includes('/admin/auth/login') || req.url.includes('/admin/auth/me');
      if (isAdmin && err.status === 401 && !isAuthEndpoint) {
        auth.clearLocal();
        router.navigate(['/admin/login']);
      }
      return throwError(() => err);
    }),
  );
};
