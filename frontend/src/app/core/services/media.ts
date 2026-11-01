import { environment } from '../../../environments/environment';

/** Turns `/media/x.webp` into an absolute URL when the API lives on another origin (dev). */
export function mediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('/media/')) return `${environment.mediaUrl}${url}`;
  if (url.startsWith('https://')) return url;
  return null; // anything else (javascript:, data:, http:) is never rendered
}
