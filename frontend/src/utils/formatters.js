export const formatCurrency = (value) => {
  const absValue = Math.abs(value);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(absValue);

  return value < 0 ? `-${formatted}` : formatted;
};

export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const getPhaseColor = (phase) => {
  const phaseUpper = String(phase).toUpperCase();

  if (phaseUpper === 'F1') return '#3b82f6'; // blue
  if (phaseUpper === 'F2') return '#8b5cf6'; // purple
  if (phaseUpper === 'R') return '#22c55e'; // green
  if (phaseUpper === 'Q') return '#ef4444'; // red (quemada/burned)

  // For any other phases
  return '#6b7280'; // gray
};

export const getStatusColor = (status) => {
  return status === 'connected' ? '#22c55e' : '#ef4444';
};

export const calculateProfitLoss = (balance, initialBalance) => {
  return balance - initialBalance;
};

export const calculateMaxLoss = (balance, initialBalance) => {
  const maxDrawdownAmount = initialBalance * 0.10; // 10% of initial balance
  const currentDrawdown = initialBalance - balance;
  const maxLoss = maxDrawdownAmount - currentDrawdown;
  return Math.min(maxLoss, 4000); // Cap at 4000
};

export const calculateProfitPercentage = (balance, initialBalance) => {
  if (initialBalance === 0) return 0;
  return ((balance - initialBalance) / initialBalance) * 100;
};

export const getRowBackgroundColor = (balance, initialBalance) => {
  const profitPercentage = calculateProfitPercentage(balance, initialBalance);

  if (profitPercentage > 8) {
    return '#dcfce7'; // Light green
  }

  if (profitPercentage <= -10) {
    return '#fca5a5'; // Red (accounts at -10% or worse)
  }

  return 'transparent';
};

export const calculateVSGroups = (accounts) => {
  // Calculate P/L for each account and create array with account info
  const accountsWithPL = accounts.map(account => ({
    account_number: account.account_number,
    profitLoss: calculateProfitLoss(account.balance, account.initial_balance || 100000),
    balance: account.balance,
    initial_balance: account.initial_balance || 100000,
    profitPercentage: calculateProfitPercentage(account.balance, account.initial_balance || 100000)
  }));

  // Filter out accounts that have already reached 8% profit or are at/over 10% in loss
  const eligibleAccounts = accountsWithPL.filter(account =>
    account.profitPercentage <= 8 && account.profitPercentage > -10
  );

  // Sort all eligible accounts by P/L (ascending)
  eligibleAccounts.sort((a, b) => a.profitLoss - b.profitLoss);

  // Create VS groups map
  const vsGroups = {};
  const assigned = new Set();
  let groupId = 1;

  // Helper function to pair accounts within a group
  const pairAccounts = (accountList) => {
    for (let i = 0; i < accountList.length; i++) {
      if (assigned.has(accountList[i].account_number)) continue;

      // Find the closest unassigned account
      let closestIndex = -1;
      let closestDiff = Infinity;

      for (let j = i + 1; j < accountList.length; j++) {
        if (assigned.has(accountList[j].account_number)) continue;

        const diff = Math.abs(accountList[j].profitLoss - accountList[i].profitLoss);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestIndex = j;
        }
      }

      // If we found a pair, assign the same group ID
      if (closestIndex !== -1) {
        vsGroups[accountList[i].account_number] = groupId;
        vsGroups[accountList[closestIndex].account_number] = groupId;
        assigned.add(accountList[i].account_number);
        assigned.add(accountList[closestIndex].account_number);
        groupId++;
      }
    }
  };

  // Pair all eligible accounts based on closest P/L similarity
  pairAccounts(eligibleAccounts);

  return vsGroups;
};

export const exportToExcel = (accounts) => {
  import('xlsx').then((XLSX) => {
    // Get current date for export
    const date = new Date();
    const dateStr = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Prepare data for Excel export with only specified columns
    const excelData = accounts.map((account) => {
      const initialBalance = account.initial_balance || 100000;
      const profitLoss = calculateProfitLoss(account.balance, initialBalance);
      const maxLoss = calculateMaxLoss(account.balance, initialBalance);
      const profitPercentage = calculateProfitPercentage(account.balance, initialBalance);

      return {
        'Account Number': account.account_number,
        'Days Operating': account.days_operating || 0,
        'Holder': account.account_holder || '',
        'Firm': account.prop_firm || '',
        'Balance': account.balance,
        'P/L': profitLoss,
        'P/L %': profitPercentage.toFixed(2) + '%',
        'Max Loss': maxLoss,
        'Phase': account.phase || ''
      };
    });

    // Create worksheet with export date header
    const worksheet = XLSX.utils.aoa_to_sheet([
      [`Export Date: ${dateStr}`],
      [],
      Object.keys(excelData[0])
    ]);

    // Add data starting from row 4
    XLSX.utils.sheet_add_json(worksheet, excelData, {
      origin: 'A4',
      skipHeader: true
    });

    // Set column widths
    const columnWidths = [
      { wch: 15 }, // Account Number
      { wch: 15 }, // Days Operating
      { wch: 20 }, // Holder
      { wch: 15 }, // Firm
      { wch: 12 }, // Balance
      { wch: 12 }, // P/L
      { wch: 10 }, // P/L %
      { wch: 12 }, // Max Loss
      { wch: 10 }  // Phase
    ];
    worksheet['!cols'] = columnWidths;

    // Create workbook and add worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Accounts');

    // Generate filename with current date
    const filenameDateStr = date.toISOString().split('T')[0];
    const filename = `accounts_${filenameDateStr}.xlsx`;

    // Save file
    XLSX.writeFile(workbook, filename);
  });
};
