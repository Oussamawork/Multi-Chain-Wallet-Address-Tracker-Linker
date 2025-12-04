import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphData, Node, Link, ConnectionType } from '../types';
import { COLORS } from '../constants';

interface Props {
  data: GraphData;
}

const GraphVisualization: React.FC<Props> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Handle Resize
  useEffect(() => {
    const updateDims = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    window.addEventListener('resize', updateDims);
    updateDims();
    return () => window.removeEventListener('resize', updateDims);
  }, []);

  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    const width = dimensions.width;
    const height = dimensions.height;

    const nodes = data.nodes.map(d => ({ ...d }));
    const links = data.links.map(d => ({ ...d }));

    const simulation = d3.forceSimulation(nodes as any)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius((d: any) => d.val * 2.5));

    // Zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    // @ts-ignore
    svg.call(zoom);

    const g = svg.append("g");

    // Defs for markers (arrows)
    svg.append("defs").selectAll("marker")
    .data(["end"])
    .enter().append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 25)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#999");

    // Links
    const link = g.append("g")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d) => Math.sqrt(d.value) * 1.5)
      .attr("stroke", (d) => {
        if (d.type === ConnectionType.DIRECT) return COLORS.linkDirect;
        if (d.type === ConnectionType.MIDDLEMAN) return '#f59e0b'; // Amber for Middleman
        if (d.type === ConnectionType.TIME_PROXIMATE) return '#d946ef'; // Magenta for Time
        return COLORS.linkShared;
      })
      .attr("stroke-dasharray", (d) => {
        if (d.type === ConnectionType.TIME_PROXIMATE) return "5,5"; // Dashed for time links
        return null;
      });

    // Nodes
    const node = g.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => d.val)
      .attr("fill", (d) => {
        if (d.group === 'input') return COLORS.input;
        if (d.group === 'program') return COLORS.program;
        if (d.group === 'middleman') return '#f59e0b'; // Amber
        return COLORS.counterparty;
      })
      .call(drag(simulation) as any);

    // Tooltips
    node.append("title")
      .text((d) => `${d.id}\nType: ${d.group}`);

    // Labels
    const label = g.append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .attr("dy", (d) => -d.val - 5)
      .attr("text-anchor", "middle")
      .text((d) => d.group === 'input' || d.group === 'middleman' ? d.label : '') 
      .attr("font-size", "10px")
      .attr("fill", "#e2e8f0")
      .attr("pointer-events", "none")
      .style("text-shadow", "0 1px 2px rgba(0,0,0,0.8)");

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("cx", (d: any) => d.x)
        .attr("cy", (d: any) => d.y);
      
      label
        .attr("x", (d: any) => d.x)
        .attr("y", (d: any) => d.y);
    });

    return () => {
      simulation.stop();
    };
  }, [data, dimensions]);

  // Drag helper
  const drag = (simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>) => {
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }

  return (
    <div ref={containerRef} className="w-full h-full min-h-[500px] bg-slate-900 rounded-xl border border-slate-700 overflow-hidden relative shadow-inner">
      <svg ref={svgRef} width="100%" height="100%" className="cursor-grab active:cursor-grabbing" />
      <div className="absolute bottom-4 right-4 bg-slate-800/80 backdrop-blur p-3 rounded-lg border border-slate-600 text-xs text-slate-300 pointer-events-none">
        <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Target Input</div>
        <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 rounded-full bg-amber-500"></div> Middleman / Hub</div>
        <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Common Counterparty</div>
        <div className="flex items-center gap-2"><div className="w-8 h-0.5 border-t border-dashed border-pink-500"></div> Time-Proximate</div>
      </div>
    </div>
  );
};

export default GraphVisualization;