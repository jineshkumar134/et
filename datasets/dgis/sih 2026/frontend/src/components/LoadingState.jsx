// src/components/LoadingState.jsx
export default function LoadingState({ message = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="h-10 w-10 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
      <p className="text-sm text-[#8b949e]">{message}</p>
    </div>
  );
}
