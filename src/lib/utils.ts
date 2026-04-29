import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getTransactionLabel(type: string) {
  switch (type) {
    case 'Deposit':
    case 'Cash Deposit':
      return 'Cash Deposit';
    case 'Withdraw':
    case 'Cash Withdraw':
      return 'Cash Withdraw';
    case 'Cash Adjustment In':
      return 'Adjust Cash (In)';
    case 'Cash Adjustment Out':
      return 'Reduce Cash (Out)';
    default:
      return type;
  }
}

export function formatCurrency(amount: number, currency: string = 'PKR') {
  if (currency === 'None') return amount.toLocaleString();
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: currency === 'PKR' ? 'PKR' : 'USD',
  }).format(amount);
}

export function formatBalance(amount: number, currency: string = 'PKR', showDrCr: boolean = false) {
  const absAmount = Math.abs(amount);
  const formatted = formatCurrency(absAmount, currency);
  
  if (!showDrCr) return formatted;
  
  if (amount >= 0) return `${formatted} Dr`;
  return `${formatted} Cr`;
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (num === 0) return 'Zero';

  function convertLessThanThousand(n: number): string {
    let res = '';
    if (n >= 100) {
      res += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      res += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      res += ones[n] + ' ';
    }
    return res;
  }

  let word = '';
  let n = Math.floor(Math.abs(num));

  if (n >= 10000000) {
    word += convertLessThanThousand(Math.floor(n / 10000000)) + 'Crore ';
    n %= 10000000;
  }
  if (n >= 100000) {
    word += convertLessThanThousand(Math.floor(n / 100000)) + 'Lakh ';
    n %= 100000;
  }
  if (n >= 1000) {
    word += convertLessThanThousand(Math.floor(n / 1000)) + 'Thousand ';
    n %= 1000;
  }
  word += convertLessThanThousand(n);

  return word.trim();
}
