'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { mockAdminStats } from '@/lib/mock/adminStats';

export function RevenueChart() {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer>
        <AreaChart data={mockAdminStats.daily} margin={{ left: 0, right: 12, top: 6, bottom: 0 }}>
          <defs>
            <linearGradient id="depGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f5d061" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#f5d061" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="wdGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#36ff9a" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#36ff9a" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke="rgba(54,255,154,0.08)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#6e8a7a', fontSize: 11 }} tickFormatter={(d) => d.slice(5)} stroke="rgba(54,255,154,0.10)" />
          <YAxis tick={{ fill: '#6e8a7a', fontSize: 11 }} stroke="rgba(54,255,154,0.10)" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
          <Tooltip
            contentStyle={{
              background: '#04100a',
              border: '1px solid rgba(54,255,154,0.20)',
              borderRadius: 12,
              fontSize: 12,
            }}
            labelStyle={{ color: '#bcd9c6' }}
            cursor={{ stroke: 'rgba(245,208,97,0.30)' }}
          />
          <Area type="monotone" dataKey="deposit" stroke="#f5d061" strokeWidth={2} fill="url(#depGrad)" />
          <Area type="monotone" dataKey="withdraw" stroke="#36ff9a" strokeWidth={2} fill="url(#wdGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
