// src/components/FundFlowGraph.jsx
// Interactive graph built with React Flow
// Node shape from backend:
//   { id, address, chain, label, nodeType, entityName, confidence, isSuspect, isVasp, ... }
// Edge shape from backend:
//   { id, source, target, label, amount, asset, txHash, ... }
import ReactFlow, { Background, Controls, MiniMap, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';

const NODE_COLORS = {
  SUSPECT_WALLET:      '#dc2626',
  VASP_WALLET:         '#2563eb',
  INTERMEDIARY_WALLET: '#d97706',
  EXCHANGE_CLUSTER:    '#7c3aed',
  UNKNOWN:             '#4b5563',
};

function nodeColor(type) {
  return NODE_COLORS[type] || NODE_COLORS.UNKNOWN;
}

// Auto-layout: arrange nodes left-to-right based on address position in highlightedPath
function autoLayout(nodes, highlightedPath) {
  const pathMap = {};
  (highlightedPath || []).forEach((id, i) => { pathMap[id] = i; });

  // Group by path index, fallback to alphabetical
  const positioned = nodes.map((n) => {
    const pathIdx = pathMap[n.id] ?? pathMap[n.address] ?? -1;
    return { ...n, _pathIdx: pathIdx };
  });

  const sorted = [...positioned].sort((a, b) => {
    if (a._pathIdx !== -1 && b._pathIdx !== -1) return a._pathIdx - b._pathIdx;
    if (a._pathIdx !== -1) return -1;
    if (b._pathIdx !== -1) return 1;
    return 0;
  });

  const MARGIN_X = 220;
  const MARGIN_Y = 120;
  const perRow   = Math.ceil(Math.sqrt(sorted.length));

  return sorted.map((n, i) => ({
    ...n,
    position: n.position || {
      x: (i % perRow) * MARGIN_X + 40,
      y: Math.floor(i / perRow) * MARGIN_Y + 40,
    },
  }));
}

function Legend() {
  return (
    <div className="absolute bottom-12 left-3 z-10 rounded-lg border border-[#30363d] bg-[#161b22]/95 p-3 text-xs space-y-1.5 pointer-events-none">
      {Object.entries({
        SUSPECT_WALLET:      'Suspect Wallet',
        INTERMEDIARY_WALLET: 'Intermediary',
        VASP_WALLET:         'VASP Destination',
        UNKNOWN:             'Unknown Node',
      }).map(([type, label]) => (
        <div key={type} className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full shrink-0" style={{ background: nodeColor(type) }} />
          <span className="text-[#8b949e]">{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function FundFlowGraph({ nodes = [], edges = [], highlightedPath = [] }) {
  if (!nodes.length) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-[#30363d] text-[#8b949e] text-sm">
        No graph data available.
      </div>
    );
  }

  const highlightSet = new Set(highlightedPath);
  const laidOut      = autoLayout(nodes, highlightedPath);

  const rfNodes = laidOut.map((n) => {
    // nodeType from backend (SUSPECT_WALLET, INTERMEDIARY_WALLET, VASP_WALLET, UNKNOWN, ...)
    const type  = n.nodeType || (n.isSuspect ? 'SUSPECT_WALLET' : n.isVasp ? 'VASP_WALLET' : 'UNKNOWN');
    const color = nodeColor(type);
    const isHL  = highlightSet.has(n.id) || highlightSet.has(n.address);

    // Label: use entityName if known, else truncated address
    const displayLabel = n.entityName || n.label ||
      (n.address ? n.address.slice(0, 8) + '…' + n.address.slice(-4) : n.id);

    return {
      id:       n.id,
      position: n.position,
      data: {
        label: (
          <div className="px-2 py-1 text-[10px] max-w-[150px] text-center leading-tight">
            <p className="font-bold truncate">{displayLabel}</p>
            <p className="opacity-70 text-[9px] mt-0.5">{type.replace(/_/g, ' ')}</p>
            {n.confidence > 0 && (
              <p className="opacity-60 text-[9px]">{n.confidence}% conf.</p>
            )}
          </div>
        ),
      },
      style: {
        background:  color,
        border:      isHL ? '2px solid #f0f6fc' : '1px solid rgba(255,255,255,0.15)',
        borderRadius: 10,
        color:       '#f0f6fc',
        minWidth:    130,
        fontSize:    11,
      },
    };
  });

  const rfEdges = edges.map((e) => {
    const edgeLabel = e.label
      || (e.amount && e.asset ? `${e.amount} ${e.asset}` : null)
      || '';
    return {
      id:     e.id || `${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      label:  edgeLabel,
      labelStyle:  { fill: '#8b949e', fontSize: 9 },
      markerEnd:   { type: MarkerType.ArrowClosed, color: '#58a6ff' },
      style:       { stroke: '#58a6ff', strokeWidth: 1.5 },
      animated:    true,
    };
  });

  return (
    <div className="relative h-[420px] rounded-xl border border-[#30363d] overflow-hidden">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        attributionPosition="bottom-right"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#30363d" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={(n) => n.style?.background || '#4b5563'}
          maskColor="rgba(0,0,0,0.6)"
          style={{ background: '#161b22' }}
        />
      </ReactFlow>
      <Legend />
    </div>
  );
}
