export interface Transaction {
  id: string;
  trade_date: string;
  account: string;
  account_transfer: string | null;
  transfer_amount: number | null;
  ticker: string | null;
  stock_name: string | null;
  sector: string | null;
  trade_type: string | null;
  quantity: number | null;
  buy_price: number | null;
  sell_price: number | null;
  profit_loss: number | null;
  profit_rate: number | null;
  currency: string;
  memo: string | null;
  created_at: string;
}

export interface AccountHolding {
  account: string;
  ticker: string;
  stock_name: string;
  sector: string;
  quantity: number;
  avg_price: number;
  curr_price: number;
  valuation: number;
  profit: number;
  return_rate: number;
  weight: number;
  daily_change: number;
  daily_change_rate?: number;
  exchangeRate?: number;
  currency: string;
}
