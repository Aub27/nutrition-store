import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { SiteSettingsService } from './site-settings.service';

const FALLBACK_NAME = 'Warmode Nutrition';

/**
 * Browser tab titles: "<page> — <shop name>" for titled routes, "<shop name> — <tagline>" on the home page.
 * Pages that set their own title (e.g. the product page) are left alone.
 */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private title = inject(Title);
  private settings = inject(SiteSettingsService).settings;

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const site = this.settings()?.site_title || FALLBACK_NAME;
    const path = snapshot.url.split(/[?#]/)[0];

    if (path === '/') {
      const tagline = this.settings()?.tagline_fr || 'Nutrition sportive premium';
      this.title.setTitle(`${site} — ${tagline}`);
      return;
    }
    const page = this.buildTitle(snapshot);
    if (page) this.title.setTitle(`${page} — ${site}`);
  }
}
