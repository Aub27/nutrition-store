import { ApplicationConfig, provideAppInitializer, provideBrowserGlobalErrorListeners, inject } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { catchError, of } from 'rxjs';

import { routes } from './app.routes';
import { apiInterceptor } from './core/interceptors/api.interceptor';
import { SiteSettingsService } from './core/services/site-settings.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    provideHttpClient(withInterceptors([apiInterceptor])),
    // Public settings (title, contact, delivery rules) are fetched once; the UI still renders if the call fails.
    provideAppInitializer(() => {
      const settings = inject(SiteSettingsService);
      return new Promise<void>((resolve) => {
        settings
          .load()
          .pipe(catchError(() => of(null)))
          .subscribe(() => resolve());
      });
    }),
  ],
};
