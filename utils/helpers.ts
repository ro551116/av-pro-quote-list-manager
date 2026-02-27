import { EquipmentItem, PeriodCharge } from '../types';

export const generateId = (): string => crypto.randomUUID();

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0 }).format(amount);
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
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
