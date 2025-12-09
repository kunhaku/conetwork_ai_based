import React, { useEffect, useMemo, useRef, useState } from 'react';

type DemoNode = { id: string; name: string; role: string };
type DemoLink = { source: string; target: string };

const demoNodes: DemoNode[] = [
  { id: 'NVIDIA', name: 'NVIDIA', role: 'Core' },
  { id: 'TSMC', name: 'TSMC', role: 'Supplier' },
  { id: 'ASML', name: 'ASML', role: 'Supplier' },
  { id: 'Supermicro', name: 'Supermicro', role: 'OEM' },
  { id: 'AWS', name: 'AWS', role: 'Customer' },
  { id: 'GCP', name: 'Google Cloud', role: 'Customer' },
  { id: 'Samsung', name: 'Samsung Foundry', role: 'Supplier' },
];

const demoLinks: DemoLink[] = [
  { source: 'NVIDIA', target: 'TSMC' },
  { source: 'NVIDIA', target: 'ASML' },
  { source: 'NVIDIA', target: 'Supermicro' },
  { source: 'NVIDIA', target: 'Samsung' },
  { source: 'Supermicro', target: 'AWS' },
  { source: 'Supermicro', target: 'GCP' },
  { source: 'NVIDIA', target: 'AWS' },
  { source: 'NVIDIA', target: 'GCP' },
];

const roleColors: Record<string, string> = {
  Core: '#22d3ee',
  Supplier: '#f59e0b',
  OEM: '#a855f7',
  Customer: '#38bdf8',
  Other: '#94a3b8',
};

const MiniGraph: React.FC<{
  nodes: DemoNode[];
  visibleNodes: string[];
  visibleLinks: DemoLink[];
  highlightId: string | null;
}> = ({ nodes, visibleNodes, visibleLinks, highlightId }) => {
  const positions = useMemo(() => {
    const centerX = 200;
    const centerY = 140;
    const radius = 95;
    return nodes.reduce<Record<string, { x: number; y: number }>>((acc, node, idx) => {
      const angle = (idx / nodes.length) * Math.PI * 2;
      acc[node.id] = {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      };
      return acc;
    }, {});
  }, [nodes]);

  const isVisible = (id: string) => visibleNodes.includes(id);

  return (
    <svg viewBox="0 0 400 280" className="w-full h-full">
      <defs>
        <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      {visibleLinks.map((link, idx) => {
        if (!isVisible(link.source) || !isVisible(link.target)) return null;
        const src = positions[link.source];
        const tgt = positions[link.target];
        return (
          <line
            key={`${link.source}-${link.target}-${idx}`}
            x1={src.x}
            y1={src.y}
            x2={tgt.x}
            y2={tgt.y}
            stroke="url(#edgeGradient)"
            strokeWidth={2}
            strokeOpacity={highlightId === `${link.source}-${link.target}` ? 0.9 : 0.4}
          />
        );
      })}
      {nodes.map((node) => {
        const pos = positions[node.id];
        const visible = isVisible(node.id);
        const highlighted = highlightId === node.id;
        return (
          <g key={node.id} transform={`translate(${pos.x},${pos.y})`} opacity={visible ? 1 : 0} className="transition-all duration-300">
            <circle
              r={visible ? 12 : 0}
              fill={roleColors[node.role] || roleColors.Other}
              stroke="#0ea5e9"
              strokeWidth={highlighted ? 3 : 0}
              className={highlighted ? 'animate-pulse' : ''}
            />
            <text
              textAnchor="middle"
              y={visible ? -18 : 0}
              fill="#e2e8f0"
              fontSize="10"
              fontWeight={600}
              style={{ pointerEvents: 'none' }}
            >
              {node.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const DemoBox: React.FC = () => {
  const [seeds, setSeeds] = useState('NVIDIA\nTSMC');
  const [topic, setTopic] = useState('AI GPU supply chain');
  const [visibleNodes, setVisibleNodes] = useState<string[]>([]);
  const [visibleLinks, setVisibleLinks] = useState<DemoLink[]>([]);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [status, setStatus] = useState('Idle');
  const [playing, setPlaying] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };

  useEffect(() => clearTimers, []);

  const playDemo = () => {
    if (playing) return;
    clearTimers();
    setPlaying(true);
    setVisibleNodes([]);
    setVisibleLinks([]);
    setHighlightId(null);
    setStatus('Reading inputs...');

    const nodeDelay = 500;
    const linkDelay = 450;

    demoNodes.forEach((node, idx) => {
      const t = window.setTimeout(() => {
        setVisibleNodes((prev) => [...prev, node.id]);
        setHighlightId(node.id);
        setStatus(`Adding ${node.name}`);
      }, idx * nodeDelay);
      timers.current.push(t);
    });

    const base = demoNodes.length * nodeDelay;
    demoLinks.forEach((link, idx) => {
      const t = window.setTimeout(() => {
        setVisibleLinks((prev) => [...prev, link]);
        setHighlightId(`${link.source}-${link.target}`);
        setStatus(`Linking ${link.source} → ${link.target}`);
      }, base + idx * linkDelay);
      timers.current.push(t);
    });

    const end = base + demoLinks.length * linkDelay + 600;
    const endTimer = window.setTimeout(() => {
      setHighlightId(null);
      setStatus('Graph ready (demo)');
      setPlaying(false);
    }, end);
    timers.current.push(endTimer);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs text-gray-400">Seed companies</label>
          <textarea
            className="w-full mt-1 p-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white h-28 font-mono"
            value={seeds}
            onChange={(e) => setSeeds(e.target.value)}
            disabled={playing}
          />
        </div>
        <div>
          <label className="text-xs text-gray-400">Research topic</label>
          <input
            className="w-full mt-1 p-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={playing}
          />
        </div>
        <button
          onClick={playDemo}
          disabled={playing}
          className={`mt-2 inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold ${
            playing ? 'bg-cyan-400/60 text-white/80 cursor-not-allowed' : 'bg-cyan-500 text-white hover:bg-cyan-400'
          }`}
        >
          {playing ? 'Generating...' : 'Generate'}
        </button>
        <p className="text-xs text-gray-400">Status: {status}</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-800/40 p-2 min-h-[280px]">
        <MiniGraph nodes={demoNodes} visibleNodes={visibleNodes} visibleLinks={visibleLinks} highlightId={highlightId} />
      </div>
    </div>
  );
};

export default DemoBox;
