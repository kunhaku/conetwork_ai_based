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
const FINANCE_API = import.meta.env.VITE_FINANCE_API || '/api/finance/quote';
const DB_API = import.meta.env.VITE_DB_API || '/api/db/graph/upsert';

// Normalize company identifiers to avoid duplicates from casing/punctuation
const normalizeId = (name: string | undefined | null) => {
  if (!name) return "";
  const cleaned = name
    .toLowerCase()
    .replace(/[,.'"]/g, " ")
    .replace(/\b(inc|corp|co|ltd|llc|plc|company|corporation)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
};

// Identify generic / non-company labels we want to drop (e.g., "Cloud Providers")
const isGenericName = (name: string | undefined | null) => {
  const n = normalizeId(name);
  if (!n) return false;
  const genericTerms = [
    "cloud provider",
    "cloud providers",
    "server manufacturer",
    "server manufacturers",
    "networking company",
    "networking companies",
    "chip maker",
    "chip makers",
    "vendors",
    "suppliers",
    "customers",
    "partners",
    "distributors",
    "oem",
    "odm",
    "contract manufacturer",
    "contract manufacturers"
  ];
  return genericTerms.some(term => n === term || n.includes(term));
};

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

// --- STAGE 1.5: AGENT Q (Quantitative Data via yfinance) ---
const runAgentQ = async (nodes: GraphNode[]): Promise<Record<string, Partial<GraphNode>>> => {
  const BATCH_SIZE = 15;
  let allUpdates: Record<string, Partial<GraphNode>> = {};

  const chunks: GraphNode[][] = [];
  for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
    chunks.push(nodes.slice(i, i + BATCH_SIZE));
  }

  for (const chunk of chunks) {
    const names = chunk.map((n) => n.name);
    try {
      const resp = await fetch(FINANCE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names }),
      });
      if (!resp.ok) {
        console.error('Agent Q finance API failed', resp.status, await resp.text());
        continue;
      }
      const data = await resp.json();
      if (data?.updates) {
        allUpdates = { ...allUpdates, ...data.updates };
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
  // Normalize and de-duplicate seeds up front to avoid duplicate Core nodes
  const seedSet = new Set<string>();
  seeds = seeds
    .map(s => s.trim())
    .filter(s => s.length > 0 && !isGenericName(s))
    .filter(s => {
      const cid = normalizeId(s);
      if (!cid || seedSet.has(cid)) return false;
      seedSet.add(cid);
      return true;
    });
  
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
           // normalize inferred seeds
           const inferredSet = new Set<string>();
           seeds = inferredSeeds
             .map(s => s.trim())
             .filter(s => s.length > 0 && !isGenericName(s))
             .filter(s => {
               const cid = normalizeId(s);
               if (!cid || inferredSet.has(cid)) return false;
               inferredSet.add(cid);
               return true;
             });
           seedSet.clear();
           seeds.forEach(s => seedSet.add(normalizeId(s)));
           if (onSeedsInferred) onSeedsInferred(seeds);
       } else {
           // Fallback creates a graph about the topic generally? 
           // Agent S needs a seed. If this fails, we effectively fail.
           throw new Error("Could not infer seed companies from topic. Please provide at least one seed company.");
       }
  }

  let consolidatedGraph: UnifiedGraph = { summary: "", nodes: [], links: [], sources: [] };
  const nodeIdSet = new Set<string>(); // canonical ids
  const rawToCanonical = new Map<string, string>();
  const canonicalToNode = new Map<string, GraphNode>();

  const emitUpdate = () => {
      onGraphUpdate({
          ...consolidatedGraph,
          nodes: [...consolidatedGraph.nodes],
          links: [...consolidatedGraph.links]
      });
  };

  const registerCanonical = (rawId: string, canonicalId: string) => {
    if (!rawId) return;
    rawToCanonical.set(rawId, canonicalId);
  };

  const mergeNode = (node: GraphNode) => {
    const rawId = node.id || node.name;
    const cid = normalizeId(rawId || "");
    if (isGenericName(rawId) || isGenericName(node.name)) return;
    if (!cid) return;
    registerCanonical(rawId || "", cid);
    registerCanonical(node.name || "", cid);

    const existing = canonicalToNode.get(cid);
    if (existing) {
      // preserve Core if any source is Core
      if (node.role === 'Core' || existing.role === 'Core') existing.role = 'Core';
      // merge scalar fields if missing
      const fields: (keyof GraphNode)[] = ['ticker','primaryExchange','sector','industry','sizeBucket','growthProfile','riskNotes','latestPrice','marketCap','revenue','netIncome','country','note'];
      fields.forEach(f => {
        const val = (existing as any)[f];
        const incoming = (node as any)[f];
        if (!val && incoming) (existing as any)[f] = incoming;
      });
      // merge keyThemes array
      if (node.keyThemes && node.keyThemes.length) {
        const merged = new Set([...(existing.keyThemes || []), ...node.keyThemes]);
        existing.keyThemes = Array.from(merged);
      }
      return existing;
    } else {
      // normalize id to canonical for consistency
      const newNode = { ...node, id: cid };
      canonicalToNode.set(cid, newNode);
      nodeIdSet.add(cid);
      consolidatedGraph.nodes.push(newNode);
      return newNode;
    }
  };

  const mapToCanonicalId = (value: any) => {
    const raw = typeof value === 'object' ? (value?.id || value?.name || '') : String(value || '');
    if (isGenericName(raw)) return "";
    const fromMap = rawToCanonical.get(raw);
    if (fromMap) return fromMap;
    return normalizeId(raw);
  };

  const addLink = (link: GraphLink) => {
    const src = mapToCanonicalId(link.source);
    const tgt = mapToCanonicalId(link.target);
    if (!src || !tgt) return;
    if (isGenericName(src) || isGenericName(tgt)) return;
    if (!nodeIdSet.has(src) || !nodeIdSet.has(tgt)) return;
    const exists = consolidatedGraph.links.some(l => {
      const lSrc = mapToCanonicalId(l.source);
      const lTgt = mapToCanonicalId(l.target);
      return lSrc === src && lTgt === tgt && l.type === link.type;
    });
    if (exists) return;
    consolidatedGraph.links.push({
      ...link,
      source: src,
      target: tgt,
    });
  };

  // --- STAGE 1: SEED ANALYSIS ---
  onStatus({ stage: 'agent-s', message: `Agent S: Analyzing seeds for '${topic}'...`, progress: 10 });
  
  const seedResults = await Promise.all(seeds.map(seed => runAgentS(seed, topic)));
  
  seedResults.forEach(result => {
    if (!result) return;
    
    if (Array.isArray(result.nodes)) {
      result.nodes.forEach(node => {
        const isSeed = seedSet.has(normalizeId(node.name)) || seedSet.has(normalizeId(node.id));
        if (isSeed) {
            node.role = 'Core';
        }

        const merged = mergeNode(node);
        // ensure raw->canonical map knows about provided ids/names
        if (node.id) registerCanonical(node.id, normalizeId(node.id));
        if (node.name) registerCanonical(node.name, normalizeId(node.name));
        if (!merged) return;
      });
    }

    if (Array.isArray(result.links)) {
      result.links.forEach(link => addLink(link));
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
          const normName = normalizeId(node.name);
          const normId = normalizeId(node.id);
          const update = qUpdates[node.name] || qUpdates[node.id] || qUpdates[normName] || qUpdates[normId];
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
        addLink({ ...link, isKeyRelationship: true });
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
      const updates = fUpdates[node.id] || fUpdates[normalizeId(node.id)] || fUpdates[normalizeId(node.name)];
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

  // Persist the full graph (nodes, links, sources, summary/report) to the DB API
  try {
    await fetch(DB_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graph: consolidatedGraph }),
    });
  } catch (e) {
    console.error('Persist graph failed', e);
  }

  onStatus({ stage: 'complete', message: 'Pipeline Complete.', progress: 100 });
  return consolidatedGraph;
};
