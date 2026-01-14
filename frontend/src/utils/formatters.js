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

  if (phaseUpper === 'WIN') return '#22c55e'; // green
  if (phaseUpper === 'VS') return '#eab308'; // yellow
  if (phaseUpper === 'F1') return '#3b82f6'; // blue

  // For numbered phases (1, 2, 3, etc.)
  return '#8b5cf6'; // purple
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
  return maxDrawdownAmount - currentDrawdown;
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

  // Sort by P/L (ascending)
  eligibleAccounts.sort((a, b) => a.profitLoss - b.profitLoss);

  // Create VS groups map
  const vsGroups = {};
  const assigned = new Set();
  let groupId = 1;

  // Pair accounts with similar P/L values
  for (let i = 0; i < eligibleAccounts.length; i++) {
    if (assigned.has(eligibleAccounts[i].account_number)) continue;

    // Find the closest unassigned account
    let closestIndex = -1;
    let closestDiff = Infinity;

    for (let j = i + 1; j < eligibleAccounts.length; j++) {
      if (assigned.has(eligibleAccounts[j].account_number)) continue;

      const diff = Math.abs(eligibleAccounts[j].profitLoss - eligibleAccounts[i].profitLoss);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIndex = j;
      }
    }

    // If we found a pair, assign the same group ID
    if (closestIndex !== -1) {
      vsGroups[eligibleAccounts[i].account_number] = groupId;
      vsGroups[eligibleAccounts[closestIndex].account_number] = groupId;
      assigned.add(eligibleAccounts[i].account_number);
      assigned.add(eligibleAccounts[closestIndex].account_number);
      groupId++;
    }
  }

  return vsGroups;
};
