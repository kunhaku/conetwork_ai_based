
import React, { useState, useEffect } from 'react';
import { SAMPLE_SEEDS, SAMPLE_TOPIC } from '../constants';
import { PipelineStatus, PipelineStage } from '../types';

interface InputPanelProps {
  onGenerate: (seeds: string[], topic: string) => void;
  status: PipelineStatus;
  externalTopic?: string | null;
  externalSeeds?: string[] | null;
  llmLabel?: string;
}

const STEP_ORDER: PipelineStage[] = ['agent-s', 'agent-q', 'agent-x', 'agent-f', 'agent-r', 'complete'];

const STEPS = [
  { id: 'agent-s', label: 'Map Network', desc: 'Scan seeds & neighbors' },
  { id: 'agent-q', label: 'Financial Data', desc: 'Ticker, Price, Cap, Sector' },
  { id: 'agent-x', label: 'Connect', desc: 'Find key cross-links' },
  { id: 'agent-f', label: 'Enrich', desc: 'Qualitative Risk & Themes' },
  { id: 'agent-r', label: 'Analyze', desc: 'Strategic Report' },
];

const InputPanel: React.FC<InputPanelProps> = ({ onGenerate, status, externalTopic, externalSeeds, llmLabel }) => {
  const [seeds, setSeeds] = useState(SAMPLE_SEEDS);
  const [topic, setTopic] = useState(SAMPLE_TOPIC);
  const isLoading = status.stage !== 'idle' && status.stage !== 'complete' && status.stage !== 'error';

  // Sync local topic with externally inferred topic
  useEffect(() => {
    if (externalTopic) {
        setTopic(externalTopic);
    }
  }, [externalTopic]);

  // Sync local seeds with externally inferred seeds
  useEffect(() => {
      if (externalSeeds && externalSeeds.length > 0) {
          setSeeds(externalSeeds.join('\n'));
      }
  }, [externalSeeds]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const seedArray = seeds.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    const topicStr = topic.trim();
    
    // Validation: At least one field must be filled
    if (seedArray.length === 0 && topicStr.length === 0) return;
    
    onGenerate(seedArray, topicStr);
  };

  // Helper to determine step state
  const getStepState = (stepId: PipelineStage) => {
    if (status.stage === 'idle') return 'pending';
    if (status.stage === 'error') return 'error';
    if (status.stage === 'complete') return 'complete';
    
    const currentIndex = STEP_ORDER.indexOf(status.stage);
    const stepIndex = STEP_ORDER.indexOf(stepId);

    if (currentIndex === stepIndex) return 'active';
    if (currentIndex > stepIndex) return 'complete';
    return 'pending';
  };

  const seedArrayLength = seeds.split('\n').filter(s => s.trim().length > 0).length;
  const hasTopic = topic.trim().length > 0;

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200 p-6 shadow-xl z-20 w-80 flex-shrink-0">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-serif shadow-blue-200 shadow-lg">N</div>
          NexusGraph
        </h1>
        <p className="text-xs text-gray-500 mt-1 pl-9">AI-Powered Market Intelligence</p>
        {llmLabel && (
          <p className="text-[10px] text-blue-600 mt-1 pl-9">LLM: {llmLabel}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 flex-1">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Seed Companies</label>
            {!seedArrayLength && hasTopic && (
                 <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100 font-medium">Auto-detect</span>
            )}
            {!seedArrayLength && !hasTopic && (
                 <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Optional if Topic set</span>
            )}
          </div>
          <textarea
            className={`w-full h-24 p-3 text-sm text-gray-900 border border-gray-200 bg-gray-50 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none transition-all font-mono shadow-inner placeholder-gray-400 ${externalSeeds ? 'border-green-300 bg-green-50 text-green-800' : ''}`}
            placeholder={hasTopic ? "Leave empty to infer from Topic" : "One company per line..."}
            value={seeds}
            onChange={(e) => setSeeds(e.target.value)}
            disabled={isLoading}
          />
           {externalSeeds && (
              <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1 animate-fade-in">
                  <span>✨</span> Auto-detected from topic
              </p>
          )}
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Research Topic</label>
            {!hasTopic && seedArrayLength > 0 && (
                <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100 font-medium">Auto-detect</span>
            )}
             {!hasTopic && seedArrayLength === 0 && (
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Optional if Seeds set</span>
            )}
          </div>
          <input
            type="text"
            className={`w-full p-3 text-sm text-gray-900 border border-gray-200 bg-gray-50 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-inner placeholder-gray-400 ${externalTopic ? 'border-green-300 bg-green-50 text-green-800' : ''}`}
            placeholder={seedArrayLength > 0 ? "Leave empty to infer from Seeds" : "e.g. AI GPU Supply Chain"}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={isLoading}
          />
          {externalTopic && (
              <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1 animate-fade-in">
                  <span>✨</span> Auto-detected from seeds
              </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || (seedArrayLength === 0 && !hasTopic)}
          className={`w-full py-3 px-4 rounded-lg text-white font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2
            ${isLoading || (seedArrayLength === 0 && !hasTopic)
              ? 'bg-blue-300 cursor-not-allowed shadow-none text-blue-100' 
              : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:translate-y-0.5'
            }`}
        >
          {isLoading ? 'Researching...' : 'Generate Graph'}
        </button>

        {/* Pipeline Stepper */}
        <div className="mt-4 flex-1 overflow-y-auto">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Analysis Pipeline</h3>
            <div className="space-y-4">
                {STEPS.map((step, idx) => {
                    const state = getStepState(step.id as PipelineStage);
                    return (
                        <div key={step.id} className="flex items-start gap-3">
                            {/* Icon */}
                            <div className={`
                                w-6 h-6 rounded-full flex items-center justify-center text-[10px] border flex-shrink-0 transition-colors duration-300
                                ${state === 'complete' ? 'bg-green-500 border-green-500 text-white' : ''}
                                ${state === 'active' ? 'bg-blue-600 border-blue-600 text-white animate-pulse' : ''}
                                ${state === 'pending' ? 'bg-white border-gray-200 text-gray-300' : ''}
                                ${state === 'error' ? 'bg-red-500 border-red-500 text-white' : ''}
                            `}>
                                {state === 'complete' ? '✓' : idx + 1}
                            </div>
                            
                            {/* Text */}
                            <div className="flex-1 -mt-0.5">
                                <p className={`text-xs font-semibold transition-colors duration-300 ${state === 'active' ? 'text-blue-700' : state === 'complete' ? 'text-gray-900' : 'text-gray-400'}`}>
                                    {step.label}
                                </p>
                                <p className="text-[10px] text-gray-400 leading-tight">{step.desc}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </form>
      
      {/* Footer Status */}
      <div className="mt-4 pt-4 border-t border-gray-100">
         <p className="text-[10px] text-gray-400 font-mono h-4 truncate">
            {isLoading ? `> ${status.message}` : status.stage === 'complete' ? '> Analysis Complete' : '> Ready'}
         </p>
      </div>
    </div>
  );
};

export default InputPanel;
