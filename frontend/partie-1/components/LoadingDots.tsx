"use client";

export default function LoadingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.3s]" />
      <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.15s]" />
      <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" />
    </div>
  );
}
