import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { Party, BankAccount as Bank, Transaction, Company } from '../types';

// Extend jsPDF with autotable
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export const generatePartyStatement = (
  company: Company,
  party: Party,
  transactions: Transaction[]
) => {
  const doc = new jsPDF() as jsPDFWithAutoTable;
  const dateStr = format(new Date(), 'dd-MM-yyyy');

  // Header
  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59); // Slate-900 
  const companyNameWidth = doc.getTextWidth(company.name);
  doc.text(company.name, (doc.internal.pageSize.getWidth() - companyNameWidth) / 2, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  const companyAddressWidth = doc.getTextWidth(company.address || '');
  doc.text(company.address || '', (doc.internal.pageSize.getWidth() - companyAddressWidth) / 2, 28);
  
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.line(14, 35, doc.internal.pageSize.getWidth() - 14, 35);

  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  const title = 'Party Statement';
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (doc.internal.pageSize.getWidth() - titleWidth) / 2, 45);
  
  doc.setFontSize(12);
  doc.setTextColor(79, 70, 229); // Indigo-600
  const partyHeadline = `Party: ${party.name}`;
  const partyWidth = doc.getTextWidth(partyHeadline);
  doc.text(partyHeadline, (doc.internal.pageSize.getWidth() - partyWidth) / 2, 55);

  doc.setFontSize(10);
  doc.setTextColor(100);
  if (party.phone) {
    const phoneText = `Phone: ${party.phone}`;
    const phoneWidth = doc.getTextWidth(phoneText);
    doc.text(phoneText, (doc.internal.pageSize.getWidth() - phoneWidth) / 2, 62);
  }

  // Table
  let runningBalance = party.opening_balance || 0;
  
  const openingBalanceRow = {
    date: '-',
    description: 'Opening Balance (Initial)',
    debit: '-',
    credit: '-',
    balance: runningBalance.toFixed(2)
  };

  const tableData = [
    openingBalanceRow,
    ...transactions
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((t) => {
        let debit = 0;
        let credit = 0;
        
        const isDebit = (t.type === 'Sale' || t.type === 'Payment Out' || t.type === 'Bank To Party' || t.to_party_id === party.id);
        const isCredit = (t.type === 'Purchase' || t.type === 'Payment In' || t.type === 'Expense' || t.type === 'Party To Bank' || t.type === 'Party To Party');

        if (isDebit) {
          debit = t.amount;
          runningBalance += t.amount;
        }
        if (isCredit) {
          credit = t.amount;
          runningBalance -= t.amount;
        }
        
        return {
          date: format(new Date(t.date), 'dd-MM-yyyy'),
          description: t.description || t.type.replace(/_/g, ' '),
          debit: debit > 0 ? `${debit.toFixed(2)} DR` : '-',
          credit: credit > 0 ? `${credit.toFixed(2)} CR` : '-',
          balance: runningBalance.toFixed(2)
        };
      })
  ];

  doc.autoTable({
    startY: 75,
    head: [['Date', 'Description', 'Debit/DR', 'Credit/CR', 'Balance']],
    body: tableData.map(row => [row.date, row.description, row.debit, row.credit, row.balance]),
    headStyles: { fillStyle: 'F', fillColor: [67, 56, 202] }, // Indigo-700
    alternateRowStyles: { fillColor: [245, 243, 255] }, // Indigo-50
    margin: { top: 75 },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 75;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  
  doc.text(`Sub-Total Debit: ${transactions.reduce((s, t) => (t.type === 'Sale' || t.type === 'Payment Out' || t.type === 'Bank To Party' || t.to_party_id === party.id) ? s + t.amount : s, 0).toFixed(2)}`, 14, finalY + 12);
  doc.text(`Sub-Total Credit: ${transactions.reduce((s, t) => (t.type === 'Purchase' || t.type === 'Payment In' || t.type === 'Expense' || t.type === 'Party To Bank' || t.type === 'Party To Party') ? s + t.amount : s, 0).toFixed(2)}`, 14, finalY + 19);
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229);
  doc.text(`Final Balance: ${company.currency} ${party.balance.toFixed(2)}`, 14, finalY + 35);

  doc.save(`${party.name}_Statement_${dateStr}.pdf`);
};

