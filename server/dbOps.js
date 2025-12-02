import { getSupabaseClient, hasSupabaseEnv } from './dbClient.js';

export const normalizeName = (name = '') =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const relationTypeMap = {
  SupplyChain: 'supply_chain',
  Equity: 'equity',
  Competitor: 'competitor',
  Partner: 'partner',
  Acquisition: 'acquisition',
  Customer: 'customer',
};

const toRelationType = (type = '') => relationTypeMap[type] || type?.toString().toLowerCase();

const evidenceToConfidence = (strength) => {
  if (!strength) return 0.6;
  const s = strength.toLowerCase();
  if (s === 'confirmed') return 0.9;
  if (s === 'speculative') return 0.5;
  return 0.6;
};

const extractDomain = (url) => {
  try {
    return new URL(url).hostname;
  } catch (_) {
    return null;
  }
};

const ensureSources = async (supabase, sources = []) => {
  const sourceIdMap = {};
  for (const src of sources) {
    if (!src?.url) continue;
    const url = src.url;
    const domain = extractDomain(url);
    const { data, error } = await supabase
      .from('sources')
      .upsert(
        {
          url,
          domain,
          metadata: { title: src.title, note: src.note },
        },
        { onConflict: 'url' }
      )
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (data?.id) {
      sourceIdMap[src.id ?? url] = data.id;
    }
  }
  return sourceIdMap;
};

const ensureNodes = async (supabase, nodes = []) => {
  const nodeIdMap = {};
  for (const node of nodes) {
    if (!node?.name) continue;
    const canonical = node.name.trim();
    const norm = normalizeName(canonical);
    const type = node.type || 'company';
    const ext = node.ticker ? { ticker: node.ticker } : {};
    const importance = node.role === 'Core' ? 5 : 1;
    const { data, error } = await supabase
      .from('nodes')
      .upsert(
        {
          type,
          canonical_name: canonical,
          normalized_name: norm,
          external_ids: ext,
          importance_score: importance,
        },
        { onConflict: 'type,normalized_name' }
      )
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (data?.id) {
      nodeIdMap[node.id ?? canonical] = data.id;
    }
  }
  return nodeIdMap;
};

const ensureAliases = async (supabase, nodeIdMap, nodes = []) => {
  for (const node of nodes) {
    if (!node?.name) continue;
    const dbId = nodeIdMap[node.id ?? node.name];
    if (!dbId) continue;
    const aliases = [node.name, node.displayName].filter(Boolean);
    for (const alias of aliases) {
      const { error } = await supabase
        .from('node_aliases')
        .upsert(
          { node_id: dbId, alias },
          { onConflict: 'node_id,alias' }
        );
      if (error) throw error;
    }
  }
};

const upsertFacts = async (supabase, nodeIdMap, nodes = [], sourceIdMap = {}) => {
  for (const node of nodes) {
    const dbId = nodeIdMap[node.id ?? node.name];
    if (!dbId) continue;
    const facts = [];
    const pushText = (attribute, value) => {
      if (value) facts.push({ attribute, value_text: value });
    };
    pushText('role', node.role);
    pushText('country', node.country);
    pushText('ticker', node.ticker);
    pushText('primary_exchange', node.primaryExchange);
    pushText('sector', node.sector);
    pushText('industry', node.industry);
    pushText('size_bucket', node.sizeBucket);
    pushText('growth_profile', node.growthProfile);
    pushText('latest_price', node.latestPrice);
    pushText('market_cap', node.marketCap);
    pushText('revenue', node.revenue);
    pushText('net_income', node.netIncome);
    pushText('note', node.note);
    if (node.riskNotes) facts.push({ attribute: 'risk_notes', value_text: node.riskNotes });
    if (Array.isArray(node.keyThemes) && node.keyThemes.length > 0) {
      facts.push({ attribute: 'key_themes', value_json: { items: node.keyThemes } });
    }

    for (const fact of facts) {
      const base = {
        node_id: dbId,
        attribute: fact.attribute,
        value_text: fact.value_text ?? null,
        value_numeric: fact.value_numeric ?? null,
        value_json: fact.value_json ?? null,
        confidence_score: 0.6,
        source_id: fact.source_id ? sourceIdMap[fact.source_id] : null,
      };
      // Skip if identical fact already exists
      const { data: existing, error: selErr } = await supabase
        .from('facts')
        .select('id')
        .eq('node_id', dbId)
        .eq('attribute', base.attribute)
        .eq('value_text', base.value_text)
        .eq('value_numeric', base.value_numeric)
        .eq('value_json', base.value_json)
        .maybeSingle();
      if (selErr) throw selErr;
      if (existing?.id) continue;
      const { error } = await supabase.from('facts').insert(base);
      if (error) throw error;
    }
  }
};

