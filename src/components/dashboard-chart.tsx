'use client'

import { useState, useMemo } from 'react'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts'
import type { ChartDataPoint } from '@/lib/chart'

type Range = '7d' | '30d' | 'all'

export function DashboardChart({ chartData }: { chartData: ChartDataPoint[] }) {
  const [range, setRange] = useState<Range>('30d')

  const filtered = useMemo(() => {
    if (range === 'all') return chartData
    const days = range === '7d' ? 7 : 30
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`
    return chartData.filter(d => d.date >= cutoffStr)
  }, [chartData, range])

  if (chartData.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground text-sm">
        ยังไม่มีข้อมูล performance
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium">Trend</p>
        <div className="flex gap-1">
          {(['7d', '30d', 'all'] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs rounded cursor-pointer transition-colors duration-150 ${
                range === r
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r === 'all' ? 'ทั้งหมด' : r}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={filtered} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="spend"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <YAxis
            yAxisId="joins"
            orientation="right"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              fontSize: '12px',
            }}
            formatter={(value, name) =>
              name === 'spendTon'
                ? [`${Number(value).toFixed(3)} TON`, 'Spend']
                : [value, 'Joins']
            }
          />
          <Area
            yAxisId="spend"
            type="monotone"
            dataKey="spendTon"
            fill="#3b82f620"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="joins"
            type="monotone"
            dataKey="joins"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2 justify-center">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block w-3 h-0.5 bg-blue-500" /> Spend (TON)
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block w-3 h-0.5 bg-green-500" /> Joins
        </span>
      </div>
    </div>
  )
}
