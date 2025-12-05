import React from 'react';
import { NavBar } from './components/landing/NavBar';
import { ClusterGraph3D } from './components/landing/ClusterGraph3D';
import { HeroOverlay } from './components/landing/HeroOverlay';

const pipeline = [
  { title: 'Agent S · Map Network', desc: 'Seed ego networks; tag core roles; collect sources.' },
  { title: 'Agent Q · Financial Data', desc: 'Tickers, price, market cap, sector, size bucket.' },
  { title: 'Agent X · Cross-Links', desc: '10–20 key relationships between existing nodes only.' },
  { title: 'Agent F · Qualitative', desc: 'Growth profile, themes, risk notes, revenue, net income.' },
  { title: 'Agent R · Report', desc: 'Executive overview, key players, hidden opportunities, risks, actions.' },
];

const reportBlocks = [
  { title: 'Executive Overview', desc: 'Theme narrative synthesized from the live graph.' },
  { title: 'Key / Secondary Players', desc: 'Critical nodes plus second-tier beneficiaries with rationale.' },
  { title: 'Risk Nodes', desc: 'Single-point failures, regulation, or supply chain fragility.' },
  { title: 'Next Actions', desc: 'Monitor, deep dives, and follow-up crawl tasks.' },
];

export const LandingPage: React.FC = () => {
  return (
    <main className="relative w-full min-h-screen bg-gray-950 overflow-hidden text-white">
      <NavBar />
      <ClusterGraph3D />
      <HeroOverlay />

      <section id="pipeline" className="relative z-10 bg-gray-950/80 backdrop-blur-xl border-t border-white/5 py-16 px-6 md:px-12">
        <div className="max-w-6xl mx-auto flex items-start justify-between gap-10">
          <div className="max-w-xl space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Agent Pipeline</p>
            <h2 className="text-3xl font-bold">5 agents from raw intent to strategic output</h2>
            <p className="text-gray-400 text-sm">
              Seeds and topics can be inferred automatically; outputs stay lean with curated links and grounded financials.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 max-w-2xl">
            {pipeline.map((item) => (
              <div
                key={item.title}
                className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-cyan-500/30 hover:bg-white/10 transition-all"
              >
                <p className="text-sm font-semibold mb-1">{item.title}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="demo"
        className="relative z-10 bg-gray-950/90 backdrop-blur-xl border-t border-white/5 py-16 px-6 md:px-12"
      >
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-10 items-stretch">
          <div className="md:w-2/3">
            <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 shadow-inner shadow-cyan-500/10 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Live demo dock</p>
                  <h3 className="text-2xl font-bold">Show the product in action</h3>
                </div>
                <span className="text-[10px] text-gray-400 border border-white/10 rounded-full px-3 py-1">TODO</span>
              </div>
              <div className="flex-1 min-h-[320px] rounded-xl border border-dashed border-white/15 bg-black/40 p-4 text-gray-500 text-sm">
                <table className="w-full h-full text-left text-xs text-gray-500">
                  <tbody>
                    <tr className="border-b border-white/10">
                      <td className="py-3">Web animation slot</td>
                      <td className="py-3 text-right text-gray-400">TODO</td>
                    </tr>
                    <tr className="border-b border-white/10">
                      <td className="py-3">Interaction notes</td>
                      <td className="py-3 text-right text-gray-400">TODO</td>
                    </tr>
                    <tr>
                      <td className="py-3">Embed status</td>
                      <td className="py-3 text-right text-gray-400">TODO</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="md:w-1/3 space-y-4">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
              <p className="text-sm font-semibold mb-1">Graph interactions</p>
              <p className="text-xs text-gray-400">Role/relationship filtering, hover focus, PNG/JSON export.</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
              <p className="text-sm font-semibold mb-1">Auto-complete intent</p>
              <p className="text-xs text-gray-400">Missing topic or seeds are inferred by Agent T for quick starts.</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
              <p className="text-sm font-semibold mb-1">Persist & recall</p>
              <p className="text-xs text-gray-400">Graphs are upserted via the DB API for memory and reuse.</p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="report"
        className="relative z-10 bg-gray-950/85 backdrop-blur-xl border-t border-white/5 py-16 px-6 md:px-12"
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Agent R Report</p>
              <h3 className="text-3xl font-bold">From graph to strategy</h3>
              <p className="text-sm text-gray-400 mt-2">
                A concise narrative ready for research memos and investment huddles.
              </p>
            </div>
            <a
              href="/app"
              className="px-4 py-2 rounded-full border border-white/20 text-xs font-semibold tracking-wider hover:bg-white/10 transition-colors"
            >
              Open Graph App
            </a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reportBlocks.map((item) => (
              <div
                key={item.title}
                className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-cyan-500/30 hover:bg-white/10 transition-all"
              >
                <p className="text-base font-semibold mb-1">{item.title}</p>
                <p className="text-sm text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="relative z-10 py-12 text-center text-gray-600 text-sm border-t border-white/5 bg-gray-950/90">
        <p>&copy; {new Date().getFullYear()} NexusGraph AI. All rights reserved.</p>
      </footer>
    </main>
  );
};

export default LandingPage;
