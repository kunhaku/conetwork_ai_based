import React, { useEffect, useMemo, useRef, useState } from 'react';

type DemoNode = { id: string; name: string; role: 'Core' | 'Supplier' | 'Customer' | 'Competitor' | 'Partner' | 'Subsidiary' | 'Other' };
type DemoLink = { source: string; target: string; type: 'SupplyChain' | 'Equity' | 'Competitor' | 'Partner' | 'Acquisition' | 'Customer' };

const demoNodes: DemoNode[] = [
  { id: 'NVIDIA', name: 'NVIDIA', role: 'Core' },
  { id: 'TSMC', name: 'TSMC', role: 'Core' },
  { id: 'Samsung', name: 'Samsung Electronics', role: 'Competitor' },
  { id: 'Intel', name: 'Intel', role: 'Competitor' },
  { id: 'AMD', name: 'AMD', role: 'Competitor' },
  { id: 'Foxconn', name: 'Foxconn', role: 'Supplier' },
  { id: 'GlobalSemi', name: 'Global Semiconductor Industry', role: 'Supplier' },
  { id: 'Dell', name: 'Dell Technologies', role: 'Customer' },
  { id: 'HPE', name: 'Hewlett Packard Enterprise', role: 'Customer' },
  { id: 'Supermicro', name: 'Super Micro Computer', role: 'Customer' },
  { id: 'Amazon', name: 'Amazon', role: 'Customer' },
  { id: 'Google', name: 'Google', role: 'Customer' },
  { id: 'Microsoft', name: 'Microsoft', role: 'Customer' },
  { id: 'GlobalAI', name: 'Global AI Market', role: 'Other' },
];

// Fixed layout to mimic real usage (closer to provided screenshot)
const layout: Record<string, { x: number; y: number }> = {
  NVIDIA: { x: 230, y: 220 },
  TSMC: { x: 150, y: 220 },
  Samsung: { x: 210, y: 90 },
  Intel: { x: 195, y: 155 },
  AMD: { x: 160, y: 265 },
  Foxconn: { x: 175, y: 195 },
  GlobalSemi: { x: 90, y: 220 },
  Dell: { x: 210, y: 190 },
  HPE: { x: 250, y: 175 },
  Supermicro: { x: 250, y: 270 },
  Amazon: { x: 320, y: 200 },
  Google: { x: 330, y: 245 },
  Microsoft: { x: 310, y: 265 },
  GlobalAI: { x: 200, y: 235 },
};

const demoLinks: DemoLink[] = [
  { source: 'NVIDIA', target: 'TSMC', type: 'SupplyChain' },
  { source: 'TSMC', target: 'GlobalSemi', type: 'SupplyChain' },
  { source: 'TSMC', target: 'Foxconn', type: 'SupplyChain' },
  { source: 'TSMC', target: 'Intel', type: 'SupplyChain' },
  { source: 'TSMC', target: 'Samsung', type: 'SupplyChain' },
  { source: 'NVIDIA', target: 'Foxconn', type: 'SupplyChain' },
  { source: 'NVIDIA', target: 'Dell', type: 'Customer' },
  { source: 'NVIDIA', target: 'HPE', type: 'Customer' },
  { source: 'NVIDIA', target: 'Supermicro', type: 'Customer' },
  { source: 'NVIDIA', target: 'Amazon', type: 'Customer' },
  { source: 'NVIDIA', target: 'Google', type: 'Customer' },
  { source: 'NVIDIA', target: 'Microsoft', type: 'Customer' },
  { source: 'NVIDIA', target: 'GlobalAI', type: 'Partner' },
  { source: 'Intel', target: 'Dell', type: 'SupplyChain' },
  { source: 'Samsung', target: 'Intel', type: 'Competitor' },
  { source: 'NVIDIA', target: 'AMD', type: 'Competitor' },
  { source: 'Google', target: 'Microsoft', type: 'Partner' },
];

const roleColors: Record<string, string> = {
  Core: '#22d3ee',
  Supplier: '#f59e0b',
  OEM: '#a855f7',
  Customer: '#38bdf8',
  Other: '#94a3b8',
  Competitor: '#f43f5e',
  Partner: '#8b5cf6',
  Subsidiary: '#ec4899',
};

const linkColors: Record<DemoLink['type'], string> = {
  SupplyChain: '#f97316',
  Equity: '#10b981',
  Competitor: '#ef4444',
  Partner: '#8b5cf6',
  Acquisition: '#ec4899',
  Customer: '#3b82f6',
};

