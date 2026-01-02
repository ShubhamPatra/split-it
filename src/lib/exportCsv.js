import { jsPDF } from 'jspdf';
import { getCategoryById } from '../data/categories';

// CSV Download Helper
const downloadCsv = (csvContent, filename) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ==================== CSV EXPORTS ====================

export const exportExpensesToCsv = (expenses, groupName, getUserProfile) => {
  if (expenses.length === 0) return;

  const headers = ['Date', 'Description', 'Category', 'Amount', 'Paid By', 'Split Among'];
  
  const rows = expenses.map(expense => {
    const category = getCategoryById(expense.category);
    const paidByName = getUserProfile(expense.paidBy)?.name || 'Unknown';
    const splitAmongNames = expense.splitAmong.map(id => getUserProfile(id)?.name || 'Unknown').join('; ');
    
    return [
      expense.date,
      `"${expense.description.replace(/"/g, '""')}"`,
      category.name,
      expense.amount.toFixed(2),
      paidByName,
      `"${splitAmongNames}"`
    ].join(',');
  });

  const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  rows.push('');
  rows.push(`,,Total,${total.toFixed(2)},,`);

  const csvContent = [headers.join(','), ...rows].join('\n');
  const date = new Date().toISOString().split('T')[0];
  const sanitizedGroupName = groupName.replace(/[^a-zA-Z0-9]/g, '_');
  
  downloadCsv(csvContent, `${sanitizedGroupName}_expenses_${date}.csv`);
};

export const exportSettlementsToCsv = (settlements, groupName, getUserProfile) => {
  if (settlements.length === 0) return;

  const headers = ['Date', 'From', 'To', 'Amount'];
  
  const rows = settlements.map(settlement => {
    return [
      settlement.settledAt,
      getUserProfile(settlement.fromUserId)?.name || 'Unknown',
      getUserProfile(settlement.toUserId)?.name || 'Unknown',
      settlement.amount.toFixed(2)
    ].join(',');
  });

  const total = settlements.reduce((sum, s) => sum + s.amount, 0);
  rows.push('');
  rows.push(`,,Total,${total.toFixed(2)}`);

  const csvContent = [headers.join(','), ...rows].join('\n');
  const date = new Date().toISOString().split('T')[0];
  const sanitizedGroupName = groupName.replace(/[^a-zA-Z0-9]/g, '_');
  
  downloadCsv(csvContent, `${sanitizedGroupName}_settlements_${date}.csv`);
};

export const exportFullReportToCsv = (
  expenses, 
  settlements, 
  balances,
  groupName,
  getUserProfile
) => {
  const sections = [];
  const date = new Date().toISOString().split('T')[0];
  const sanitizedGroupName = groupName.replace(/[^a-zA-Z0-9]/g, '_');

  // Balances Summary Section
  sections.push('=== BALANCES SUMMARY ===');
  sections.push('Member,Balance');
  Object.entries(balances).forEach(([userId, balance]) => {
    const status = balance > 0 ? '(is owed)' : balance < 0 ? '(owes)' : '(settled)';
    sections.push(`${getUserProfile(userId)?.name || 'Unknown'},${balance.toFixed(2)} ${status}`);
  });
  sections.push('');

  // Expenses Section
  sections.push('=== EXPENSES ===');
  if (expenses.length > 0) {
    sections.push('Date,Description,Category,Amount,Paid By,Split Among');
    expenses.forEach(expense => {
      const category = getCategoryById(expense.category);
      const paidByName = getUserProfile(expense.paidBy)?.name || 'Unknown';
      const splitAmongNames = expense.splitAmong.map(id => getUserProfile(id)?.name || 'Unknown').join('; ');
      sections.push([
        expense.date,
        `"${expense.description.replace(/"/g, '""')}"`,
        category.name,
        expense.amount.toFixed(2),
        paidByName,
        `"${splitAmongNames}"`
      ].join(','));
    });
    const expenseTotal = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    sections.push(`,,Total Expenses,${expenseTotal.toFixed(2)},,`);
  } else {
    sections.push('No expenses recorded');
  }
  sections.push('');

  // Settlements Section
  sections.push('=== SETTLEMENTS ===');
  if (settlements.length > 0) {
    sections.push('Date,From,To,Amount');
    settlements.forEach(settlement => {
      sections.push([
        settlement.settledAt,
        getUserProfile(settlement.fromUserId)?.name || 'Unknown',
        getUserProfile(settlement.toUserId)?.name || 'Unknown',
        settlement.amount.toFixed(2)
      ].join(','));
    });
    const settlementTotal = settlements.reduce((sum, s) => sum + s.amount, 0);
    sections.push(`,,Total Settled,${settlementTotal.toFixed(2)}`);
  } else {
    sections.push('No settlements recorded');
  }

  const csvContent = sections.join('\n');
  downloadCsv(csvContent, `${sanitizedGroupName}_full_report_${date}.csv`);
};

