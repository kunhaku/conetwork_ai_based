

import React from 'react';
import { GraphNode, UnifiedGraph, PipelineStatus } from '../types';
import { LINK_COLORS } from '../constants';

interface DetailPanelProps {
  graphData: UnifiedGraph | null;
  selectedNode: GraphNode | null;
  pipelineStatus: PipelineStatus;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ graphData, selectedNode, pipelineStatus }) => {
  const isPipelineActive = pipelineStatus.stage !== 'idle' && pipelineStatus.stage !== 'complete' && pipelineStatus.stage !== 'error';
  
  // LOGIC UPDATE:
  // Agent Q now fetches Ticker, Price, Cap. (So if we have price, Q is done)
  // Agent F now enriches with Risk, Themes, Growth. (So if we have riskNotes, F is done)
  
  const hasQuantitativeData = !!selectedNode?.latestPrice || !!selectedNode?.marketCap; // Provided by Agent Q
  const hasQualitativeData = !!selectedNode?.riskNotes || !!selectedNode?.growthProfile; // Provided by Agent F
  
  // Skeleton is shown only if we have NO data at all and pipeline is running
  const showSkeleton = isPipelineActive && !hasQuantitativeData;

  if (!graphData) {
    return (
      <div className="w-96 bg-white/5 backdrop-blur-xl border-l border-white/10 p-6 hidden lg:block overflow-y-auto text-gray-100">
        <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center">
            <span className="text-4xl mb-2">📊</span>
            <p className="text-sm">Generate a graph to see insights.</p>
        </div>
      </div>
    );
  }

  const relatedLinks = selectedNode && graphData
    ? graphData.links.filter((l: any) => l.source.id === selectedNode.id || l.target.id === selectedNode.id)
    : [];

  return (
    <div className="w-96 bg-white/5 backdrop-blur-xl border-l border-white/10 flex flex-col h-full shadow-[0_10px_40px_rgba(0,0,0,0.35)] z-20 overflow-hidden flex-shrink-0 text-gray-100">
      
      {/* Top: Header */}
      <div className="p-5 border-b border-white/10 bg-white/5">
        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Node Intelligence</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
        {selectedNode ? (
          <div className="animate-fade-in">
            {/* Header Identity */}
            <div className="mb-5">
               <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium bg-white/10 text-white border border-white/20`}>
                    {selectedNode.role}
                  </span>
                  
                  {showSkeleton ? (
                      <div className="h-5 w-20 bg-white/10 rounded animate-pulse"></div>
                  ) : hasQuantitativeData ? (
                      <span className="text-xs font-mono font-bold bg-white/10 px-2 py-1 rounded text-white">
                          {selectedNode.primaryExchange ? `${selectedNode.primaryExchange}:` : ''}{selectedNode.ticker}
                      </span>
                  ) : (
                       <span className="text-[10px] font-bold bg-white/5 text-gray-400 px-2 py-1 rounded border border-white/10">
                          WAITING...
                       </span>
                  )}
               </div>
               
               <h2 className="text-2xl font-bold text-gray-100 leading-tight mb-1">{selectedNode.name}</h2>
               
               <div className="flex items-center gap-2 text-xs text-gray-500">
                    {selectedNode.country && <span>📍 {selectedNode.country}</span>}
                    {showSkeleton ? (
                        <span className="w-24 h-4 bg-white/10 rounded animate-pulse"></span>
                    ) : (selectedNode.sector && <span>🏭 {selectedNode.sector}</span>)}
               </div>
            </div>

            {/* FINANCIALS DATA GRID (Agent Q) */}
            {(hasQuantitativeData || showSkeleton) && (
                 <div className="mb-5 bg-white/5 border border-white/10 rounded-lg p-3 shadow-sm backdrop-blur">
                    <h4 className="text-[10px] font-bold text-emerald-600 uppercase mb-3 flex items-center gap-2">
                        Financial Data
                    </h4>
                    {showSkeleton ? (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="h-8 bg-white/5 rounded animate-pulse"></div>
                            <div className="h-8 bg-white/5 rounded animate-pulse"></div>
                            <div className="h-8 bg-white/5 rounded animate-pulse"></div>
                            <div className="h-8 bg-white/5 rounded animate-pulse"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 text-xs">
                             <div className="bg-white/5 p-2 rounded border border-white/10">
                                 <span className="block text-gray-400 text-[10px]">Price</span>
                                 <span className="font-mono font-bold text-gray-100 text-sm">{selectedNode.latestPrice || 'N/A'}</span>
                             </div>
                             <div className="bg-white/5 p-2 rounded border border-white/10">
                                 <span className="block text-gray-400 text-[10px]">Market Cap</span>
                                 <span className="font-mono font-bold text-gray-100 text-sm">{selectedNode.marketCap || 'N/A'}</span>
                             </div>
                             <div className="bg-white/5 p-2 rounded border border-white/10">
                                 <span className="block text-gray-400 text-[10px]">Revenue</span>
                                 <span className="font-mono font-bold text-gray-100 text-sm">{selectedNode.revenue || 'N/A'}</span>
                             </div>
                             <div className="bg-white/5 p-2 rounded border border-white/10">
                                 <span className="block text-gray-400 text-[10px]">Net Income</span>
                                 <span className="font-mono font-bold text-gray-100 text-sm">{selectedNode.netIncome || 'N/A'}</span>
                             </div>
                        </div>
                    )}
                 </div>
            )}

            {/* Market Profile (Agent Q Context + Agent F Enrichment) */}
            {showSkeleton ? (
                 <div className="mb-5 bg-white/5 border border-white/10 rounded-lg p-3 shadow-sm backdrop-blur">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2">Market Profile</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                        <div className="space-y-1">
                             <div className="h-3 w-8 bg-white/5 rounded"></div>
                             <div className="h-4 w-16 bg-white/10 rounded animate-pulse"></div>
                        </div>
                    </div>
                 </div>
            ) : (
                (selectedNode.sizeBucket || selectedNode.growthProfile || selectedNode.keyThemes) && (
                    <div className="mb-5 bg-white/5 border border-white/10 rounded-lg p-3 shadow-sm animate-fade-in relative overflow-hidden backdrop-blur">
                        {!hasQualitativeData && isPipelineActive && (
                            <div className="absolute top-0 right-0 bg-blue-100 text-blue-800 text-[9px] px-1.5 py-0.5 rounded-bl font-bold animate-pulse">ANALYZING...</div>
                        )}
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2">Market Profile</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                            {selectedNode.sizeBucket && (
                                <div>
                                    <span className="block text-gray-400 text-[10px]">Size Category</span>
                                    <span className="font-medium">{selectedNode.sizeBucket} Cap</span>
                                </div>
                            )}
                             {selectedNode.growthProfile ? (
                                <div>
                                    <span className="block text-gray-400 text-[10px]">Growth Profile</span>
                                    <span className="font-medium text-violet-700">{selectedNode.growthProfile}</span>
                                </div>
                            ) : hasQuantitativeData && (
                                <div>
                                    <span className="block text-gray-400 text-[10px]">Growth Profile</span>
                                    <span className="text-gray-300 italic">Pending Agent F...</span>
                                </div>
                            )}
                        </div>
                        {selectedNode.keyThemes && selectedNode.keyThemes.length > 0 && (
                            <div>
                                <span className="block text-gray-400 text-[10px] mb-1">Key Themes</span>
                                <div className="flex flex-wrap gap-1">
                                    {selectedNode.keyThemes.map(t => (
                                        <span key={t} className="px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded text-[10px] border border-violet-100">
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )
            )}

            {/* General Note */}
            <div className="mb-5">
                 <p className="text-sm text-gray-200 leading-relaxed">{selectedNode.note}</p>
            </div>

            {/* Risk Factors (Agent F) */}
            {hasQuantitativeData && !hasQualitativeData ? (
                 <div className="mb-5 bg-white/5 p-3 rounded-lg border border-white/10 opacity-80">
                     <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2">Risk Analysis</h4>
                     <p className="text-xs text-gray-400 italic">Agent F is analyzing risks based on financial context...</p>
                </div>
            ) : showSkeleton ? (
                <div className="mb-5 bg-red-500/10 p-3 rounded-lg border border-red-400/40">
                     <h4 className="text-[10px] font-bold text-red-200 uppercase mb-2">Risk Analysis...</h4>
                     <div className="space-y-2">
                        <div className="h-3 w-full bg-red-500/20 rounded animate-pulse"></div>
                        <div className="h-3 w-3/4 bg-red-500/20 rounded animate-pulse"></div>
                     </div>
                </div>
            ) : selectedNode.riskNotes && (
                <div className="mb-5 bg-red-500/10 p-3 rounded-lg border border-red-400/40 animate-fade-in">
                    <h4 className="text-[10px] font-bold text-red-200 uppercase mb-1">Risk Factors</h4>
                    <p className="text-xs text-red-100">{selectedNode.riskNotes}</p>
                </div>
            )}

            {/* Relationships */}
            <div>
              <h3 className="text-sm font-bold text-gray-100 mb-3 flex items-center gap-2">
                <span>Connections</span>
                <span className="bg-white/10 text-gray-200 text-[10px] px-1.5 py-0.5 rounded-full border border-white/10">{relatedLinks.length}</span>
              </h3>
              
              <div className="space-y-3">
                {relatedLinks.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No direct connections found.</p>
                ) : (
                  relatedLinks.map((link: any, idx: number) => {
                    const isSource = link.source.id === selectedNode.id;
                    const counterpart = isSource ? link.target : link.source;
                    
                    return (
                      <div key={idx} className={`group p-3 border rounded-lg hover:bg-white/5 transition-all cursor-default relative
                        ${link.isKeyRelationship ? 'border-amber-200/60 bg-amber-500/10' : 'border-white/10'}
                      `}>
                        {link.isKeyRelationship && (
                            <div className="absolute top-2 right-2 text-amber-500" title="Key Relationship">★</div>
                        )}
                        <div className="flex items-center justify-between mb-1 pr-4">
                            <span className="text-sm font-semibold text-gray-100">{counterpart.name}</span>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded text-white" style={{backgroundColor: LINK_COLORS[link.type as keyof typeof LINK_COLORS] || '#999'}}>
                                {link.type}
                            </span>
                        </div>
                        <p className="text-xs text-gray-400 mb-2">
                            {isSource ? '→ outbound to' : '← inbound from'} {counterpart.role}
                        </p>
                        <p className="text-xs text-gray-200 border-t border-white/10 pt-2 mt-1">
                            {link.description}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>
            <p className="text-sm">Select a node to view intelligence.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DetailPanel;
