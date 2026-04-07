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
  doc.setFontSize(20);
  doc.setTextColor(79, 70, 229); // Indigo-600
  doc.text(company.name, 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(company.address || '', 14, 28);
  
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text('Party Statement', 14, 45);
  
  doc.setFontSize(10);
  doc.text(`Party: ${party.name}`, 14, 52);
  doc.text(`Phone: ${party.phone || 'N/A'}`, 14, 57);
  doc.text(`Date: ${dateStr}`, 160, 52);

  // Table
  let runningBalance = 0;
  const tableData = transactions
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((t) => {
      let debit = 0;
      let credit = 0;
      
      // Party Perspective:
      // Debit (Increase Balance/Receivable): Sale, Payment Out (to supplier), Bank To Party, Party To Party (destination)
      // Credit (Decrease Balance/Payable): Purchase, Payment In (from customer), Party To Bank, Party To Party (source)
      
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
    });

  const totalDebit = transactions.reduce((sum, t) => {
    const isDebit = (t.type === 'Sale' || t.type === 'Payment Out' || t.type === 'Bank To Party' || t.to_party_id === party.id);
    return isDebit ? sum + t.amount : sum;
  }, 0);

  const totalCredit = transactions.reduce((sum, t) => {
    const isCredit = (t.type === 'Purchase' || t.type === 'Payment In' || t.type === 'Expense' || t.type === 'Party To Bank' || t.type === 'Party To Party');
    return isCredit ? sum + t.amount : sum;
  }, 0);

  doc.autoTable({
    startY: 65,
    head: [['Date', 'Description', 'Debit/DR', 'Credit/CR', 'Balance']],
    body: tableData.map(row => [row.date, row.description, row.debit, row.credit, row.balance]),
    headStyles: { fillStyle: 'F', fillColor: [79, 70, 229] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { top: 65 },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 65;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Debit: ${totalDebit.toFixed(2)} DR`, 14, finalY + 10);
  doc.text(`Total Credit: ${totalCredit.toFixed(2)} CR`, 14, finalY + 17);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Current Balance: ${company.currency} ${party.balance.toFixed(2)}`, 14, finalY + 27);

  doc.save(`${party.name}_Statement_${dateStr}.pdf`);
};

export const generateBankStatement = (
  company: Company,
  bank: Bank,
  transactions: Transaction[]
) => {
  const doc = new jsPDF() as jsPDFWithAutoTable;
  const dateStr = format(new Date(), 'dd-MM-yyyy');

  // Header
  doc.setFontSize(20);
  doc.setTextColor(79, 70, 229);
  doc.text(company.name, 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(company.address || '', 14, 28);
  
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text('Bank Statement', 14, 45);
  
  doc.setFontSize(10);
  doc.text(`Bank: ${bank.name}`, 14, 52);
  doc.text(`Account: ${bank.account_number || 'N/A'}`, 14, 57);
  doc.text(`Date: ${dateStr}`, 160, 52);

  // Table
  let runningBalance = 0;
  const tableData = transactions
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((t) => {
      let debit = 0;
      let credit = 0;
      
      // Bank Perspective:
      // Credit (Increase Balance/Deposit): Payment In, Sale, Party To Bank, Bank To Bank (destination), Deposit
      // Debit (Decrease Balance/Withdrawal): Payment Out, Purchase, Expense, Bank To Party, Bank To Bank (source), Withdraw
      
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
    });

  const totalDebit = transactions.reduce((sum, t) => {
    const isDebit = (t.bank_id === bank.id && (t.type === 'Payment Out' || t.type === 'Purchase' || t.type === 'Expense' || t.type === 'Bank To Party' || t.type === 'Withdraw' || t.type === 'Bank To Bank'));
    return isDebit ? sum + t.amount : sum;
  }, 0);

  const totalCredit = transactions.reduce((sum, t) => {
    const isCredit = (t.to_bank_id === bank.id) || (t.bank_id === bank.id && (t.type === 'Payment In' || t.type === 'Sale' || t.type === 'Party To Bank' || t.type === 'Deposit'));
    return isCredit ? sum + t.amount : sum;
  }, 0);

  doc.autoTable({
    startY: 65,
    head: [['Date', 'Description', 'Debit/DR', 'Credit/CR', 'Balance']],
    body: tableData.map(row => [row.date, row.description, row.debit, row.credit, row.balance]),
    headStyles: { fillStyle: 'F', fillColor: [79, 70, 229] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { top: 65 },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 65;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Debit: ${totalDebit.toFixed(2)} DR`, 14, finalY + 10);
  doc.text(`Total Credit: ${totalCredit.toFixed(2)} CR`, 14, finalY + 17);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Current Balance: ${company.currency} ${bank.balance.toFixed(2)}`, 14, finalY + 27);

  doc.save(`${bank.name}_Statement_${dateStr}.pdf`);
};
