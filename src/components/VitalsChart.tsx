'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const mockData = [
  { date: '2026-01-10', systolic: 125, diastolic: 80 },
  { date: '2026-02-01', systolic: 128, diastolic: 82 },
  { date: '2026-03-03', systolic: 130, diastolic: 85 },
  { date: '2026-04-12', systolic: 135, diastolic: 88 },
  { date: '2026-05-21', systolic: 140, diastolic: 90 },
];

export default function VitalsChart() {
  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={mockData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 12 }} />
          <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
          <Tooltip wrapperStyle={{ borderRadius: 8 }} />
          <Line
            type="monotone"
            dataKey="systolic"
            stroke="#0d9488"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="diastolic"
            stroke="#64748b"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
