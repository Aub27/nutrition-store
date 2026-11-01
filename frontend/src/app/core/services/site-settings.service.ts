import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SiteSettings } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class SiteSettingsService {
  private http = inject(HttpClient);
  private readonly _settings = signal<SiteSettings | null>(null);
  readonly settings = this._settings.asReadonly();

  load(): Observable<SiteSettings> {
    return this.http
      .get<SiteSettings>(`${environment.apiUrl}/site-settings/public`)
      .pipe(tap((s) => this._settings.set(s)));
  }

  set(s: SiteSettings): void {
    this._settings.set(s);
  }
}
