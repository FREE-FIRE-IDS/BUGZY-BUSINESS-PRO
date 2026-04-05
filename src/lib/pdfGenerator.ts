import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { Party, Bank, Transaction, Company } from '../types';

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
  const tableData = transactions
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .reduce((acc: any[], t, index) => {
      const prevBalance = index === 0 ? 0 : acc[index - 1].balance;
      const isDebit = t.type === 'Payment Out' || t.type === 'Purchase';
      const isCredit = t.type === 'Payment In' || t.type === 'Sale';
      
      let debit = 0;
      let credit = 0;
      
      if (isDebit) debit = t.amount;
      if (isCredit) credit = t.amount;
      
      const balance = prevBalance + credit - debit;
      
      acc.push({
        date: format(new Date(t.date), 'dd-MM-yyyy'),
        description: t.description || t.type.replace('_', ' '),
        debit: debit > 0 ? debit.toFixed(2) : '-',
        credit: credit > 0 ? credit.toFixed(2) : '-',
        balance: balance.toFixed(2)
      });
      return acc;
    }, []);

  doc.autoTable({
    startY: 65,
    head: [['Date', 'Description', 'Debit', 'Credit', 'Balance']],
    body: tableData.map(row => [row.date, row.description, row.debit, row.credit, row.balance]),
    headStyles: { fillStyle: 'F', fillColor: [79, 70, 229] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { top: 65 },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 65;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Current Balance: ${company.currency} ${party.balance.toFixed(2)}`, 14, finalY + 15);

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
  const tableData = transactions
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .reduce((acc: any[], t, index) => {
      const prevBalance = index === 0 ? 0 : acc[index - 1].balance;
      
      // For bank, payment_in/sale is credit (increases balance)
      // payment_out/purchase/expense is debit (decreases balance)
      const isCredit = t.type === 'Payment In' || t.type === 'Sale' || (t.type === 'Bank To Bank' && t.to_bank_id === bank.id) || t.type === 'Deposit';
      const isDebit = t.type === 'Payment Out' || t.type === 'Purchase' || t.type === 'Expense' || (t.type === 'Bank To Bank' && t.bank_id === bank.id) || t.type === 'Withdraw';
      
      let debit = 0;
      let credit = 0;
      
      if (isDebit) debit = t.amount;
      if (isCredit) credit = t.amount;
      
      const balance = prevBalance + credit - debit;
      
      acc.push({
        date: format(new Date(t.date), 'dd-MM-yyyy'),
        description: t.description || t.type.replace('_', ' '),
        debit: debit > 0 ? debit.toFixed(2) : '-',
        credit: credit > 0 ? credit.toFixed(2) : '-',
        balance: balance.toFixed(2)
      });
      return acc;
    }, []);

  doc.autoTable({
    startY: 65,
    head: [['Date', 'Description', 'Debit', 'Credit', 'Balance']],
    body: tableData.map(row => [row.date, row.description, row.debit, row.credit, row.balance]),
    headStyles: { fillStyle: 'F', fillColor: [79, 70, 229] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { top: 65 },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 65;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Current Balance: ${company.currency} ${bank.balance.toFixed(2)}`, 14, finalY + 15);

  doc.save(`${bank.name}_Statement_${dateStr}.pdf`);
};
