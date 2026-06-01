'use client';

import { useState, useEffect } from 'react';
import { X, TrendingUp, Info, Newspaper } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { AccountHolding } from '../types';

interface StockModalProps {
  holding: AccountHolding | null;
  onClose: () => void;
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const TABS = [
  { key: 'price', label: '시세', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { key: 'info', label: '종목정보', icon: <Info className="w-3.5 h-3.5" /> },
  { key: 'news', label: '뉴스·공시', icon: <Newspaper className="w-3.5 h-3.5" /> },
];

const PERIODS = [
  { label: '1개월', value: '1M' },
  { label: '6개월', value: '1Y' },
  { label: '3년', value: '3Y' },
];

export default function StockModal({ holding, onClose }: StockModalProps) {
  const [activeTab, setActiveTab] = useState('price');
  const [period, setPeriod] = useState('1M');
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [priceInfo, setPriceInfo] = useState<any>(null);
  const [stockInfo, setStockInfo] = useState<any>(null);
  const [infoLoading, setInfoLoading] = useState(false);

  const isPos = (v: number) => v >= 0;

  const formatCurrency = (v: number, currency = 'KRW') => {
    if (currency === 'USD') return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `${v.toLocaleString('ko-KR')}원`;
  };

  const formatPercent = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

  useEffect(() => {
    if (!holding || activeTab !== 'price') return;
    setChartLoading(true);
    const market = holding.currency === 'USD' ? 'US' : 'KR';
    fetch(`/api/stock-chart?ticker=${holding.ticker}&market=${market}&range=${period}`)
      .then(r => r.json())
      .then(data => {
        setChartData(data.chartData || []);
        if (data.chartData?.length > 0) {
          const last = data.chartData[data.chartData.length - 1];
          setPriceInfo(last);
        }
      })
      .finally(() => setChartLoading(false));
  }, [holding, period, activeTab]);

  useEffect(() => {
    if (!holding || activeTab !== 'info') return;
    if (holding.currency === 'USD') return;
    setInfoLoading(true);
    fetch(`/api/stock-info?ticker=${holding.ticker}&market=KR`)
      .then(r => r.json())
      .then(data => setStockInfo(data.info || null))
      .finally(() => setInfoLoading(false));
  }, [holding, activeTab]);


  if (!holding) return null;

  const dailyChangeRate = holding.curr_price > 0
    ? (holding.daily_change / (holding.curr_price - holding.daily_change)) * 100
    : 0;

  const formatDate = (d: string) => {
    if (!d) return '';
    return `${d.slice(0,4)}.${d.slice(4,6)}.${d.slice(6,8)}`;
  };

  const minClose = chartData.length > 0 ? Math.min(...chartData.map(d => d.close)) : 0;
  const maxClose = chartData.length > 0 ? Math.max(...chartData.map(d => d.close)) : 0;
  const isChartPos = chartData.length > 1
    ? chartData[chartData.length - 1].close >= chartData[0].close
    : true;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl border border-gray-200 w-[900px] max-h-[90vh] overflow-hidden flex flex-col">

        {/* 헤더 */}
        <div className="px-8 pt-6 pb-4 border-b border-gray-200 flex items-start justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xl font-medium text-[#1a1a1a]">{holding.stock_name}</span>
              <span className="text-xs text-[#999999] bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">
                {holding.ticker} · {holding.currency === 'USD' ? '해외' : '국내'}
              </span>
              {holding.sector && holding.sector !== '-' && (
                <span className="text-xs text-[#999999] bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">
                  {holding.sector}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-semibold text-[#1a1a1a]">
                {formatCurrency(holding.curr_price, holding.currency)}
              </span>
              <span className={cn('text-base font-medium', isPos(holding.daily_change) ? 'text-emerald-600' : 'text-red-500')}>
                {isPos(holding.daily_change) ? '▲' : '▼'} {formatCurrency(Math.abs(holding.daily_change), holding.currency)}
                <span className="ml-1">({formatPercent(dailyChangeRate)})</span>
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-[#999999] hover:text-[#1a1a1a] transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-gray-200 px-8 flex-shrink-0">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.key
                  ? 'text-blue-600 border-blue-600'
                  : 'text-[#999999] border-transparent hover:text-[#333333]'
              )}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* 탭 컨텐츠 */}
        <div className="flex-1 overflow-y-auto">

          {/* 시세 탭 */}
          {activeTab === 'price' && (
            <div className="flex" style={{minHeight: '420px'}}>
              <div className="flex-1 p-6 border-r border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-[#999999]">기간</span>
                  {PERIODS.map(p => (
                    <button key={p.value} onClick={() => setPeriod(p.value)}
                      className={cn(
                        'text-xs px-3 py-1 rounded border transition-colors',
                        period === p.value
                          ? 'border-blue-500 text-blue-600 bg-blue-50'
                          : 'border-gray-200 text-[#666666] hover:border-blue-400'
                      )}>
                      {p.label}
                    </button>
                  ))}
                </div>

                {chartLoading ? (
                  <div className="h-48 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200 mb-4">
                    <span className="text-xs text-[#999999]">차트 로딩 중...</span>
                  </div>
                ) : chartData.length > 0 ? (
                  <div className="mb-4">
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#999' }}
                          tickFormatter={formatDate}
                          interval={Math.floor(chartData.length / 5)} />
                        <YAxis tick={{ fontSize: 10, fill: '#999' }}
                          domain={[minClose * 0.98, maxClose * 1.02]}
                          tickFormatter={(v) => holding.currency === 'USD' ? `$${v.toFixed(0)}` : `${(v/1000).toFixed(0)}k`} />
                        <Tooltip
                          contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                          formatter={(v: any) => [formatCurrency(v, holding.currency), '종가']}
                          labelFormatter={(d: any) => formatDate(String(d))} />
                        <Line type="monotone" dataKey="close" stroke={isChartPos ? '#10b981' : '#ef4444'}
                          strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200 mb-4">
                    <span className="text-xs text-[#999999]">차트 데이터 없음</span>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: '시가', value: priceInfo ? formatCurrency(priceInfo.open, holding.currency) : '-' },
                    { label: '고가', value: priceInfo ? formatCurrency(priceInfo.high, holding.currency) : '-' },
                    { label: '저가', value: priceInfo ? formatCurrency(priceInfo.low, holding.currency) : '-' },
                    { label: '거래량', value: priceInfo ? priceInfo.volume.toLocaleString() : '-' },
                  ].map(item => (
                    <div key={item.label} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="text-xs text-[#999999] mb-1.5">{item.label}</div>
                      <div className="text-sm font-medium text-[#1a1a1a]">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-56 p-6 flex-shrink-0">
                <div className="text-xs text-[#999999] tracking-wider mb-4">내 보유 현황</div>
                <div className="space-y-3 mb-6">
                  {[
                    { label: '보유 수량', value: `${holding.quantity}주` },
                    { label: '평균 단가', value: formatCurrency(holding.avg_price, holding.currency) },
                    { label: '평가 금액', value: formatCurrency(holding.valuation) },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between items-center">
                      <span className="text-xs text-[#999999]">{item.label}</span>
                      <span className="text-sm text-[#1a1a1a]">{item.value}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 pt-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-[#999999]">평가 손익</span>
                      <span className={cn('text-sm font-medium', isPos(holding.profit) ? 'text-emerald-600' : 'text-red-500')}>
                        {formatCurrency(holding.profit)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-[#999999]">수익률</span>
                      <span className={cn('text-lg font-medium', isPos(holding.return_rate) ? 'text-emerald-600' : 'text-red-500')}>
                        {formatPercent(holding.return_rate)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-[#999999] tracking-wider mb-3">계좌</div>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#999999]">{holding.account}</span>
                    <span className="text-xs font-medium text-[#1a1a1a]">{holding.quantity}주</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 종목정보 탭 */}
          {activeTab === 'info' && (
            <div className="flex" style={{minHeight: '420px'}}>
              <div className="flex-1 p-6 border-r border-gray-200">
                {infoLoading ? (
                  <div className="h-16 flex items-center justify-center text-xs text-[#999999] mb-6">데이터 로딩 중...</div>
                ) : (
                  <div className="grid grid-cols-3 gap-0 mb-6">
                    {[
                      { label: '시가총액', value: stockInfo?.mktCap || '-' },
                      { label: 'PER', value: stockInfo?.per || '-' },
                      { label: 'PBR', value: stockInfo?.pbr || '-' },
                    ].map((item, i) => (
                      <div key={item.label} className={cn('', i > 0 && 'pl-6 border-l border-gray-200')}>
                        <div className="text-xs text-[#999999] mb-1.5">{item.label}</div>
                        <div className="text-2xl font-medium text-[#1a1a1a]">{item.value}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t border-gray-200 mb-4" />
                <div className="space-y-0">
                  {[
                    { label: 'EPS', value: stockInfo?.eps || '-' },
                    { label: 'ROE', value: stockInfo?.roe || '-' },
                    { label: '부채비율', value: stockInfo?.debtRate || '-' },
                    { label: '매출 성장률 (YoY)', value: stockInfo?.salesGrowth || '-' },
                    { label: '배당수익률', value: stockInfo?.dvdRate || '-' },
                    { label: '거래량 (평균)', value: stockInfo?.avgVol || '-' },
                    { label: '업종', value: holding.sector !== '-' ? holding.sector : '-' },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between items-center py-3 border-b border-gray-100">
                      <span className="text-sm text-[#999999]">{item.label}</span>
                      <span className="text-sm text-[#1a1a1a]">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-56 p-6 flex-shrink-0">
                <div className="text-xs text-[#999999] tracking-wider mb-4">52주 가격 범위</div>
                <div className="mb-6">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-blue-500 font-medium">{stockInfo?.w52Low ? stockInfo.w52Low.toLocaleString()+'원' : '-'}</span>
                    <span className="text-[#1a1a1a] font-medium">{formatCurrency(holding.curr_price, holding.currency)}</span>
                    <span className="text-red-500 font-medium">{stockInfo?.w52High ? stockInfo.w52High.toLocaleString()+'원' : '-'}</span>
                  </div>
                  <div className="bg-gray-100 rounded h-1.5 relative">
                    {stockInfo?.w52High && stockInfo?.w52Low && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-[#1a1a1a]"
                        style={{ left: `${Math.min(Math.max(((holding.curr_price - stockInfo.w52Low) / (stockInfo.w52High - stockInfo.w52Low)) * 100, 0), 100)}%`, transform: 'translate(-50%, -50%)' }}
                      />
                    )}
                  </div>
                  <div className="flex justify-between text-xs text-[#999999] mt-1.5">
                    <span>최저</span><span>최고</span>
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-4">
                  <div className="text-xs text-[#999999] tracking-wider mb-3">내 매수단가 비교</div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-[#999999]">평균 단가</span>
                      <span className="text-sm font-medium text-[#1a1a1a]">{formatCurrency(holding.avg_price, holding.currency)}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-[#999999]">현재가</span>
                      <span className="text-sm font-medium text-[#1a1a1a]">{formatCurrency(holding.curr_price, holding.currency)}</span>
                    </div>
                    <div className="border-t border-gray-200 pt-2 flex justify-between items-baseline">
                      <span className="text-xs text-[#999999]">평가 손익률</span>
                      <span className={cn('text-lg font-medium', isPos(holding.return_rate) ? 'text-emerald-600' : 'text-red-500')}>
                        {formatPercent(holding.return_rate)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 뉴스 탭 */}
          {activeTab === 'news' && (
            <div className="p-6" style={{minHeight: '420px'}}>
              {holding.currency === 'USD' ? (
                <div className="flex flex-col items-center justify-center h-48 text-[#999999]">
                  <Newspaper className="w-8 h-8 mb-3 opacity-30" />
                  <p className="text-sm">해외 종목은 뉴스를 제공하지 않습니다</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-[#999999]">
                  <Newspaper className="w-8 h-8 mb-3 opacity-30" />
                  <p className="text-sm">뉴스 기능은 준비 중입니다</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
