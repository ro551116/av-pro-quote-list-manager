
export type Category = 'audio' | 'lighting' | 'led' | 'projection' | 'power' | 'stage' | 'crew' | 'effects';

export interface PeriodCharge {
  id: string;
  label: string;          // "活動日", "進場日", "夜間進場費"
  type: 'rate' | 'fixed'; // 百分比 or 固定金額
  value: number;          // rate: 1.0=100%, 0.85=85%; fixed: 5000
}

export interface Subcontract {
  id: string;
  vendorName: string;
  vendorTaxId: string;
  vendorContact: string;
  vendorPhone: string;
  handoverTime: string;
  itemIds: string[]; // references to project item IDs
}

export interface EquipmentItem {
  id: string;
  category: Category;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  note: string;
  days?: number;        // 檔期天數，預設 1
  costPrice?: number;   // 成本單價，預設 0
  // New fields for detailed list view
  internalOnly?: boolean; // If true, hides from Quote, shows on List
  subItems?: string[];    // Array of strings for accessories (e.g. ['HDMI Cable', 'Power Cord'])
}

export interface Project {
  id: string;
  name: string;
  client: string;
  date: string; // Main sorting date (YYYY-MM-DD)
  activityTime?: string; // E.g. "13:00-17:00"
  location: string;
  contact: string;

  // Added fields to match Quote Layout
  phone?: string;
  taxId?: string;
  moveInDate?: string;  // E.g. "2023-10-01 09:00"
  moveOutDate?: string; // E.g. "2023-10-01 18:00"

  period?: number; // 檔期（天數），保留向下相容
  periodCharges?: PeriodCharge[]; // 新：檔期費用陣列
  items: EquipmentItem[];
  subcontracts?: Subcontract[];
  taxRate: number; // e.g., 0.05 for 5%
  updatedAt: number;
}

export type ViewMode = 'dashboard' | 'editor' | 'preview_quote' | 'preview_list' | 'preview_subcontract';
