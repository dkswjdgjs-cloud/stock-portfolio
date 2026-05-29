import { Transaction, AccountHolding } from '../types';

export function calcHoldings(transactions: Transaction[], accountFilter: string = '전체'): AccountHolding[] {
  const filtered = accountFilter === '전체'
    ? transactions
    : transactions.filter(t => t.account === accountFilter);

  const map = new Map<string, {
    account: string; ticker: string; stock_name: string;
    sector: string; currency: string; totalQuantity: number; totalCost: number;
  }>();

  filtered
    .filter(t => t.trade_type && t.ticker)
    .forEach(t => {
      const key = \`\${t.account}-\${t.ticker}\`;
      if (!map.has(key)) {
        map.set(key, {
          account: t.account,
          ticker: t.ticker!,
          stock_name: t.stock_name || '-',
          sector: t.sector || '-',
          currency: t.currency,
          totalQuantity: 0,
          totalCost: 0,
        });
      }
      const h = map.get(key)!;
      if (t.trade_type === '매수') {
        h.totalQuantity += t.quantity || 0;
        h.totalCost += (t.quantity || 0) * (t.buy_price || 0);
      } else if (t.trade_type === '매도') {
        h.totalQuantity -= t.quantity || 0;
        h.totalCost -= (t.quantity || 0) * (t.buy_price || 0);
      }
    });

  const activeHoldings = Array.from(map.values()).filter(h => h.totalQuantity > 0);
  const totalCost = activeHoldings.reduce((sum, h) => sum + h.totalCost, 0);

  return activeHoldings.map(h => {
    const avg_price = h.totalQuantity > 0 ? h.totalCost / h.totalQuantity : 0;
    const valuation = avg_price * h.totalQuantity;
    return {
      account: h.account, ticker: h.ticker, stock_name: h.stock_name,
      sector: h.sector, currency: h.currency, quantity: h.totalQuantity,
      avg_price, curr_price: 0, valuation, profit: 0, return_rate: 0,
      weight: totalCost > 0 ? (h.totalCost / totalCost) * 100 : 0,
      daily_change: 0,
    };
  });
}
