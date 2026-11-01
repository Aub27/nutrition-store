import { HttpErrorResponse } from '@angular/common/http';

const FIELD_LABELS: Record<string, string> = {
  name_fr: 'Nom',
  name_ar: 'Nom (arabe)',
  slug: 'Identifiant (slug)',
  brand: 'Marque',
  goal: 'Objectif',
  category_id: 'Catégorie',
  price: 'Prix',
  compare_at_price: 'Prix barré',
  stock_quantity: 'Stock',
  short_description_fr: 'Description courte',
  short_description_ar: 'Description courte (arabe)',
  full_description_fr: 'Description complète',
  full_description_ar: 'Description complète (arabe)',
  options: 'Variantes',
  option_label: 'Libellé des variantes',
  image_url: 'Image',
  site_title: 'Nom de la boutique',
  contact_phone: 'Téléphone',
  contact_email: 'E-mail',
  instagram_url: 'Lien Instagram',
  facebook_url: 'Lien Facebook',
  delivery_fee: 'Frais de livraison',
  free_delivery_threshold: 'Seuil de livraison gratuite',
  email: 'E-mail',
  password: 'Mot de passe',
};

interface ValidationItem {
  msg?: string;
  loc?: (string | number)[];
}

function cleanMessage(msg: string): string {
  return msg.replace(/^Value error,\s*/i, '');
}

/** Turns any HTTP failure into a readable French sentence (FastAPI returns `detail` as string or list). */
export function errorMessage(err: unknown, fallback = 'Une erreur est survenue. Veuillez réessayer.'): string {
  if (!(err instanceof HttpErrorResponse)) return fallback;
  if (err.status === 0) return 'Impossible de joindre le serveur. Vérifiez votre connexion.';
  const body = err.error as { detail?: unknown } | null;
  const detail = body && typeof body === 'object' ? body.detail : undefined;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length) {
    return (detail as ValidationItem[])
      .slice(0, 3)
      .map((d) => {
        const field = d.loc && d.loc.length ? String(d.loc[d.loc.length - 1]) : '';
        const label = FIELD_LABELS[field];
        const msg = cleanMessage(d.msg ?? 'valeur invalide');
        return label ? `${label} : ${msg}` : msg;
      })
      .join(' · ');
  }
  switch (err.status) {
    case 401:
      return 'Session expirée. Veuillez vous reconnecter.';
    case 403:
      return 'Action refusée. Rechargez la page ou reconnectez-vous.';
    case 404:
      return 'Élément introuvable.';
    case 413:
      return 'Fichier trop volumineux.';
    case 415:
      return 'Format de fichier non pris en charge.';
    case 429:
      return 'Trop de requêtes. Réessayez dans quelques instants.';
    default:
      return err.status >= 500 ? 'Erreur du serveur. Réessayez dans un instant.' : fallback;
  }
}
