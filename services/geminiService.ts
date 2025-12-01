import { UnifiedGraph, AnalysisRequest, GraphNode, GraphLink, GraphSource, ResearchReport, PipelineStatus } from "../types";
import { 
    AGENT_S_SYSTEM_INSTRUCTION, 
    AGENT_Q_SYSTEM_INSTRUCTION, 
    AGENT_X_SYSTEM_INSTRUCTION, 
    AGENT_F_SYSTEM_INSTRUCTION, 
    AGENT_R_SYSTEM_INSTRUCTION,
    AGENT_T_SYSTEM_INSTRUCTION,
    AGENT_T_REVERSE_SYSTEM_INSTRUCTION
} from "../constants";
import { callLLM } from "./llmClient";

type ChatOptions = { temperature?: number; model?: string };

// Helper to parse JSON from Markdown code blocks or raw text
const safeParseJSON = (text: string) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    // Continue to fallback below
  }
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch (e) {
    console.error("JSON Parse Error", e);
    return null;
  }
};

const callPuterChat = async (
  systemInstruction: string,
  userContent: string,
  options: ChatOptions = {}
): Promise<string> => {
  return callLLM({
    systemInstruction,
    userContent,
    model: options.model,
    temperature: options.temperature ?? 0.1,
  });
};

// --- STAGE 0: AGENT T (Topic Inference) ---
const inferTopic = async (seeds: string[]): Promise<string | null> => {
    try {
        const response = await callPuterChat(
          AGENT_T_SYSTEM_INSTRUCTION,
          JSON.stringify(seeds),
          { temperature: 0.1 }
        );
        const result = safeParseJSON(response || "");
        return result?.topic || null;
    } catch (e) {
        console.error("Agent T failed", e);
        return null;
    }
};

// --- STAGE 0: AGENT T (Reverse - Seeds Inference) ---
const inferSeeds = async (topic: string): Promise<string[]> => {
    try {
        const response = await callPuterChat(
          AGENT_T_REVERSE_SYSTEM_INSTRUCTION,
          topic,
          { temperature: 0.3 }
        );
        const result = safeParseJSON(response || "");
        return result?.seeds || [];
    } catch (e) {
        console.error("Agent T (Reverse) failed", e);
        return [];
    }
};

// --- STAGE 1: AGENT S (Seed Analysis) ---
const runAgentS = async (seed: string, topic: string): Promise<UnifiedGraph | null> => {
  try {
    const response = await callPuterChat(
      AGENT_S_SYSTEM_INSTRUCTION,
      JSON.stringify({ seed, topic }),
      { temperature: 0.1 }
    );
    return safeParseJSON(response || "");
  } catch (e) {
    console.error(`Agent S failed for ${seed}`, e);
    return null;
  }
};

// --- STAGE 1.5: AGENT Q (Quantitative Data Fetcher - Virtual yfinance) ---
const runAgentQ = async (nodes: GraphNode[]): Promise<Record<string, Partial<GraphNode>>> => {
    // Optimization: Run on nodes that don't have ticker/marketCap
    const BATCH_SIZE = 15; 
    let allUpdates: Record<string, Partial<GraphNode>> = {};

    const chunks = [];
    for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
        chunks.push(nodes.slice(i, i + BATCH_SIZE));
    }

    for (const chunk of chunks) {
        const names = chunk.map(n => n.name);
        try {
            const response = await callPuterChat(
              AGENT_Q_SYSTEM_INSTRUCTION,
              JSON.stringify(names),
              { temperature: 0.1 }
            );

            const result = safeParseJSON(response || "");
            if (result && result.updates) {
                allUpdates = { ...allUpdates, ...result.updates };
            }
        } catch (e) {
            console.error("Agent Q batch failed", e);
        }
    }
    return allUpdates;
};


// --- STAGE 2: AGENT X (Cross-Relations) ---
const runAgentX = async (nodes: GraphNode[], topic: string): Promise<{ links: GraphLink[], sources: GraphSource[] } | null> => {
  // Optimization: Filter nodes based on Priority using the REAL data from Agent Q
  // We prioritize: Core nodes, and nodes identified as Mega/Large/Mid cap
  const prioritizedNodes = nodes.filter(n => {
      if (n.role === 'Core') return true;
      if (!n.sizeBucket) return true; // Keep unknown to be safe
      return ['Mega', 'Large', 'Mid'].includes(n.sizeBucket);
  });
  
  // If we filtered down too aggressively (e.g. < 2 nodes), fallback to using everyone
  const nodesToProcess = prioritizedNodes.length >= 2 ? prioritizedNodes : nodes;
  const nodeNames = nodesToProcess.map(n => n.name);

  try {
    const response = await callPuterChat(
      AGENT_X_SYSTEM_INSTRUCTION,
      JSON.stringify({ nodes: nodeNames, topic }),
      { temperature: 0.1 }
    );
    return safeParseJSON(response || "");
  } catch (e) {
    console.error("Agent X failed", e);
    return null;
  }
};