// ==================== PDF EXPORTS ====================

export const exportExpensesToPdf = (expenses, groupName, getUserProfile) => {
  if (expenses.length === 0) return;

  const doc = new jsPDF();
  const date = new Date().toISOString().split('T')[0];

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`${groupName} - Expenses`, 14, 20);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);

  // Table
  let y = 40;
  doc.setFontSize(9);
  
  expenses.forEach((expense, index) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    const category = getCategoryById(expense.category);
    doc.text(`${expense.date} - ${expense.description}`, 14, y);
    doc.text(`${category.name} - ₹${expense.amount.toFixed(2)}`, 120, y);
    y += 7;
  });

  const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: ₹${total.toFixed(2)}`, 14, y);

  doc.save(`${groupName.replace(/[^a-zA-Z0-9]/g, '_')}_expenses_${date}.pdf`);
};

export const exportFullReportToPdf = (
  expenses, 
  settlements, 
  balances,
  groupName,
  getUserProfile
) => {
  const doc = new jsPDF();
  const date = new Date().toISOString().split('T')[0];
  const sanitizedGroupName = groupName.replace(/[^a-zA-Z0-9]/g, '_');

  // Title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(groupName, 14, 20);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Full Expense Report', 14, 28);
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 14, 35);

  let y = 50;

  // ===== BALANCES SUMMARY =====
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Balances Summary', 14, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  Object.entries(balances).forEach(([userId, balance]) => {
    const name = getUserProfile(userId)?.name || 'Unknown';
    const status = balance > 0 ? 'is owed' : balance < 0 ? 'owes' : 'settled';
    const color = balance > 0 ? [34, 197, 94] : balance < 0 ? [239, 68, 68] : [100, 100, 100];
    
    doc.setTextColor(0, 0, 0);
    doc.text(name, 14, y);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(`Rs ${Math.abs(balance).toFixed(0)} (${status})`, 80, y);
    y += 6;
  });

  y += 10;

  // ===== EXPENSES =====
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Expenses', 14, y);
  y += 8;

  if (expenses.length > 0) {
    const expHeaders = ['Date', 'Description', 'Category', 'Amount'];
    const expColWidths = [30, 70, 40, 40];

    // Header
    doc.setFillColor(59, 130, 246);
    doc.rect(14, y - 5, 180, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    
    let x = 14;
    expHeaders.forEach((header, i) => {
      doc.text(header, x + 2, y);
      x += expColWidths[i];
    });
    y += 7;

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    expenses.forEach((expense, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      if (index % 2 === 0) {
        doc.setFillColor(245, 247, 250);
        doc.rect(14, y - 4, 180, 6, 'F');
      }

      const category = getCategoryById(expense.category);
      const row = [
        expense.date,
        expense.description.substring(0, 30) + (expense.description.length > 30 ? '...' : ''),
        category.name,
        `Rs ${expense.amount.toLocaleString()}`
      ];

      x = 14;
      row.forEach((cell, i) => {
        doc.text(cell, x + 2, y);
        x += expColWidths[i];
      });
      y += 6;
    });

    const expenseTotal = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Expenses: Rs ${expenseTotal.toLocaleString()}`, 14, y);
  } else {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('No expenses recorded', 14, y);
  }

  y += 15;

  // ===== SETTLEMENTS =====
  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Settlements', 14, y);
  y += 8;

  if (settlements.length > 0) {
    const setHeaders = ['Date', 'Paid By', 'Paid To', 'Amount'];
    const setColWidths = [35, 50, 50, 45];

    // Header
    doc.setFillColor(34, 197, 94);
    doc.rect(14, y - 5, 180, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    
    let x = 14;
    setHeaders.forEach((header, i) => {
      doc.text(header, x + 2, y);
      x += setColWidths[i];
    });
    y += 7;

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    settlements.forEach((settlement, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      if (index % 2 === 0) {
        doc.setFillColor(245, 247, 250);
        doc.rect(14, y - 4, 180, 6, 'F');
      }

      const row = [
        settlement.settledAt,
        getUserProfile(settlement.fromUserId)?.name || 'Unknown',
        getUserProfile(settlement.toUserId)?.name || 'Unknown',
        `Rs ${settlement.amount.toLocaleString()}`
      ];

      x = 14;
      row.forEach((cell, i) => {
        doc.text(cell, x + 2, y);
        x += setColWidths[i];
      });
      y += 6;
    });

    const settlementTotal = settlements.reduce((sum, s) => sum + s.amount, 0);
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Settled: Rs ${settlementTotal.toLocaleString()}`, 14, y);
  } else {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('No settlements recorded', 14, y);
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(`Split-It | Page ${i} of ${pageCount}`, 14, 287);
  }

  doc.save(`${sanitizedGroupName}_full_report_${date}.pdf`);
};
