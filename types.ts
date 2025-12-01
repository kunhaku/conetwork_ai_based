
export interface GraphNode {
  id: string;
  name: string;
  role: 'Core' | 'Supplier' | 'Customer' | 'Competitor' | 'Partner' | 'Subsidiary' | 'Other';
  country?: string;
  note?: string;
  
  // Financial & Market Attributes (Agent F)
  ticker?: string;
  primaryExchange?: string;
  sector?: string;
  industry?: string;
  sizeBucket?: 'Mega' | 'Large' | 'Mid' | 'Small' | 'Micro';
  growthProfile?: 'High Growth' | 'Stable' | 'Cyclical' | 'Distressed';
  keyThemes?: string[];
  riskNotes?: string;

  // Quantitative Data
  latestPrice?: string; // e.g. "$120.50"
  marketCap?: string;   // e.g. "$2.5T"
  revenue?: string;     // e.g. "$60B (FY23)"
  netIncome?: string;   // e.g. "$15B"

  // D3 internal properties
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
}

export interface GraphLink {
  source: string | GraphNode; 
  target: string | GraphNode;
  type: 'SupplyChain' | 'Equity' | 'Competitor' | 'Partner' | 'Acquisition' | 'Customer';
  description?: string;
  
  // Relationship Strength (Agent S/X)
  materiality?: 'High' | 'Medium' | 'Low';
  dependencyDirection?: 'OneWay' | 'Mutual';
  evidenceStrength?: 'Confirmed' | 'Speculative';
  isKeyRelationship?: boolean;
  sourceIds?: number[];
}

export interface GraphSource {
  id: number;
  title: string;
  url: string;
  note?: string;
}

export interface ResearchReport {
  themeOverview: string;
  keyPlayers: { nodeId: string; rationale: string }[];
  secondTierBeneficiaries: { nodeId: string; rationale: string }[];
  riskNodes: { nodeId: string; riskFactor: string }[];
  suggestedNextSteps: string[];
  disclaimer: string;
}

export interface UnifiedGraph {
  summary: string; // Kept for legacy compatibility, though Report replaces it
  nodes: GraphNode[];
  links: GraphLink[];
  sources: GraphSource[];
  report?: ResearchReport; // New Report Object
}

export interface AnalysisRequest {
  seeds: string[];
  topic: string;
}

export type PipelineStage = 'idle' | 'agent-s' | 'agent-q' | 'agent-x' | 'agent-f' | 'agent-r' | 'complete' | 'error';

export interface PipelineStatus {
  stage: PipelineStage;
  message: string;
  progress: number; // 0-100
}
