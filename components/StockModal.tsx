'use client';

import { useState } from 'react';
import { X, TrendingUp, Info, Newspaper, RefreshCw } from 'lucide-react';
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

export default function StockModal({ holding, onClose }: StockModalProps) {
  const [activeTab, setActiveTab] = useState('price');

  if (!holding) return null;

  const isPos = (v: number) => v >= 0;

  const formatCurrency = (v: number, currency = 'KRW') => {
    if (currency === 'USD') return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `${v.toLocaleString('ko-KR')}원`;
  };

  const formatPercent = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

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
                {holding.curr_price > 0 && (
                  <span className="ml-1">
                    ({formatPercent(holding.daily_change / (holding.curr_price - holding.daily_change) * 100)})
                  </span>
                )}
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
            <div className="flex h-full">
              {/* 왼쪽: 차트 영역 */}
              <div className="flex-1 p-6 border-r border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-[#999999]">기간</span>
                  {['1일', '1주', '1개월', '3개월', '1년'].map(r => (
                    <button key={r}
                      className="text-xs px-3 py-1 rounded border border-gray-200 text-[#666666] hover:border-blue-500 hover:text-blue-600 transition-colors">
                      {r}
                    </button>
                  ))}
                </div>
                {/* 차트 placeholder - 다음 단계에서 실제 차트로 교체 */}
                <div className="bg-gray-50 rounded-lg h-48 flex items-center justify-center mb-4 border border-gray-200">
                  <span className="text-xs text-[#999999]">차트 로딩 중...</span>
                </div>
                {/* 시가/고가/저가/거래대금 */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: '시가', value: '-' },
                    { label: '고가', value: '-' },
                    { label: '저가', value: '-' },
                    { label: '거래대금', value: '-' },
                  ].map(item => (
                    <div key={item.label} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="text-xs text-[#999999] mb-1.5">{item.label}</div>
                      <div className="text-sm font-medium text-[#1a1a1a]">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 오른쪽: 내 보유 현황 */}
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
                      <span className={cn('text-base font-medium', isPos(holding.return_rate) ? 'text-emerald-600' : 'text-red-500')}>
                        {formatPercent(holding.return_rate * 100)}
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
            <div className="flex h-full">
              <div className="flex-1 p-6 border-r border-gray-200">
                {/* 상단 핵심 지표 3개 */}
                <div className="grid grid-cols-3 gap-0 mb-6">
                  {[
                    { label: '시가총액', value: '-' },
                    { label: 'PER', value: '-' },
                    { label: 'PBR', value: '-' },
                  ].map((item, i) => (
                    <div key={item.label} className={cn('', i > 0 && 'pl-6 border-l border-gray-200')}>
                      <div className="text-xs text-[#999999] mb-1.5">{item.label}</div>
                      <div className="text-2xl font-medium text-[#1a1a1a]">{item.value}</div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-200 mb-4" />
                {/* 상세 지표 리스트 */}
                <div className="space-y-0">
                  {[
                    { label: 'EPS', value: '-' },
                    { label: 'ROE', value: '-' },
                    { label: '부채비율', value: '-' },
                    { label: '매출 성장률 (YoY)', value: '-' },
                    { label: '배당수익률', value: '-' },
                    { label: '거래량 (평균)', value: '-' },
                    { label: '업종', value: holding.sector !== '-' ? holding.sector : '-' },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between items-center py-3 border-b border-gray-100">
                      <span className="text-sm text-[#999999]">{item.label}</span>
                      <span className="text-sm text-[#1a1a1a]">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* 오른쪽: 52주 + 매수단가 */}
              <div className="w-56 p-6 flex-shrink-0">
                <div className="text-xs text-[#999999] tracking-wider mb-4">52주 가격 범위</div>
                <div className="mb-6">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-blue-500 font-medium">-</span>
                    <span className="text-[#1a1a1a] font-medium">{formatCurrency(holding.curr_price, holding.currency)}</span>
                    <span className="text-red-500 font-medium">-</span>
                  </div>
                  <div className="bg-gray-100 rounded h-1.5 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-[#1a1a1a]" />
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
                        {formatPercent(holding.return_rate * 100)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 뉴스 탭 */}
          {activeTab === 'news' && (
            <div className="p-6">
              {holding.currency === 'USD' ? (
                <div className="flex flex-col items-center justify-center h-48 text-[#999999]">
                  <Newspaper className="w-8 h-8 mb-3 opacity-30" />
                  <p className="text-sm">해외 종목은 뉴스를 제공하지 않습니다</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 flex items-center justify-center h-32 text-[#999999] bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-xs">뉴스 로딩 중...</span>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
