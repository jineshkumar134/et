// src/components/StatCard.jsx
export default function StatCard({ label, value, sub, color = 'blue' }) {
  const colorMap = {
    blue:   'text-blue-400   border-blue-500/30   bg-blue-500/10',
    green:  'text-green-400  border-green-500/30  bg-green-500/10',
    red:    'text-red-400    border-red-500/30    bg-red-500/10',
    orange: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
    purple: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] ?? colorMap.blue}`}>
      <p className="text-xs text-[#8b949e] mb-1">{label}</p>
      <p className="text-2xl font-bold">{value ?? '—'}</p>
      {sub && <p className="text-xs text-[#8b949e] mt-1">{sub}</p>}
    </div>
  );
}
