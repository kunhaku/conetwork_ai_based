
import React, { useState, useCallback } from 'react';
import InputPanel from './components/InputPanel';
import GraphCanvas from './components/GraphCanvas';
import DetailPanel from './components/DetailPanel';
import ReportPanel from './components/ReportPanel';
import { UnifiedGraph, GraphNode, PipelineStatus, PipelineStage } from './types';
import { runPipeline } from './services/geminiService';

type ViewMode = 'graph' | 'report';

const App: React.FC = () => {
  const [graphData, setGraphData] = useState<UnifiedGraph | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [status, setStatus] = useState<PipelineStatus>({ stage: 'idle', message: '', progress: 0 });
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [inferredTopic, setInferredTopic] = useState<string | null>(null);
  const [inferredSeeds, setInferredSeeds] = useState<string[] | null>(null);

  const handleGenerate = useCallback(async (seeds: string[], topic: string) => {
    // Quick connectivity check
    try {
      setStatus({ stage: 'agent-s', message: 'Pinging API server...', progress: 2 });
      const ping = await fetch('/api/ping');
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
        }
      );
      setGraphData(data);
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
    <div className="flex h-screen w-screen bg-gray-50 overflow-hidden text-gray-900 font-sans">
      {/* 1. Left Input Sidebar */}
      <InputPanel 
        onGenerate={handleGenerate} 
        status={status} 
        externalTopic={inferredTopic}
        externalSeeds={inferredSeeds}
      />

      {/* 2. Middle Content Area */}
      <div className="flex-1 flex flex-col relative border-r border-gray-200 overflow-hidden">
        
        {/* View Toggles (Only visible when data exists) */}
        {graphData && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-white/90 backdrop-blur shadow-sm border border-gray-200 rounded-full p-1 flex gap-1">
                <button 
                    onClick={() => setViewMode('graph')}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${viewMode === 'graph' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                    Graph View
                </button>
                <button 
                    onClick={() => setViewMode('report')}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${viewMode === 'report' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                    Agent R Report
                </button>
            </div>
        )}

        {/* Error Banner */}
        {status.stage === 'error' && (
            <div className="absolute top-16 left-4 right-4 z-50 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow-sm flex items-center justify-between">
                <span>Error: {status.message}</span>
                <button onClick={() => setStatus({ stage: 'idle', message: '', progress: 0 })} className="text-red-500 font-bold">&times;</button>
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
      />
    </div>
  );
};

export default App;
