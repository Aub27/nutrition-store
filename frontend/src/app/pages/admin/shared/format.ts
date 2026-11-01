const TZ_SUFFIX = /(Z|[+-]\d{2}:?\d{2})$/;

/** The API serialises UTC datetimes; naive strings are treated as UTC. */
export function parseDate(iso: string): Date {
  return new Date(TZ_SUFFIX.test(iso) ? iso : `${iso}Z`);
}

export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '';
  const diff = Math.round((now - parseDate(iso).getTime()) / 1000);
  if (Number.isNaN(diff)) return '';
  if (diff < 45) return "à l'instant";
  const min = Math.round(diff / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `il y a ${d} j`;
  return formatDate(iso);
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const longDayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortDayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

export const formatDate = (iso: string): string => dateFmt.format(parseDate(iso));
export const formatDateTime = (iso: string): string => dateTimeFmt.format(parseDate(iso));
export const formatTime = (iso: string): string => timeFmt.format(parseDate(iso));
export const formatLongDay = (d: Date): string => longDayFmt.format(d);
export const dayKey = (iso: string): string => parseDate(iso).toDateString();

/** `YYYY-MM-DD` (already a calendar day, no timezone shift). */
export function formatChartDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return shortDayFmt.format(new Date(y, m - 1, d));
}

export function formatDayMonth(day: string): string {
  const [, m, d] = day.split('-');
  return `${d}/${m}`;
}

const numFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
export const formatNumber = (n: number): string => numFmt.format(n);
export const formatMoney = (n: number): string => `${numFmt.format(n)} DH`;
export const formatCompact = (n: number): string =>
  n >= 1000 ? `${numFmt.format(Math.round(n / 100) / 10)} k` : numFmt.format(Math.round(n));

export const digitsOnly = (v: string): string => v.replace(/\D/g, '');

/** wa.me link built from digits only; Moroccan local numbers (06…) get the +212 prefix. */
export function whatsappHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = digitsOnly(phone);
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `212${digits.slice(1)}`;
  return digits.length >= 8 && digits.length <= 15 ? `https://wa.me/${digits}` : null;
}

export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned.length >= 6 ? `tel:${cleaned}` : null;
}

const EMAIL_RE = /^[^\s@<>"',;:]+@[^\s@<>"',;:]+\.[^\s@<>"',;:]+$/;
export const isEmail = (v: string): boolean => EMAIL_RE.test(v.trim());

export function mailHref(email: string | null | undefined, subject?: string | null): string | null {
  if (!email || !isEmail(email)) return null;
  return `mailto:${email.trim()}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
}

/** Mirrors the backend slugify() so the preview matches what gets stored. */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[-\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Empty/blank input → null so optional API fields are cleared properly. */
export const orNull = (v: string): string | null => (v.trim() ? v.trim() : null);

export const inputValue = (ev: Event): string =>
  (ev.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function checkImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return 'Format non pris en charge (JPEG, PNG ou WebP uniquement).';
  if (file.size > MAX_IMAGE_BYTES) return 'Image trop lourde (5 Mo maximum).';
  return null;
}