// --- STAGE 3: AGENT F (Qualitative Analyst) ---
const runAgentF = async (nodes: GraphNode[], topic: string): Promise<Record<string, Partial<GraphNode>>> => {
  const BATCH_SIZE = 5; 
  let allUpdates: Record<string, Partial<GraphNode>> = {};

  const chunks = [];
  for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
    chunks.push(nodes.slice(i, i + BATCH_SIZE));
  }

  for (const chunk of chunks) {
    // Provide Agent F with the Quantitative Data found by Agent Q
    // This serves as "Grounding" so F doesn't need to search for basic info
    const enrichedContext = chunk.map(n => ({ 
        id: n.id, 
        name: n.name, 
        country: n.country,
        // Grounding info from Q:
        ticker: n.ticker,
        marketCap: n.marketCap,
        sector: n.sector
    }));
    
    try {
      const response = await callPuterChat(
        AGENT_F_SYSTEM_INSTRUCTION,
        JSON.stringify({ nodes: enrichedContext, topic }),
        { temperature: 0.1 }
      );
      
      const result = safeParseJSON(response || "");
      if (result && result.updates) {
        allUpdates = { ...allUpdates, ...result.updates };
      }
    } catch (e) {
      console.error("Agent F batch failed", e);
    }
  }

  return allUpdates;
};

// --- STAGE 4: AGENT R (Report) ---
const runAgentR = async (graph: UnifiedGraph): Promise<ResearchReport | null> => {
  const cleanGraph = {
    nodes: graph.nodes.map(({ x, y, fx, fy, vx, vy, ...n }) => n),
    links: graph.links.map(l => ({ 
      source: typeof l.source === 'object' ? (l.source as any).id : l.source,
      target: typeof l.target === 'object' ? (l.target as any).id : l.target,
      type: l.type
    }))
  };

  try {
    const response = await callPuterChat(
      AGENT_R_SYSTEM_INSTRUCTION,
      JSON.stringify(cleanGraph),
      { temperature: 0.3 }
    );
    return safeParseJSON(response || "");
  } catch (e) {
    console.error("Agent R failed", e);
    return null;
  }
};

