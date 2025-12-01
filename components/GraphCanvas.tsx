
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { UnifiedGraph, GraphNode, PipelineStatus } from '../types';
import { NODE_COLORS, LINK_COLORS } from '../constants';

interface GraphCanvasProps {
  data: UnifiedGraph | null;
  onNodeClick: (node: GraphNode) => void;
  isLoading: boolean;
  status: PipelineStatus;
}

const GraphCanvas: React.FC<GraphCanvasProps> = ({ data, onNodeClick, isLoading, status }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, undefined> | null>(null);
  
  // State for interactions
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredLinkType, setHoveredLinkType] = useState<string | null>(null);
  const [selectedLinkType, setSelectedLinkType] = useState<string | null>(null);
  const [hoveredNodeRole, setHoveredNodeRole] = useState<string | null>(null);
  const [selectedNodeRole, setSelectedNodeRole] = useState<string | null>(null);

  // Initialize Graph
  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Clear previous graph
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Setup Zoom Group
    const g = svg.append("g").attr("class", "graph-container");

    // Zoom Behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Prepare Data
    const nodes: GraphNode[] = data.nodes.map(n => ({ ...n }));
    const links = data.links.map(l => ({ ...l }));

    // Define Relationship Cluster Angles (0 to 2PI)
    // This maps each relationship type to a specific direction around the Core node
    const typeAngles: { [key: string]: number } = {
        'Customer': 0,                  // 0 degrees (East)
        'Partner': Math.PI / 3,         // 60 degrees
        'Equity': (2 * Math.PI) / 3,    // 120 degrees
        'SupplyChain': Math.PI,         // 180 degrees (West)
        'Acquisition': (4 * Math.PI) / 3, // 240 degrees
        'Competitor': (5 * Math.PI) / 3,  // 300 degrees
    };

    // Custom Clustering Force
    // Pulls non-core nodes towards a specific angle/radius relative to their connected Core node
    const clusteringForce = (alpha: number) => {
        const k = 0.5 * alpha; // Force strength
        const r = 160; // Target radius from Core

        nodes.forEach((d: any) => {
            // We only move non-core nodes. Core nodes are handled by center/charge forces.
            if (d.role === 'Core') return;

            // Find ALL links connecting this node to ANY Core node
            const coreLinks = links.filter((l: any) => {
                // Note: d3.forceLink modifies links array to use object references for source/target
                const sNode = l.source as GraphNode;
                const tNode = l.target as GraphNode;
                
                return (sNode.id === d.id && tNode.role === 'Core') || 
                       (tNode.id === d.id && sNode.role === 'Core');
            });

            if (coreLinks.length > 0) {
                 coreLinks.forEach(link => {
                    const sNode = link.source as GraphNode;
                    const tNode = link.target as GraphNode;
                    const core = sNode.role === 'Core' ? sNode : tNode;
                    const type = link.type;

                    const angle = typeAngles[type] || 0;
                    
                    if (typeof core.x === 'number' && typeof core.y === 'number') {
                        const targetX = core.x + Math.cos(angle) * r;
                        const targetY = core.y + Math.sin(angle) * r;

                        // Distribute the pull if connected to multiple cores
                        d.vx += (targetX - d.x) * k / coreLinks.length;
                        d.vy += (targetY - d.y) * k / coreLinks.length;
                    }
                 });
            }
        });
    };

    // Simulation Setup
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(150)) // Increased distance for clusters
      .force("charge", d3.forceManyBody().strength(-500)) // Stronger repulsion to prevent overlap
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(35).strength(0.8)) // Collision detection
      .force("cluster", clusteringForce); // Register custom force

    simulationRef.current = simulation;

    // Render Links
    const link = g.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .enter().append("line")
      .attr("id", (d: any) => `link-${d.source.id}-${d.target.id}`)
      .attr("stroke", (d: any) => LINK_COLORS[d.type as keyof typeof LINK_COLORS] || '#999')
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrowhead)");

    // Arrowhead Marker
    svg.append("defs").selectAll("marker")
      .data(["arrowhead"])
      .enter().append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 26) // Adjusted for node radius
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#9ca3af");

    // Render Nodes
    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .enter().append("g")
      .attr("cursor", "pointer")
      .attr("id", (d) => `node-${d.id}`)
      .call(d3.drag<SVGGElement, GraphNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Node Circles
    node.append("circle")
      .attr("r", (d) => d.role === 'Core' ? 14 : 9)
      .attr("fill", (d) => NODE_COLORS[d.role] || NODE_COLORS.Other)
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .transition().duration(500)
      .attr("r", (d) => d.role === 'Core' ? 14 : 9);

    // Node Labels
    node.append("text")
      .attr("dy", (d) => d.role === 'Core' ? 26 : 22)
      .attr("text-anchor", "middle")
      .text((d) => d.name)
      .attr("fill", "#334155")
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .style("pointer-events", "none")
      .style("text-shadow", "0 1px 2px rgba(255,255,255,0.9)");

    // Interactions
    node.on("mouseover", (event, d) => {
      setHoveredNode(d.id);
    });

    node.on("mouseout", () => {
      setHoveredNode(null);
    });

    node.on("click", (event, d) => {
      event.stopPropagation();
      onNodeClick(d);
    });

    // Simulation Tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    // Drag Functions
    function dragstarted(event: any, d: GraphNode) {
      if (!event.active) simulation?.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: GraphNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: GraphNode) {
      if (!event.active) simulation?.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [data, onNodeClick]);

  // Effect to handle highlighting (Node Hover OR Legend Filter)
  useEffect(() => {
    if (!data || !svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    
    // Determine which filter mode we are in
    // Role Legend > Type Legend > Node Hover
    const activeLegendRole = hoveredNodeRole || selectedNodeRole;
    const activeLegendType = hoveredLinkType || selectedLinkType;

    if (activeLegendRole) {
        // --- ROLE FILTER MODE ---
        // 1. Core nodes visible
        // 2. Nodes of selected role visible
        // 3. Links between visible nodes visible
        
        svg.selectAll(".nodes g")
            .transition().duration(200)
            .attr("opacity", (d: any) => {
                if (d.role === 'Core') return 1;
                if (d.role === activeLegendRole) return 1;
                return 0.1;
            });

        svg.selectAll(".links line")
            .transition().duration(200)
            .attr("opacity", (d: any) => {
                const s = d.source;
                const t = d.target;
                // Check if both endpoints are visible
                const sVisible = s.role === 'Core' || s.role === activeLegendRole;
                const tVisible = t.role === 'Core' || t.role === activeLegendRole;
                return (sVisible && tVisible) ? 0.8 : 0.05;
            })
            .attr("stroke-width", (d: any) => {
                const s = d.source;
                const t = d.target;
                const sVisible = s.role === 'Core' || s.role === activeLegendRole;
                const tVisible = t.role === 'Core' || t.role === activeLegendRole;
                return (sVisible && tVisible) ? 2 : 1;
            });

    } else if (activeLegendType) {
        // --- TYPE FILTER MODE ---
        
        // Find links that match the type
        const activeLinks = data.links.filter((l: any) => l.type === activeLegendType);
        
        // Find nodes involved in those links
        const involvedNodeIds = new Set<string>();
        activeLinks.forEach((l: any) => {
            involvedNodeIds.add(typeof l.source === 'object' ? l.source.id : l.source);
            involvedNodeIds.add(typeof l.target === 'object' ? l.target.id : l.target);
        });

        // Apply Opacity
        svg.selectAll(".nodes g")
            .transition().duration(200)
            .attr("opacity", (d: any) => {
                if (d.role === 'Core') return 1; // Always show core
                if (involvedNodeIds.has(d.id)) return 1; // Show connected
                return 0.1; // Dim others
            });

        svg.selectAll(".links line")
            .transition().duration(200)
            .attr("opacity", (d: any) => d.type === activeLegendType ? 1 : 0.05)
            .attr("stroke-width", (d: any) => d.type === activeLegendType ? 2.5 : 1);

    } else if (hoveredNode) {
      // --- NODE HOVER MODE ---
      // Get neighbors
      const linkedNodeIds = new Set<string>();
      linkedNodeIds.add(hoveredNode);
      data.links.forEach((l: any) => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        if (sId === hoveredNode) linkedNodeIds.add(tId);
        if (tId === hoveredNode) linkedNodeIds.add(sId);
      });

      // Dim nodes
      svg.selectAll(".nodes g")
        .transition().duration(200)
        .attr("opacity", (d: any) => linkedNodeIds.has(d.id) ? 1 : 0.1);

      // Dim links
      svg.selectAll(".links line")
        .transition().duration(200)
        .attr("opacity", (d: any) => {
            const sId = typeof d.source === 'object' ? d.source.id : d.source;
            const tId = typeof d.target === 'object' ? d.target.id : d.target;
            return sId === hoveredNode || tId === hoveredNode ? 1 : 0.05;
        })
        .attr("stroke-width", (d: any) => {
            const sId = typeof d.source === 'object' ? d.source.id : d.source;
            const tId = typeof d.target === 'object' ? d.target.id : d.target;
            return sId === hoveredNode || tId === hoveredNode ? 2.5 : 2;
        });
        
    } else {
      // --- DEFAULT MODE ---
      svg.selectAll(".nodes g")
        .transition().duration(200)
        .attr("opacity", 1);
      
      svg.selectAll(".links line")
        .transition().duration(200)
        .attr("opacity", 0.6)
        .attr("stroke-width", 2);
    }

  }, [hoveredNode, hoveredLinkType, selectedLinkType, hoveredNodeRole, selectedNodeRole, data]);

  // Handle Legend Interactions
  const handleTypeClick = (type: string) => {
      if (selectedLinkType === type) {
          setSelectedLinkType(null); // Deselect
      } else {
          setSelectedLinkType(type); // Select
          setSelectedNodeRole(null); // Clear role selection (mutual exclusive)
      }
  };

  const handleRoleClick = (role: string) => {
      if (selectedNodeRole === role) {
          setSelectedNodeRole(null);
      } else {
          setSelectedNodeRole(role);
          setSelectedLinkType(null); // Clear type selection (mutual exclusive)
      }
  };

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && simulationRef.current) {
         simulationRef.current.force("center", d3.forceCenter(containerRef.current.clientWidth / 2, containerRef.current.clientHeight / 2));
         simulationRef.current.alpha(0.3).restart();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleExportPNG = () => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = svg.clientWidth;
    canvas.height = svg.clientHeight;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
    img.onload = () => {
        if(ctx) {
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            const a = document.createElement("a");
            a.download = "nexus-graph.png";
            a.href = canvas.toDataURL("image/png");
            a.click();
        }
    }
  };

  const handleExportJSON = () => {
      if(!data) return;
      // Reconstruct original JSON without D3 circular references
      const exportData = {
          ...data,
          nodes: data.nodes.map(({ x, y, fx, fy, ...rest }) => rest), // Remove D3 props
          links: data.links.map((l: any) => ({
              source: l.source.id || l.source, // Handle both D3 object and raw string
              target: l.target.id || l.target,
              type: l.type,
              description: l.description,
              sourceIds: l.sourceIds
          }))
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nexus-graph.json";
      a.click();
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-white relative overflow-hidden select-none">
      
      {/* Live Activity Terminal Overlay (Bottom Left) */}
            {isLoading && (
        <div className="absolute bottom-4 left-4 z-20 font-mono text-xs">
            <div className="bg-black/80 text-green-400 p-3 rounded-md shadow-lg backdrop-blur-sm border border-green-900/50 max-w-sm">
                <div className="flex items-center gap-2 mb-2 border-b border-green-900/50 pb-1">
                    <span className="animate-pulse">{'>'}</span>
                    <span className="font-bold">SYSTEM_LOG</span>
                </div>
                <div className="space-y-1 opacity-90">
                    <p>&gt; Initiating neural search...</p>
                    <p>&gt; {status.message}</p>
                    <p className="animate-pulse">&gt; _</p>
                </div>
            </div>
        </div>
      )}

      {/* Empty State */}
      {!data && !isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
           <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
           <p className="text-lg font-light">Enter seeds and topic to generate a graph.</p>
        </div>
      )}

      <svg ref={svgRef} className="w-full h-full" />
      
      {/* Legend Overlay - Moved to Top Left */}
      {data && (
        <>
            <div className="absolute top-4 left-4 bg-white/95 p-3 rounded-lg shadow-md border border-gray-200 text-xs backdrop-blur-sm z-10">
            <p className="font-bold mb-2 text-gray-800 uppercase tracking-wider text-[10px]">Node Roles</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {Object.entries(NODE_COLORS).map(([role, color]) => {
                  const isActive = selectedNodeRole === role;
                  const isHovered = hoveredNodeRole === role;
                  return (
                    <div 
                        key={role} 
                        className={`
                            flex items-center gap-2 cursor-pointer p-1 rounded transition-all duration-200
                            ${isActive ? 'bg-blue-50 ring-1 ring-blue-200 scale-105' : ''}
                            ${!isActive && isHovered ? 'bg-gray-50 scale-105' : ''}
                        `}
                        onMouseEnter={() => setHoveredNodeRole(role)}
                        onMouseLeave={() => setHoveredNodeRole(null)}
                        onClick={() => handleRoleClick(role)}
                    >
                        <span 
                            className={`w-2.5 h-2.5 rounded-full shadow-sm transition-all ${isActive || isHovered ? 'w-3.5 h-3.5' : ''}`} 
                            style={{ backgroundColor: color }}
                        ></span>
                        <span className={`text-gray-600 ${isActive || isHovered ? 'font-semibold text-gray-900' : ''}`}>{role}</span>
                    </div>
                  );
                })}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="font-bold mb-2 text-gray-800 uppercase tracking-wider text-[10px]">Relationship Types</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {Object.entries(LINK_COLORS).map(([type, color]) => {
                        const isActive = selectedLinkType === type;
                        const isHovered = hoveredLinkType === type;
                        
                        return (
                            <div 
                                key={type} 
                                className={`
                                    flex items-center gap-2 cursor-pointer p-1 rounded transition-all duration-200
                                    ${isActive ? 'bg-blue-50 ring-1 ring-blue-200 scale-105' : ''}
                                    ${!isActive && isHovered ? 'bg-gray-50 scale-105' : ''}
                                `}
                                onMouseEnter={() => setHoveredLinkType(type)}
                                onMouseLeave={() => setHoveredLinkType(null)}
                                onClick={() => handleTypeClick(type)}
                            >
                                <span 
                                    className={`w-3 h-0.5 rounded-full shadow-sm transition-all ${isActive || isHovered ? 'w-4 h-1' : ''}`} 
                                    style={{ backgroundColor: color }}
                                ></span>
                                <span className={`text-gray-600 truncate max-w-[80px] ${isActive || isHovered ? 'font-semibold text-gray-900' : ''}`}>
                                    {type}
                                </span>
                            </div>
                        );
                    })}
                </div>
                {(hoveredLinkType || selectedLinkType || hoveredNodeRole || selectedNodeRole) && (
                    <div className="mt-2 text-[10px] text-blue-500 text-center animate-fade-in">
                        {hoveredLinkType || hoveredNodeRole ? 'Viewing ' : 'Filtering: '} 
                        <span className="font-bold">
                            {hoveredNodeRole || selectedNodeRole || hoveredLinkType || selectedLinkType}
                        </span> 
                        {hoveredNodeRole || selectedNodeRole ? ' nodes' : ' relationships'}
                    </div>
                )}
            </div>
            </div>

            {/* Export Actions */}
            <div className="absolute top-4 right-4 flex gap-2 z-10">
                <button 
                    onClick={handleExportPNG}
                    className="bg-white hover:bg-gray-50 text-gray-700 p-2 rounded-lg shadow border border-gray-200 text-xs font-medium transition-all"
                    title="Download PNG"
                >
                    📷 PNG
                </button>
                <button 
                    onClick={handleExportJSON}
                    className="bg-white hover:bg-gray-50 text-gray-700 p-2 rounded-lg shadow border border-gray-200 text-xs font-medium transition-all"
                    title="Download JSON"
                >
                    💾 JSON
                </button>
            </div>
        </>
      )}
    </div>
  );
};

export default GraphCanvas;