import { apiGet } from '@/services/api';

export type EarningType = 'DELIVERY_EARNING' | 'CANCELLATION_COMPENSATION' | 'REVERSAL';
export type EarningStatus = 'PENDING' | 'AVAILABLE';

/** One driver ledger entry (delivery-service #145). Amounts are EGP decimal strings. */
export type EarningEntry = {
  id: string;
  deliveryId: string;
  orderId: string;
  type: EarningType;
  amount: string;
  status: EarningStatus;
  availableAt: string;
  createdAt: string;
};

/** GET /api/deliveries/me/earnings: totals computed by the backend from the ledger. */
export type DriverEarnings = {
  currency: 'EGP';
  pending: string;
  available: string;
  balance: string;
  settlementHours: number;
  entries: EarningEntry[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export function fetchMyEarnings(page = 1, limit = 20): Promise<DriverEarnings> {
  return apiGet<DriverEarnings>(`/api/deliveries/me/earnings?page=${page}&limit=${limit}`, true);
}