export const generateBankStatement = (
  company: Company,
  bank: Bank,
  transactions: Transaction[],
  summary?: { cashInHand: number; totalBankBalance: number }
) => {
  const doc = new jsPDF() as jsPDFWithAutoTable;
  const dateStr = format(new Date(), 'dd-MM-yyyy');

  // Header
  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59);
  const companyNameWidth = doc.getTextWidth(company.name);
  doc.text(company.name, (doc.internal.pageSize.getWidth() - companyNameWidth) / 2, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  const companyAddressWidth = doc.getTextWidth(company.address || '');
  doc.text(company.address || '', (doc.internal.pageSize.getWidth() - companyAddressWidth) / 2, 28);
  
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 35, doc.internal.pageSize.getWidth() - 14, 35);

  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  const title = 'Bank Statement';
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (doc.internal.pageSize.getWidth() - titleWidth) / 2, 45);
  
  doc.setFontSize(12);
  doc.setTextColor(79, 70, 229);
  const bankHeadline = `Bank: ${bank.name}`;
  const bankWidth = doc.getTextWidth(bankHeadline);
  doc.text(bankHeadline, (doc.internal.pageSize.getWidth() - bankWidth) / 2, 55);

  doc.setFontSize(10);
  doc.setTextColor(100);
  if (bank.account_number) {
    const acText = `Account: ${bank.account_number}`;
    const acWidth = doc.getTextWidth(acText);
    doc.text(acText, (doc.internal.pageSize.getWidth() - acWidth) / 2, 62);
  }

  // Table
  let runningBalance = bank.opening_balance || 0;

  const openingBalanceRow = {
    date: '-',
    description: 'Opening Balance (Initial)',
    debit: '-',
    credit: '-',
    balance: runningBalance.toFixed(2)
  };

  const tableData = [
    openingBalanceRow,
    ...transactions
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((t) => {
        let debit = 0;
        let credit = 0;
        
        const isCredit = (t.to_bank_id === bank.id) || (t.bank_id === bank.id && (t.type === 'Payment In' || t.type === 'Sale' || t.type === 'Party To Bank' || t.type === 'Deposit'));
        const isDebit = (t.bank_id === bank.id && (t.type === 'Payment Out' || t.type === 'Purchase' || t.type === 'Expense' || t.type === 'Bank To Party' || t.type === 'Withdraw' || t.type === 'Bank To Bank'));

        if (isCredit) {
          credit = t.amount;
          runningBalance += t.amount;
        }
        if (isDebit) {
          debit = t.amount;
          runningBalance -= t.amount;
        }
        
        return {
          date: format(new Date(t.date), 'dd-MM-yyyy'),
          description: t.description || t.type.replace(/_/g, ' '),
          debit: debit > 0 ? `${debit.toFixed(2)} DR` : '-',
          credit: credit > 0 ? `${credit.toFixed(2)} CR` : '-',
          balance: runningBalance.toFixed(2)
        };
      })
  ];

  doc.autoTable({
    startY: 75,
    head: [['Date', 'Description', 'Withdrawal/DR', 'Deposit/CR', 'Balance']],
    body: tableData.map(row => [row.date, row.description, row.debit, row.credit, row.balance]),
    headStyles: { fillStyle: 'F', fillColor: [67, 56, 202] },
    alternateRowStyles: { fillColor: [245, 243, 255] },
    margin: { top: 75 },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 75;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  
  doc.text(`Sub-Total Withdrawal: ${transactions.reduce((s, t) => (t.bank_id === bank.id && (t.type === 'Payment Out' || t.type === 'Purchase' || t.type === 'Expense' || t.type === 'Bank To Party' || t.type === 'Withdraw' || t.type === 'Bank To Bank')) ? s + t.amount : s, 0).toFixed(2)}`, 14, finalY + 12);
  doc.text(`Sub-Total Deposit: ${transactions.reduce((s, t) => (t.to_bank_id === bank.id) || (t.bank_id === bank.id && (t.type === 'Payment In' || t.type === 'Sale' || t.type === 'Party To Bank' || t.type === 'Deposit')) ? s + t.amount : s, 0).toFixed(2)}`, 14, finalY + 19);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229);
  doc.text(`Final Balance: ${company.currency} ${bank.balance.toFixed(2)}`, 14, finalY + 30);

  if (summary) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Cash in Hand: ${company.currency} ${summary.cashInHand.toFixed(2)}`, 14, finalY + 42);
    doc.text(`Total Bank Balances: ${company.currency} ${summary.totalBankBalance.toFixed(2)}`, 14, finalY + 48);
  }

  doc.save(`${bank.name}_Statement_${dateStr}.pdf`);
};
