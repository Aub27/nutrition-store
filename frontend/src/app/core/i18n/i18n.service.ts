import { Injectable, signal } from '@angular/core';
import { Lang } from '../../shared/models';
import { TRANSLATIONS } from './translations';

const LANG_KEY = 'ns_lang';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly _lang = signal<Lang>(this.load());
  readonly lang = this._lang.asReadonly();

  constructor() {
    this.apply(this._lang());
  }

  setLang(lang: Lang): void {
    this._lang.set(lang);
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* storage may be blocked; language still switches for this session */
    }
    this.apply(lang);
  }

  toggle(): void {
    this.setLang(this._lang() === 'fr' ? 'ar' : 'fr');
  }

  t(key: string, params?: Record<string, string | number | null | undefined>): string {
    const entry = TRANSLATIONS[key];
    let text = entry ? (entry[this._lang()] ?? entry.fr) : key;
    if (params) {
      for (const [k, v] of Object.entries(params)) text = text.replace(`{${k}}`, v == null ? '' : String(v));
    }
    return text;
  }

  /** Picks `<field>_ar` when Arabic is active and filled in, otherwise falls back to French. */
  pick<T extends object>(obj: T, field: string): string {
    const rec = obj as Record<string, unknown>;
    const ar = rec[`${field}_ar`];
    const fr = rec[`${field}_fr`];
    if (this._lang() === 'ar' && typeof ar === 'string' && ar.trim()) return ar;
    return typeof fr === 'string' ? fr : '';
  }

  private apply(lang: Lang): void {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }

  private load(): Lang {
    try {
      return localStorage.getItem(LANG_KEY) === 'ar' ? 'ar' : 'fr';
    } catch {
      return 'fr';
    }
  }
}
