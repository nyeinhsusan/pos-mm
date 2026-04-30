/**
 * Myanmar Currency Denominations (in MMK)
 * Bills: 10,000 / 5,000 / 1,000 / 500 / 200 / 100 / 50
 * Coins: 50 / 25 / 10 / 5 / 1
 */
const MYANMAR_DENOMINATIONS = [
  { value: 10000, type: 'bill', label: '10,000' },
  { value: 5000, type: 'bill', label: '5,000' },
  { value: 1000, type: 'bill', label: '1,000' },
  { value: 500, type: 'bill', label: '500' },
  { value: 200, type: 'bill', label: '200' },
  { value: 100, type: 'bill', label: '100' },
  { value: 50, type: 'coin', label: '50' },
  { value: 25, type: 'coin', label: '25' },
  { value: 10, type: 'coin', label: '10' },
  { value: 5, type: 'coin', label: '5' },
  { value: 1, type: 'coin', label: '1' }
];

/**
 * Calculate denomination breakdown for change using greedy algorithm
 * @param {number} changeAmount - The change amount to break down
 * @returns {Object} - { breakdown: Array, displayText: string }
 */
export const calculateDenominationBreakdown = (changeAmount) => {
  if (changeAmount <= 0) {
    return { breakdown: [], displayText: 'No change' };
  }

  let remaining = Math.round(changeAmount);
  const breakdown = [];

  // Greedy algorithm: use largest denominations first
  for (const denomination of MYANMAR_DENOMINATIONS) {
    if (remaining >= denomination.value) {
      const count = Math.floor(remaining / denomination.value);
      remaining = remaining % denomination.value;

      breakdown.push({
        ...denomination,
        count
      });
    }
  }

  // Create display text: "1 × 1,000 + 2 × 500 + 1 × 100"
  const displayText = breakdown
    .map(item => `${item.count} × ${item.label}`)
    .join(' + ');

  return {
    breakdown,
    displayText: displayText || 'No change'
  };
};

/**
 * Format currency amount
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted amount (e.g., "1,000")
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Calculate change amount
 * @param {number} total - Sale total
 * @param {number} tendered - Amount tendered
 * @returns {Object} - { change, error }
 */
export const calculateChange = (total, tendered) => {
  const tenderedNum = parseFloat(tendered) || 0;
  const totalNum = parseFloat(total) || 0;

  if (tenderedNum < totalNum) {
    return {
      change: 0,
      error: 'Insufficient amount'
    };
  }

  return {
    change: tenderedNum - totalNum,
    error: null
  };
};
