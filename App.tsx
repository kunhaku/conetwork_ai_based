
import React, { useState, useCallback } from 'react';
import InputPanel from './components/InputPanel';
import GraphCanvas from './components/GraphCanvas';
import DetailPanel from './components/DetailPanel';
import ReportPanel from './components/ReportPanel';
import { UnifiedGraph, GraphNode, PipelineStatus, PipelineStage, GraphCompleteness } from './types';
import { runPipeline } from './services/geminiService';

type ViewMode = 'graph' | 'report';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/run';
const PROXY_TOKEN = import.meta.env.VITE_PROXY_TOKEN || '';
const pingUrl = API_BASE.endsWith('/run') ? API_BASE.replace(/\/run$/, '/ping') : `${API_BASE}/ping`;
const LLM_PROVIDER = (import.meta.env.VITE_LLM_PROVIDER as string) || 'worker';
const LLM_MODEL = import.meta.env.VITE_LLM_MODEL as string | undefined;
const LLM_LABEL = (() => {
  const modelPart = LLM_MODEL ? ` (${LLM_MODEL})` : '';
  if (LLM_PROVIDER === 'gemini') return `Gemini${modelPart || ' (default gemini-2.5-flash-lite)'}`;
  if (LLM_PROVIDER === 'puter') return `Puter${modelPart || ' (default gpt-4o-mini)'}`;
  if (LLM_PROVIDER === 'worker') return `Worker proxy${modelPart || ''}`;
  return `OpenAI${modelPart || ' (default gpt-4o-mini)'}`;
})();

const App: React.FC = () => {
  const [graphData, setGraphData] = useState<UnifiedGraph | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [status, setStatus] = useState<PipelineStatus>({ stage: 'idle', message: '', progress: 0 });
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [inferredTopic, setInferredTopic] = useState<string | null>(null);
  const [inferredSeeds, setInferredSeeds] = useState<string[] | null>(null);
  const [graphCompleteness, setGraphCompleteness] = useState<GraphCompleteness | null>(null);

  const handleGenerate = useCallback(async (seeds: string[], topic: string) => {
    // Quick connectivity check
    try {
      setStatus({ stage: 'agent-s', message: 'Pinging API server...', progress: 2 });
      const headers: Record<string, string> = {};
      if (PROXY_TOKEN) headers['Authorization'] = `Bearer ${PROXY_TOKEN}`;
      const ping = await fetch(pingUrl, { headers });
      if (!ping.ok) {
        throw new Error(`API server ping failed (${ping.status})`);
      }
      setStatus({ stage: 'agent-s', message: 'Server connection success. Initializing Agents...', progress: 5 });
    } catch (err: any) {
      setStatus({ stage: 'error', message: err.message || 'API server unreachable. Please check backend.', progress: 0 });
      return;
    }

    setStatus({ stage: 'agent-s', message: 'Initializing Agents...', progress: 5 });
    setSelectedNode(null);
    setGraphData(null);
    setViewMode('graph');
    setInferredTopic(null);
    setInferredSeeds(null);
    setGraphCompleteness(null);

    try {
      const data = await runPipeline(
        { seeds, topic }, 
        // 1. Status Callback
        (newStatus) => {
          setStatus(newStatus);
        },
        // 2. Incremental Graph Update Callback
        (partialGraph) => {
            setGraphData(partialGraph);
        },
        // 3. Topic Inferred Callback
        (detectedTopic) => {
            setInferredTopic(detectedTopic);
        },
        // 4. Seeds Inferred Callback
        (detectedSeeds) => {
            setInferredSeeds(detectedSeeds);
        },
        (metrics) => {
            setGraphCompleteness(metrics);
        }
      );
      setGraphData(data);
      setGraphCompleteness(data.completeness ?? null);
    } catch (err: any) {
      setStatus({ stage: 'error', message: err.message || "An unexpected error occurred.", progress: 0 });
    }
  }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    // If we are in report mode, switch to graph to show the node context? 
    // Or maybe just show the DetailPanel. Let's stay in current view but update selection.
    if (viewMode === 'report') {
        // Optional: switch back to graph to see context
        // setViewMode('graph'); 
    }
  }, [viewMode]);

  return (
    <div className="flex h-screen w-screen bg-gradient-to-br from-[#050b15] via-[#0b1324] to-[#020617] overflow-hidden text-gray-100 font-sans">
      {/* 1. Left Input Sidebar */}
      <InputPanel 
        onGenerate={handleGenerate} 
        status={status} 
        externalTopic={inferredTopic}
        externalSeeds={inferredSeeds}
        llmLabel={LLM_LABEL}
      />

      {/* 2. Middle Content Area */}
      <div className="flex-1 flex flex-col relative border-r border-white/10 overflow-hidden">
        
        {/* View Toggles (Only visible when data exists) */}
        {graphData && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-white/10 backdrop-blur-md shadow-sm border border-white/10 rounded-full p-1 flex gap-1">
                <button 
                    onClick={() => setViewMode('graph')}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${viewMode === 'graph' ? 'bg-white text-black shadow' : 'text-gray-300 hover:bg-white/10'}`}
                >
                    Graph View
                </button>
                <button 
                    onClick={() => setViewMode('report')}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${viewMode === 'report' ? 'bg-white text-black shadow' : 'text-gray-300 hover:bg-white/10'}`}
                >
                    Agent R Report
                </button>
            </div>
        )}

        {/* Error Banner */}
        {status.stage === 'error' && (
            <div className="absolute top-16 left-4 right-4 z-50 bg-red-500/10 border border-red-400/50 text-red-100 px-4 py-3 rounded-lg shadow-sm flex items-center justify-between backdrop-blur">
                <span>Error: {status.message}</span>
                <button onClick={() => setStatus({ stage: 'idle', message: '', progress: 0 })} className="text-red-200 font-bold">&times;</button>
            </div>
        )}

        {/* Content Switcher */}
        {viewMode === 'graph' ? (
             <GraphCanvas 
                data={graphData} 
                onNodeClick={handleNodeClick} 
                isLoading={status.stage !== 'idle' && status.stage !== 'complete' && status.stage !== 'error'}
                status={status}
            />
        ) : (
            graphData && <ReportPanel graphData={graphData} onNodeClick={handleNodeClick} />
        )}
       
      </div>

      {/* 3. Right Details Sidebar */}
      <DetailPanel 
        graphData={graphData} 
        selectedNode={selectedNode}
        pipelineStatus={status}
        completeness={graphCompleteness}
      />
    </div>
  );
};

export default App;
