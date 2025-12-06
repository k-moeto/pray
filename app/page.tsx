"use client";

import dynamic from 'next/dynamic';

const GameCanvas = dynamic(() => import('@/components/GameCanvas'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-screen text-white">Connecting...</div>
});

export default function Home() {
  return (
    <main className="w-full h-screen bg-black overflow-hidden">
      <GameCanvas />
    </main>
  );
}