// --- ORCHESTRATOR ---
export const runPipeline = async (
  request: AnalysisRequest, 
  onStatus: (status: PipelineStatus) => void,
  onGraphUpdate: (graph: UnifiedGraph) => void,
  onTopicInferred?: (topic: string) => void,
  onSeedsInferred?: (seeds: string[]) => void
): Promise<UnifiedGraph> => {
  let { seeds, topic } = request;
  
  // CASE A: Seeds exist, Topic missing -> Infer Topic
  if ((!topic || topic.trim() === "") && seeds.length > 0) {
      onStatus({ stage: 'agent-s', message: 'Agent T: Inferring research topic from seeds...', progress: 2 });
      const inferredTopic = await inferTopic(seeds);
      if (inferredTopic) {
          topic = inferredTopic;
          if (onTopicInferred) onTopicInferred(topic);
      } else {
          topic = "General Industry Analysis";
          if (onTopicInferred) onTopicInferred(topic);
      }
  }

  // CASE B: Topic exists, Seeds missing -> Infer Seeds
  if ((!seeds || seeds.length === 0) && topic && topic.trim() !== "") {
       onStatus({ stage: 'agent-s', message: `Agent T: Inferring key players for '${topic}'...`, progress: 2 });
       const inferredSeeds = await inferSeeds(topic);
       if (inferredSeeds && inferredSeeds.length > 0) {
           seeds = inferredSeeds;
           if (onSeedsInferred) onSeedsInferred(seeds);
       } else {
           // Fallback creates a graph about the topic generally? 
           // Agent S needs a seed. If this fails, we effectively fail.
           throw new Error("Could not infer seed companies from topic. Please provide at least one seed company.");
       }
  }

  let consolidatedGraph: UnifiedGraph = { summary: "", nodes: [], links: [], sources: [] };
  const nodeIdSet = new Set<string>();

  const emitUpdate = () => {
      onGraphUpdate({
          ...consolidatedGraph,
          nodes: [...consolidatedGraph.nodes],
          links: [...consolidatedGraph.links]
      });
  };

  // --- STAGE 1: SEED ANALYSIS ---
  onStatus({ stage: 'agent-s', message: `Agent S: Analyzing seeds for '${topic}'...`, progress: 10 });
  
  const seedResults = await Promise.all(seeds.map(seed => runAgentS(seed, topic)));
  
  seedResults.forEach(result => {
    if (!result) return;
    
    if (Array.isArray(result.nodes)) {
      result.nodes.forEach(node => {
        const isSeed = seeds.some(s => s.trim().toLowerCase() === node.name.toLowerCase() || s.trim().toLowerCase() === node.id.toLowerCase());
        if (isSeed) {
            node.role = 'Core';
        }

        if (!nodeIdSet.has(node.id)) {
          consolidatedGraph.nodes.push(node);
          nodeIdSet.add(node.id);
        } else {
            if (isSeed) {
                const existing = consolidatedGraph.nodes.find(n => n.id === node.id);
                if (existing) existing.role = 'Core';
            }
        }
      });
    }

    if (Array.isArray(result.links)) {
      result.links.forEach(link => {
         const exists = consolidatedGraph.links.some(l => 
           (l.source === link.source && l.target === link.target && l.type === link.type)
         );
         if (!exists) consolidatedGraph.links.push(link);
      });
    }

    const currentMaxId = Math.max(0, ...consolidatedGraph.sources.map(s => s.id));
    if (Array.isArray(result.sources)) {
      result.sources.forEach((s: any) => {
        let sourceObj = s;
        if (typeof s === 'string') {
            sourceObj = { id: 0, title: s, url: '', note: '' };
        }
        
        if (!sourceObj || typeof sourceObj !== 'object') return;
        if (typeof sourceObj.id !== 'number') sourceObj.id = 0;

        sourceObj.id += currentMaxId;
        consolidatedGraph.sources.push(sourceObj);
      });
    }
  });

  emitUpdate();

  if (consolidatedGraph.nodes.length === 0) {
    throw new Error("No graph data returned from model. Check /api/run server and model access.");
  }

  // --- STAGE 1.5: AGENT Q (QUANTITATIVE DATA) ---
  onStatus({ stage: 'agent-q', message: 'Agent Q: Fetching financial data (Ticker, Price, Cap)...', progress: 30 });
  const qUpdates = await runAgentQ(consolidatedGraph.nodes);
  
  if (Object.keys(qUpdates).length > 0) {
      consolidatedGraph.nodes = consolidatedGraph.nodes.map(node => {
          const update = qUpdates[node.name] || qUpdates[node.id];
          if (update) {
              return { 
                  ...node, 
                  // Spread all quantitative data found by Q (ticker, price, cap, sector, sizeBucket)
                  ...update
              };
          }
          return node;
      });
  }
  emitUpdate();

  // --- STAGE 2: CROSS-RELATIONS ---
  onStatus({ stage: 'agent-x', message: 'Agent X: Connecting key players...', progress: 50 });
  
  if (consolidatedGraph.nodes.length > 2) {
    const xResult = await runAgentX(consolidatedGraph.nodes, topic);
    if (xResult && Array.isArray(xResult.links)) {
      xResult.links.forEach(link => {
        if (nodeIdSet.has(link.source as string) && nodeIdSet.has(link.target as string)) {
             consolidatedGraph.links.push({ ...link, isKeyRelationship: true });
        }
      });
      
      const currentMaxId = Math.max(0, ...consolidatedGraph.sources.map(s => s.id));
      if (Array.isArray(xResult.sources)) {
        xResult.sources.forEach((s: any) => {
            let sourceObj = s;
            if (typeof s === 'string') {
                sourceObj = { id: 0, title: s, url: '', note: '' };
            }

             if (!sourceObj || typeof sourceObj !== 'object') return;
             if (typeof sourceObj.id !== 'number') sourceObj.id = 0;

            sourceObj.id += currentMaxId;
            consolidatedGraph.sources.push(sourceObj);
        });
      }
    }
  }

  emitUpdate();

  // --- STAGE 3: AGENT F (QUALITATIVE ENRICHMENT) ---
  onStatus({ stage: 'agent-f', message: 'Agent F: Analyzing growth profiles & risks...', progress: 75 });
  
  const fUpdates = await runAgentF(consolidatedGraph.nodes, topic);
  
  if (Object.keys(fUpdates).length > 0) {
    consolidatedGraph.nodes = consolidatedGraph.nodes.map(node => {
      const updates = fUpdates[node.id];
      // F adds qualitative data (Risk, Themes, etc.), keeping the Quantitative data from Q
      return updates ? { ...node, ...updates } : node;
    });
  }

  emitUpdate();

  // --- STAGE 4: REPORT GENERATION ---
  onStatus({ stage: 'agent-r', message: 'Agent R: Synthesizing strategic insights...', progress: 90 });
  
  const report = await runAgentR(consolidatedGraph);
  if (report) {
    consolidatedGraph.report = report;
    consolidatedGraph.summary = report.themeOverview;
  }

  onStatus({ stage: 'complete', message: 'Pipeline Complete.', progress: 100 });
  return consolidatedGraph;
};
