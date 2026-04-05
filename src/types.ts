export type PartyType = string;
export type TransactionType = 
  | 'Sale' 
  | 'Purchase' 
  | 'Payment In' 
  | 'Payment Out' 
  | 'Expense' 
  | 'Bank To Bank' 
  | 'Party To Party' 
  | 'Bank To Party' 
  | 'Party To Bank' 
  | 'Deposit' 
  | 'Withdraw'
  | 'Stock In'
  | 'Stock Out';

export interface Company {
  id: string;
  name: string;
  address: string;
  logo_url?: string;
  currency: string;
  user_id: string;
  user_email?: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
  recovery_code?: string; // 4-word recovery code
  linked_emails?: string[]; // Emails of other accounts linked to this company
}

export interface Party {
  id: string;
  company_id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  type: PartyType;
  balance: number;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
}

export interface Bank {
  id: string;
  company_id: string;
  name: string;
  account_number?: string;
  balance: number;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
}

export interface InventoryItem {
  id: string;
  company_id: string;
  name: string;
  sku?: string;
  price: number;
  stock: number;
  low_stock_alert: number;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
}

export interface Transaction {
  id: string;
  company_id: string;
  date: string;
  type: TransactionType;
  amount: number;
  description?: string;
  party_id?: string;
  bank_id?: string;
  to_party_id?: string;
  to_bank_id?: string;
  item_id?: string;
  quantity?: number;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
}

export interface Invoice {
  id: string;
  company_id: string;
  invoice_number: string;
  date: string;
  due_date?: string;
  party_id: string;
  items: {
    item_id: string;
    name: string;
    quantity: number;
    price: number;
    total: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'Paid' | 'Unpaid' | 'Partial';
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  currency: string;
  pdf_theme: string;
  sync_enabled: boolean;
  user_email?: string;
  is_verified?: boolean;
  verification_code?: string;
}
