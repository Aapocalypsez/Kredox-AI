import { Line, LineChart, ResponsiveContainer } from 'recharts';

export function MiniSparkline({ data, color = 'var(--accent)' }) {
  return (
    <div className="h-12 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="value" dot={false} stroke={color} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
