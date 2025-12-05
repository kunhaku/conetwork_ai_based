import React from 'react';

export const NavBar: React.FC = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-6 md:px-12 backdrop-blur-sm border-b border-white/5 bg-black/50">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 border border-white flex items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-white translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
          <div className="w-2 h-2 bg-white rounded-full group-hover:bg-black transition-colors duration-500"></div>
        </div>
        <span className="text-xl font-bold tracking-[0.2em] text-white">NEXUS</span>
      </div>

      <div className="hidden md:flex items-center gap-10 text-xs font-medium tracking-widest text-gray-400 uppercase">
        <a href="#pipeline" className="hover:text-white transition-colors">Pipeline</a>
        <a href="#demo" className="hover:text-white transition-colors">Demo</a>
        <a href="#report" className="hover:text-white transition-colors">Report</a>
      </div>

      <div className="flex items-center gap-6">
        <a href="/app" className="hidden md:block text-xs font-bold tracking-widest text-white hover:text-gray-300 transition-colors uppercase">
          Enter App
        </a>
      </div>
    </nav>
  );
};
