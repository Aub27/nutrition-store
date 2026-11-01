import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

/** `{{ 'key' | t }}` or `{{ 'key' | t: { n: 3 } }}`. Impure so it re-renders when the language signal changes. */
@Pipe({ name: 't', pure: false })
export class TPipe implements PipeTransform {
  private i18n = inject(I18nService);
  transform(key: string, params?: Record<string, string | number | null | undefined>): string {
    this.i18n.lang();
    return this.i18n.t(key, params);
  }
}

/** `{{ product | loc: 'name' }}` → name_ar when Arabic is active, else name_fr. */
@Pipe({ name: 'loc', pure: false })
export class LocPipe implements PipeTransform {
  private i18n = inject(I18nService);
  transform(obj: object | null | undefined, field: string): string {
    this.i18n.lang();
    return obj ? this.i18n.pick(obj, field) : '';
  }
}

/** `{{ '199.00' | money }}` → "199 DH" / "199,50 DH". */
@Pipe({ name: 'money', pure: false })
export class MoneyPipe implements PipeTransform {
  private i18n = inject(I18nService);
  transform(value: string | number | null | undefined): string {
    const lang = this.i18n.lang();
    const n = Number(value ?? 0);
    const text = n.toLocaleString(lang === 'ar' ? 'ar-MA-u-nu-latn' : 'fr-FR', {
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    });
    return `${text} ${this.i18n.t('common.currency')}`;
  }
}