const upsertEdges = async (supabase, links = [], nodeIdMap = {}, sourceIdMap = {}) => {
  for (const link of links) {
    const srcId = nodeIdMap[typeof link.source === 'string' ? link.source : link.source?.id];
    const dstId = nodeIdMap[typeof link.target === 'string' ? link.target : link.target?.id];
    if (!srcId || !dstId) continue;
    const relation_type = toRelationType(link.type);
    const confidence_score = evidenceToConfidence(link.evidenceStrength);
    const { data: existing, error: selErr } = await supabase
      .from('edges')
      .select('id')
      .eq('src_node_id', srcId)
      .eq('dst_node_id', dstId)
      .eq('relation_type', relation_type)
      .is('valid_from', null)
      .maybeSingle();
    if (selErr) throw selErr;
    let edgeId = existing?.id;
    if (!edgeId) {
      const { data, error: insErr } = await supabase
        .from('edges')
        .insert({
          src_node_id: srcId,
          dst_node_id: dstId,
          relation_type,
          confidence_score,
          valid_from: null,
          valid_to: null,
        })
        .select('id')
        .maybeSingle();
      if (insErr) throw insErr;
      edgeId = data?.id;
    }
    if (edgeId && Array.isArray(link.sourceIds) && link.sourceIds.length > 0) {
      for (const srcRef of link.sourceIds) {
        const sid = sourceIdMap[srcRef];
        if (!sid) continue;
        const { error } = await supabase
          .from('edge_sources')
          .upsert(
            {
              edge_id: edgeId,
              source_id: sid,
              evidence_snippet: link.description || null,
            },
            { onConflict: 'edge_id,source_id' }
          );
        if (error) throw error;
      }
    }
  }
};

export const upsertGraph = async (graph) => {
  if (!hasSupabaseEnv()) throw new Error('Supabase env not configured');
  const supabase = getSupabaseClient();
  const nodes = graph?.nodes || [];
  const links = graph?.links || [];
  const sources = graph?.sources || [];

  const sourceIdMap = await ensureSources(supabase, sources);
  const nodeIdMap = await ensureNodes(supabase, nodes);
  await ensureAliases(supabase, nodeIdMap, nodes);
  await upsertFacts(supabase, nodeIdMap, nodes, sourceIdMap);
  await upsertEdges(supabase, links, nodeIdMap, sourceIdMap);

  return { nodeIdMap, sourceIdMap };
};

export const searchNodes = async ({ query, type }) => {
  if (!hasSupabaseEnv()) throw new Error('Supabase env not configured');
  const supabase = getSupabaseClient();
  const norm = normalizeName(query);
  const conditions = [`canonical_name.ilike.%${query}%`, `normalized_name.ilike.%${norm}%`].join(',');
  let q = supabase
    .from('nodes')
    .select('id, canonical_name, type, last_crawled_at, importance_score')
    .or(conditions)
    .limit(20);
  if (type) q = q.eq('type', type);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
};

export const getNodeProfile = async (nodeId) => {
  if (!hasSupabaseEnv()) throw new Error('Supabase env not configured');
  const supabase = getSupabaseClient();
  const { data: node, error: nodeErr } = await supabase
    .from('nodes')
    .select('*')
    .eq('id', nodeId)
    .maybeSingle();
  if (nodeErr) throw nodeErr;
  if (!node) return null;

  const { data: aliases } = await supabase
    .from('node_aliases')
    .select('alias')
    .eq('node_id', nodeId);

  const { data: edgesOut } = await supabase
    .from('edges')
    .select('id, relation_type, confidence_score, dst:dst_node_id (id, canonical_name, type)')
    .eq('src_node_id', nodeId);
  const { data: edgesIn } = await supabase
    .from('edges')
    .select('id, relation_type, confidence_score, src:src_node_id (id, canonical_name, type)')
    .eq('dst_node_id', nodeId);

  const { data: facts } = await supabase
    .from('facts')
    .select('attribute, value_text, value_numeric, value_json, unit, confidence_score, valid_from, valid_to, source_id')
    .eq('node_id', nodeId)
    .order('valid_from', { ascending: false, nullsLast: true });

  return {
    node,
    aliases: (aliases || []).map((a) => a.alias),
    edges: [
      ...(edgesOut || []).map((e) => ({
        id: e.id,
        direction: 'out',
        relation_type: e.relation_type,
        confidence_score: e.confidence_score,
        other: e.dst,
      })),
      ...(edgesIn || []).map((e) => ({
        id: e.id,
        direction: 'in',
        relation_type: e.relation_type,
        confidence_score: e.confidence_score,
        other: e.src,
      })),
    ],
    facts: facts || [],
  };
};

export const enqueueCrawlTask = async (task) => {
  if (!hasSupabaseEnv()) throw new Error('Supabase env not configured');
  const supabase = getSupabaseClient();
  const payload = {
    node_id: task.nodeId || null,
    source_id: task.sourceId || null,
    url: task.url || null,
    task_type: task.taskType || 'node_profile',
    status: task.status || 'pending',
    priority: task.priority ?? 0,
    scheduled_at: task.scheduledAt || new Date().toISOString(),
  };
  const { data, error } = await supabase.from('crawl_tasks').insert(payload).select('id').maybeSingle();
  if (error) throw error;
  return data?.id;
};

export const getNextCrawlTasks = async (limit = 10) => {
  if (!hasSupabaseEnv()) throw new Error('Supabase env not configured');
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('crawl_tasks')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('scheduled_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
};

export const completeCrawlTask = async ({ taskId, status = 'succeeded', errorMessage }) => {
  if (!hasSupabaseEnv()) throw new Error('Supabase env not configured');
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('crawl_tasks')
    .update({
      status,
      finished_at: new Date().toISOString(),
      error_message: errorMessage || null,
    })
    .eq('id', taskId);
  if (error) throw error;
};

export const pingDb = async () => {
  if (!hasSupabaseEnv()) throw new Error('Supabase env not configured');
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('nodes').select('id').limit(1);
  if (error) throw error;
  return true;
};
