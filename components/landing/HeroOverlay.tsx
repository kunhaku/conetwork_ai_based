import React from 'react';

export const HeroOverlay: React.FC = () => {
  return (
    <div className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center px-4 select-none">
      <div className="pointer-events-auto max-w-5xl space-y-8 mt-12">
        <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/20 backdrop-blur-md animate-fade-in-up">
          <div className="relative flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
          </div>
          <span className="text-xs font-mono tracking-[0.2em] text-gray-300 uppercase">Agent Pipeline v1</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white leading-none drop-shadow-2xl">
          Map the Market
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-200 to-gray-500">
            With AI Agents
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-lg md:text-xl font-light text-gray-400 leading-relaxed">
          Built for analysts and investors. Turn hours of company research into a real-time knowledge graph as
          role-based agents auto-infer relationships, financials, and risks.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8">
          <a
            href="/app"
            className="group relative px-8 py-4 bg-white text-black font-bold text-sm tracking-widest uppercase overflow-hidden hover:scale-105 transition-transform duration-300"
          >
            <div className="absolute inset-0 bg-gray-200 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
            <span className="relative z-10">Enter Graph App</span>
          </a>

          <a
            href="#demo"
            className="px-8 py-4 border border-white/20 text-white font-bold text-sm tracking-widest uppercase hover:bg-white/10 transition-colors backdrop-blur-sm"
          >
            View Demo Area
          </a>
        </div>
      </div>

      <div className="absolute bottom-10 w-full flex justify-between px-10 text-[10px] text-gray-600 font-mono uppercase tracking-widest pointer-events-none">
        <span>SYS.STATUS: ONLINE</span>
        <span>Rendering: WebGL 2.0</span>
        <span>Latency: 12ms</span>
      </div>
    </div>
  );
};
