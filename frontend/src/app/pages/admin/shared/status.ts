import { OrderStatus } from '../../../shared/models';

export interface StatusMeta {
  key: OrderStatus;
  label: string;
  column: string;
  color: string;
  soft: string;
  icon: string;
}

export const STATUS_META: Record<OrderStatus, StatusMeta> = {
  NEW: { key: 'NEW', label: 'Nouvelle', column: 'Nouvelles', color: '#7c3aed', soft: '#f1eaff', icon: 'sparkle' },
  CONFIRMED: { key: 'CONFIRMED', label: 'Confirmée', column: 'Confirmées', color: '#c026d3', soft: '#fdf0ff', icon: 'check' },
  WAITING_DELIVERY: { key: 'WAITING_DELIVERY', label: 'En livraison', column: 'En livraison', color: '#d97706', soft: '#fff6e0', icon: 'truck' },
  DELIVERED: { key: 'DELIVERED', label: 'Livrée', column: 'Livrées', color: '#0f9f5f', soft: '#e7fbf1', icon: 'package' },
  CANCELLED: { key: 'CANCELLED', label: 'Annulée', column: 'Annulées', color: '#7d7694', soft: '#f1eff5', icon: 'close' },
};

export const STATUS_ORDER: OrderStatus[] = ['NEW', 'CONFIRMED', 'WAITING_DELIVERY', 'DELIVERED', 'CANCELLED'];

export interface NextStep {
  status: Exclude<OrderStatus, 'NEW'>;
  label: string;
  short: string;
  icon: string;
}

export function nextStep(status: OrderStatus): NextStep | null {
  switch (status) {
    case 'NEW':
      return { status: 'CONFIRMED', label: 'Confirmer la commande', short: 'Confirmer', icon: 'check' };
    case 'CONFIRMED':
      return { status: 'WAITING_DELIVERY', label: 'Passer en livraison', short: 'Expédier', icon: 'truck' };
    case 'WAITING_DELIVERY':
      return { status: 'DELIVERED', label: 'Marquer comme livrée', short: 'Livrée', icon: 'package' };
    default:
      return null;
  }
}

export const canCancel = (status: OrderStatus): boolean =>
  status === 'NEW' || status === 'CONFIRMED' || status === 'WAITING_DELIVERY';

export const canAnonymize = (status: OrderStatus): boolean => status === 'DELIVERED' || status === 'CANCELLED';
