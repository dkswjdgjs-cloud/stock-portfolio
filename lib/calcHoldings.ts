import { Transaction, AccountHolding } from '../types';

export function calcHoldings(transactions: Transaction[], accountFilter: string = '전체'): AccountHolding[] {
  // 계좌 필터 적용
  const filtered = accountFilter === '전체'
    ? transactions
    : transactions.filter(t => t.account === accountFilter);

  // 티커별 매수/매도 합산
  const map = new Map<string, {
    account: string;
    ticker: string;
    stock_name: string;
    sector: string;
    currency: string;
    totalQuantity: number;
    totalCost: number;
  }>();

  filtered
    .filter(t => t.trade_type && t.ticker)
    .forEach(t => {
      // 전체일 때는 티커만, 개별 계좌일 때는 계좌+티커로 구분
      const key = accountFilter === '전체'
        ? t.ticker!
        : `${t.account}-${t.ticker}`;

      if (!map.has(key)) {
        map.set(key, {
          account: accountFilter === '전체' ? '전체' : t.account,
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

  // 보유 중인 종목만 필터 (수량 > 0)
  const activeHoldings = Array.from(map.values()).filter(h => h.totalQuantity > 0);

  // 전체 매수금액 합산 (비중 계산용)
  const totalCost = activeHoldings.reduce((sum, h) => sum + h.totalCost, 0);

  return activeHoldings.map(h => {
    const avg_price = h.totalQuantity > 0 ? h.totalCost / h.totalQuantity : 0;
    const valuation = avg_price * h.totalQuantity; // 현재가 없으면 매수금액 기준

    return {
      account: h.account,
      ticker: h.ticker,
      stock_name: h.stock_name,
      sector: h.sector,
      currency: h.currency,
      quantity: h.totalQuantity,
      avg_price,
      curr_price: 0,       // 한투 API 연동 후 채워짐
      valuation,
      profit: 0,           // 한투 API 연동 후 채워짐
      return_rate: 0,      // 한투 API 연동 후 채워짐
      weight: totalCost > 0 ? (h.totalCost / totalCost) * 100 : 0,
      daily_change: 0,     // 한투 API 연동 후 채워짐
    };
  });
}