const MiniGraph: React.FC<{
  nodes: DemoNode[];
  visibleNodes: string[];
  visibleLinks: DemoLink[];
  linkProgress: Record<string, number>;
  highlightId: string | null;
  activeRole: string | null;
}> = ({ nodes, visibleNodes, visibleLinks, linkProgress, highlightId, activeRole }) => {
  const positions = useMemo(() => {
    const centerX = 200;
    const centerY = 200;
    const scale = 1.5;
    return nodes.reduce<Record<string, { x: number; y: number }>>((acc, node) => {
      const base = layout[node.id] || { x: centerX, y: centerY };
      const dx = base.x - centerX;
      const dy = base.y - centerY;
      acc[node.id] = {
        x: centerX + dx * scale,
        y: centerY + dy * scale,
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
    const isFiltered =
      activeRole &&
      !(
        nodes.find((n) => n.id === link.source && (n.role === activeRole || n.role === 'Core')) &&
        nodes.find((n) => n.id === link.target && (n.role === activeRole || n.role === 'Core'))
      );
    const prog = Math.min(1, linkProgress[`${link.source}-${link.target}`] ?? 0);
    const x2 = src.x + (tgt.x - src.x) * prog;
    const y2 = src.y + (tgt.y - src.y) * prog;
    return (
      <line
        key={`${link.source}-${link.target}-${idx}`}
        x1={src.x}
        y1={src.y}
        x2={x2}
        y2={y2}
        stroke={linkColors[link.type]}
        strokeWidth={2.5}
        strokeOpacity={isFiltered ? 0.08 : highlightId === `${link.source}-${link.target}` ? 0.9 : 0.4}
      />
    );
  })}
  {nodes.map((node) => {
    const pos = positions[node.id];
    const visible = isVisible(node.id);
    const highlighted = highlightId === node.id;
    const filtered = activeRole && !(node.role === activeRole || node.role === 'Core');
    return (
      <g
        key={node.id}
        transform={`translate(${pos.x},${pos.y})`}
        opacity={visible ? (filtered ? 0.2 : 1) : 0}
        className="transition-all duration-300"
      >
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
  const [seeds] = useState('NVIDIA\nTSMC');
  const [topic] = useState('AI GPU supply chain');
  const [visibleNodes, setVisibleNodes] = useState<string[]>([]);
  const [visibleLinks, setVisibleLinks] = useState<DemoLink[]>([]);
  const [linkProgress, setLinkProgress] = useState<Record<string, number>>({});
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [status, setStatus] = useState('Idle');
  const [playing, setPlaying] = useState(false);
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);

  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  useEffect(() => clearTimers, []);

  const playDemo = () => {
    if (playing) return;
    clearTimers();
    setPlaying(true);
    setVisibleNodes([]);
    setVisibleLinks([]);
    setLinkProgress({});
    setHighlightId(null);
    setActiveRole(null);
    setStatus('Reading inputs...');

    const nodeDelay = 140; // faster, overlapping
    const linkDelay = 120;

    // Node fade-in with overlap
    demoNodes.forEach((node, idx) => {
      const t = window.setTimeout(() => {
        setVisibleNodes((prev) => Array.from(new Set([...prev, node.id])));
        setHighlightId(node.id);
        if (idx === demoNodes.length - 1) {
          setStatus('Building relationships...');
          setHighlightId(null);
        }
      }, idx * nodeDelay);
      timers.current.push(t);
    });

    const base = demoNodes.length * nodeDelay + 200;
    // Edge animation by type groups
    const typeSequence: DemoLink['type'][] = ['SupplyChain', 'Customer', 'Partner', 'Competitor'];
    let startOffset = base + 300;
    typeSequence.forEach((type, typeIdx) => {
      const linksOfType = demoLinks.filter((l) => l.type === type);
      const t = window.setTimeout(() => {
        setStatus(`Adding ${type} links`);
        setVisibleLinks((prev) => [...prev, ...linksOfType]);
        // animate growth
        const start = performance.now();
        const duration = 700;
        const step = (time: number) => {
          const p = Math.min(1, (time - start) / duration);
          setLinkProgress((prev) => {
            const next = { ...prev };
            linksOfType.forEach((l) => {
              next[`${l.source}-${l.target}`] = p;
            });
            return next;
          });
          if (p < 1) rafRef.current = requestAnimationFrame(step);
        };
        rafRef.current = requestAnimationFrame(step);
      }, startOffset);
      timers.current.push(t);
      startOffset += linksOfType.length * linkDelay + 200;
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
          <div className="w-full mt-1 p-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white h-28 font-mono">
            <p className="whitespace-pre-line">{seeds}</p>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400">Research topic</label>
          <div className="w-full mt-1 p-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white">
            {topic}
          </div>
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
        <MiniGraph
          nodes={demoNodes}
          visibleNodes={visibleNodes}
          visibleLinks={visibleLinks}
          linkProgress={linkProgress}
          highlightId={highlightId}
          activeRole={activeRole}
        />
        <div className="flex flex-wrap gap-2 px-2 pb-2 mt-2">
          {['Core', 'Supplier', 'Customer', 'Competitor', 'Partner', 'Subsidiary', 'Other'].map((role) => (
            <button
              key={role}
              onMouseEnter={() => setActiveRole(role)}
              onMouseLeave={() => setActiveRole(null)}
              onClick={() => setActiveRole((prev) => (prev === role ? null : role))}
              className={`px-2 py-1 rounded-full text-[10px] border ${
                activeRole === role ? 'border-cyan-300 bg-cyan-500/20 text-white' : 'border-white/10 text-gray-300'
              }`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
                style={{ backgroundColor: roleColors[role] || roleColors.Other }}
              />
              {role}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DemoBox;
