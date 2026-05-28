import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const KIS_APP_KEY = process.env.KIS_APP_KEY!;
const KIS_APP_SECRET = process.env.KIS_APP_SECRET!;
const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';
let tokenCache: { token: string; expires: number } | null = null;
async function getAccessToken() {
  if (tokenCache && Date.now() < tokenCache.expires) return tokenCache.token;
  const res = await fetch(`${KIS_BASE_URL}/oauth2/tokenP`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'client_credentials',appkey:KIS_APP_KEY,appsecret:KIS_APP_SECRET})});
  const data = await res.json();
  tokenCache = {token:data.access_token,expires:Date.now()+(data.expires_in-60)*1000};
  return tokenCache.token;
}
async function getPrice(ticker: string, market: string): Promise<number> {
  try {
    const token = await getAccessToken();
    const isKR = market === 'KR';
    const url = isKR ? `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${ticker}` : `${KIS_BASE_URL}/uapi/overseas-price/v1/quotations/price?AUTH=&EXCD=NAS&SYMB=${ticker}`;
    const response = await fetch(url,{headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,appkey:KIS_APP_KEY,appsecret:KIS_APP_SECRET,tr_id:isKR?'FHKST01010100':'HHDFS00000300'}});
    const data = await response.json();
    return isKR ? parseFloat(data.output?.stck_prpr||'0') : parseFloat(data.output?.last||'0');
  } catch { return 0; }
}
export async function POST() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const {data:transactions} = await supabase.from('transactions').select('*');
    const {data:cashBalances} = await supabase.from('cash_balance').select('*');
    const {data:cashIncomes} = await supabase.from('cash_income').select('*');
    if (!transactions) return NextResponse.json({error:'No transactions'},{status:500});
    const holdingMap = new Map<string,{account:string;ticker:string;stock_name:string;currency:string;quantity:number;totalCost:number}>();
    transactions.filter(t=>t.trade_type&&t.ticker).forEach(t=>{
      const key=`${t.account}-${t.ticker}`;
      if(!holdingMap.has(key)) holdingMap.set(key,{account:t.account,ticker:t.ticker,stock_name:t.stock_name||'',currency:t.currency,quantity:0,totalCost:0});
      const h=holdingMap.get(key)!;
      if(t.trade_type==='매수'){h.quantity+=t.quantity||0;h.totalCost+=(t.quantity||0)*(t.buy_price||0);}
      else if(t.trade_type==='매도'){h.quantity-=t.quantity||0;h.totalCost-=(t.quantity||0)*(t.buy_price||0);}
    });
    const snapshots:any[]=[];
    let totalValuation=0;
    for(const h of holdingMap.values()){
      if(h.quantity<=0) continue;
      const market=h.currency==='USD'?'US':'KR';
      const currPrice=await getPrice(h.ticker,market);
      const avgPrice=h.quantity>0?h.totalCost/h.quantity:0;
      const valuation=currPrice*h.quantity;
      const profit=(currPrice-avgPrice)*h.quantity;
      const returnRate=avgPrice>0?((currPrice-avgPrice)/avgPrice)*100:0;
      totalValuation+=valuation;
      snapshots.push({snapshot_date:today,account:h.account,ticker:h.ticker,stock_name:h.stock_name,quantity:h.quantity,avg_price:avgPrice,curr_price:currPrice,valuation,profit,return_rate:returnRate,currency:h.currency,total_valuation:null,total_invested:null,total_profit:null});
    }
    if(cashBalances){
      cashBalances.forEach(cb=>{
        totalValuation+=cb.balance;
        snapshots.push({snapshot_date:today,account:cb.account,ticker:'CASH',stock_name:'현금성 자산',quantity:null,avg_price:null,curr_price:null,valuation:cb.balance,profit:0,return_rate:0,currency:'KRW',total_valuation:null,total_invested:null,total_profit:null});
      });
    }
    const totalInvested=transactions.filter(t=>t.account_transfer).reduce((sum,t)=>{const amount=t.transfer_amount||0;return t.account_transfer==='입금'?sum+amount:sum-amount;},0);
    const tradingProfit=transactions.filter(t=>t.trade_type==='매도').reduce((sum,t)=>sum+(t.profit_loss||0),0);
    const cashIncomeTotal=cashIncomes?cashIncomes.reduce((sum,c)=>sum+c.amount,0):0;
    const totalProfit=tradingProfit+cashIncomeTotal;
    snapshots.push({snapshot_date:today,account:'합계',ticker:'TOTAL',stock_name:'전체 합계',quantity:null,avg_price:null,curr_price:null,valuation:totalValuation,profit:totalProfit,return_rate:totalInvested>0?(totalProfit/totalInvested)*100:0,currency:'KRW',total_valuation:totalValuation,total_invested:totalInvested,total_profit:totalProfit});
    const {error}=await supabase.from('daily_snapshot').upsert(snapshots,{onConflict:'snapshot_date,account,ticker'});
    if(error) return NextResponse.json({error:error.message},{status:500});
    return NextResponse.json({success:true,date:today,count:snapshots.length});
  } catch(error){return NextResponse.json({error:String(error)},{status:500});}
}
