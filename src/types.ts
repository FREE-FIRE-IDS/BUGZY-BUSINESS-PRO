export type PartyType = string;
export type TransactionType = 
  | 'Sale' 
  | 'Purchase' 
  | 'Payment In' 
  | 'Payment Out' 
  | 'Expense' 
  | 'Income'
  | 'Bank To Bank' 
  | 'Party To Party' 
  | 'Bank To Party' 
  | 'Party To Bank' 
  | 'Deposit' 
  | 'Withdraw'
  | 'Stock In'
  | 'Stock Out'
  | 'Cash Adjustment In'
  | 'Cash Adjustment Out';

export interface Subscription {
  plan: 'monthly' | 'yearly' | 'trial';
  start_date: string;
  end_date: string;
  status: 'active' | 'expired' | 'trial';
}

export interface Company {
  id: string;
  name: string;
  username?: string;
  address: string;
  logo_url?: string;
  currency: string;
  user_id: string;
  user_email?: string;
  trial_start?: string; // ISO date
  is_paid?: boolean;
  subscription?: Subscription;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
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
  opening_balance: number;
  balance: number;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
}

export interface BankAccount {
  id: string;
  company_id: string;
  name: string;
  account_number?: string;
  opening_balance: number;
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
  unit?: string;
  price: number;
  stock: number;
  opening_stock?: number;
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
  category?: string;
  party_id?: string;
  bank_id?: string;
  to_party_id?: string;
  to_bank_id?: string;
  item_id?: string;
  quantity?: number;
  payment_type?: 'Cash' | 'Bank' | 'Credit';
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
    unit?: string;
    price: number;
    total: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'Paid' | 'Unpaid' | 'Partial';
  type: 'Sale' | 'Purchase';
  payment_type: 'Cash' | 'Bank';
  bank_id?: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
}

export interface PaymentRequest {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  plan: string;
  amount: number;
  screenshot: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface License {
  id: string;
  user_id: string;
  license_key: string;
  status: 'active' | 'inactive';
  devices: string[];
  expiry_at?: string;
  created_at: string;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  currency: string;
  pdf_theme: string;
  sync_enabled: boolean;
  user_email?: string;
  is_verified?: boolean;
  verification_code?: string;
  onboarding_completed?: boolean;
  show_dr_cr?: boolean;
}
