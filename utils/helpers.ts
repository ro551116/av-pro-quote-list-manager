import { EquipmentItem, PeriodCharge } from '../types';
import { DEFAULT_VALID_DAYS } from '../constants';

export const generateId = (): string => crypto.randomUUID();

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0 }).format(amount);
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(dateString);
  return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
};

export const formatQuoteValidity = (project: {
  validDays?: number;
  validUntil?: string;
}): string => {
  const until = (project.validUntil || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    return `本估價單有效期至 ${formatDate(until)}`;
  }
  const days = Number(project.validDays);
  const n = Number.isFinite(days) && days > 0 ? Math.floor(days) : DEFAULT_VALID_DAYS;
  return `本估價單有效期限 ${n} 天`;
};

export const formatQuoteTerms = (
  project: { validDays?: number; validUntil?: string; paymentMethod?: string },
  options?: { includeAttachment?: boolean },
): string => {
  const payment = (project.paymentMethod || '').trim();
  const parts = [
    '請確認後簽名或蓋章回傳本公司，此報價單簽認即視同合約書，若有任何疑問請與承辦業務確認',
    formatQuoteValidity(project),
  ];
  if (payment) parts.push(`付款方式：${payment}`);
  if (options?.includeAttachment) parts.push('詳細品項請參閱附件');
  return `${parts.join('，')}。`;
};

export const formatDateRange = (startDate?: string, endDate?: string): string => {
  if (!startDate) return '';
  if (!endDate || endDate === startDate) return formatDate(startDate);
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
};

export const formatPeriodChargeLabel = (charge: PeriodCharge): string => {
  const dateRange = formatDateRange(charge.startDate, charge.endDate);
  if (!dateRange) return charge.label;
  return charge.label ? `${charge.label} (${dateRange})` : dateRange;
};

/** 客報總價 = 數量 × 單價（單日） */
export const calcClientTotal = (item: EquipmentItem): number => {
  return item.quantity * item.price;
};

/** 成本總價 = 數量 × 成本單價（單日） */
export const calcCostTotal = (item: EquipmentItem): number => {
  return item.quantity * (item.costPrice || 0);
};

/** 利潤率% = (客報總價 - 成本總價) / 客報總價 × 100（單日） */
export const calcProfitMargin = (item: EquipmentItem): number => {
  const client = calcClientTotal(item);
  const cost = calcCostTotal(item);
  if (client === 0) return 0;
  return ((client - cost) / client) * 100;
};

/** 單日器材總價 = Σ calcClientTotal(非internalOnly項目) */
export const calcBaseSubtotal = (items: EquipmentItem[]): number => {
  return items
    .filter(item => !item.internalOnly)
    .reduce((sum, item) => sum + calcClientTotal(item), 0);
};

/** 單筆檔期費用金額 */
export const calcChargeAmount = (charge: PeriodCharge, baseSubtotal: number): number => {
  if (charge.type === 'rate') {
    return Math.round(baseSubtotal * charge.value);
  }
  return charge.value;
};

/** 檔期合計 = Σ calcChargeAmount(每筆charge) */
export const calcGrandSubtotal = (baseSubtotal: number, charges: PeriodCharge[]): number => {
  return charges.reduce((sum, charge) => sum + calcChargeAmount(charge, baseSubtotal), 0);
};
