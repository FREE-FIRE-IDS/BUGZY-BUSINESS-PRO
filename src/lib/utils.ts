import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'PKR') {
  if (currency === 'None') return amount.toLocaleString();
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: currency === 'PKR' ? 'PKR' : 'USD',
  }).format(amount);
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
