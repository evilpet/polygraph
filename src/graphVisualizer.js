import Sigma from 'sigma';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import { escapeHtml } from './htmlEscape.js';

/**
 * Layouts nodes in distinct sub-network community clusters/clumps:
 * - Ego at center (0,0)
 * - Direct degree-1 partners spaced around Ego
 * - Sub-clusters (Polycules, Slut Star Networks, Monogamous Cheaters) clumped around their parent hubs
 * - Extended N-degree nodes radiating outward in local cluster bubbles
 */
function applyClusterLayout(graph) {
  const nodes = graph.nodes();
  if (nodes.length === 0) return;

  // 1. Find Ego and Degree 1 Hubs
  let egoNode = 'ego';
  if (!graph.hasNode(egoNode)) {
    egoNode = nodes[0];
  }

  graph.setNodeAttribute(egoNode, 'x', 0);
  graph.setNodeAttribute(egoNode, 'y', 0);

  // Find direct neighbors of Ego (Degree 1 hubs)
  const directNeighbors = graph.hasNode(egoNode) ? graph.neighbors(egoNode) : [];
  const hubCount = Math.max(1, directNeighbors.length);

  const hubCenters = new Map();
  const radiusFromEgo = Math.max(220, Math.sqrt(nodes.length) * 25);

  directNeighbors.forEach((hubId, idx) => {
    const angle = (2 * Math.PI * idx) / hubCount;
    const hx = radiusFromEgo * Math.cos(angle);
    const hy = radiusFromEgo * Math.sin(angle);

    graph.setNodeAttribute(hubId, 'x', hx);
    graph.setNodeAttribute(hubId, 'y', hy);

    hubCenters.set(hubId, { x: hx, y: hy, angle });
  });

  // 2. Position remaining nodes in tight sub-cluster bubbles around their parent hubs
  const visited = new Set([egoNode, ...directNeighbors]);

  directNeighbors.forEach(hubId => {
    const hubPos = hubCenters.get(hubId);
    const children = graph.neighbors(hubId).filter(n => !visited.has(n));

    const childCount = children.length;
    const subRadius = Math.max(60, Math.sqrt(childCount) * 28);

    children.forEach((childId, cIdx) => {
      visited.add(childId);
      const subAngle = (2 * Math.PI * cIdx) / Math.max(1, childCount);

      // Offset position in parent's sub-cluster bubble
      const cx = hubPos.x + (subRadius * Math.cos(subAngle));
      const cy = hubPos.y + (subRadius * Math.sin(subAngle));

      graph.setNodeAttribute(childId, 'x', cx);
      graph.setNodeAttribute(childId, 'y', cy);

      // Position N-degree descendants around child
      const grandChildren = graph.neighbors(childId).filter(n => !visited.has(n));
      const grandCount = grandChildren.length;
      const grandRadius = Math.max(40, Math.sqrt(grandCount) * 20);

      grandChildren.forEach((gId, gIdx) => {
        visited.add(gId);
        const gAngle = (2 * Math.PI * gIdx) / Math.max(1, grandCount);
        graph.setNodeAttribute(gId, 'x', cx + (grandRadius * Math.cos(gAngle)));
        graph.setNodeAttribute(gId, 'y', cy + (grandRadius * Math.sin(gAngle)));
      });
    });
  });

  // Position any remaining unvisited background nodes in an outer ring
  let unvisitedIdx = 0;
  const unvisitedNodes = nodes.filter(n => !visited.has(n));
  const outerRadius = radiusFromEgo * 1.8;

  unvisitedNodes.forEach(nodeId => {
    const uAngle = (2 * Math.PI * unvisitedIdx) / Math.max(1, unvisitedNodes.length);
    graph.setNodeAttribute(nodeId, 'x', outerRadius * Math.cos(uAngle));
    graph.setNodeAttribute(nodeId, 'y', outerRadius * Math.sin(uAngle));
    unvisitedIdx++;
  });
}

export class GraphVisualizer {
  constructor(containerElement, tooltipElement) {
    this.container = containerElement;
    this.tooltip = tooltipElement;
    this.renderer = null;
    this.graph = null;
    this.hoveredNode = null;
    this.selectedNode = null;

    if (typeof ResizeObserver !== 'undefined' && this.container) {
      const ro = new ResizeObserver(() => {
        if (this.renderer && this.container.clientWidth > 0 && this.container.clientHeight > 0) {
          this.renderer.refresh();
        }
      });
      ro.observe(this.container);
    }
  }

  render(graph) {
    this.graph = graph;

    // 1. Arrange nodes in sub-network community clusters/clumps
    applyClusterLayout(graph);

    // 2. Set edge weights (tighter forces for polycule ingroups & direct bonds)
    graph.forEachEdge((edge, attributes, source, target) => {
      const type = attributes.relationshipType || 'external';
      let weight = 1.0;
      if (type === 'internal') weight = 3.5; // Polycule ingroups form tight clumps
      else if (type === 'cheating') weight = 2.0;
      else weight = 0.8; // External links are looser
      graph.setEdgeAttribute(edge, 'weight', weight);
    });

    // 3. ForceAtlas2 physics tuned for LinLog community clumping
    const fa2Settings = forceAtlas2.inferSettings(graph);
    forceAtlas2.assign(graph, {
      iterations: 150,
      settings: {
        ...fa2Settings,
        gravity: 0.6, // Holds clusters near center while allowing clear separation
        scalingRatio: 16, // Spreads sub-network clumps apart
        linLogMode: true, // LinLog mode accentuates distinct sub-network clumping
        edgeWeightInfluence: 1.8, // Tighter bonds inside polycules & hubs
        adjustSizes: true,
        barnesHutOptimize: true
      }
    });

    // Destroy existing renderer if updating graph
    if (this.renderer) {
      this.renderer.kill();
      this.renderer = null;
    }

    // 4. Initialize Sigma Renderer
    this.renderer = new Sigma(graph, this.container, {
      allowInvalidContainer: true,
      allowReactParams: true,
      renderEdgeLabels: false,
      enableEdgeEvents: false,
      labelFont: 'Outfit, sans-serif',
      labelColor: { color: '#e2e8f0' },
      labelSize: 12,
      labelWeight: '600',
      defaultNodeColor: '#9d4edd',
      defaultEdgeColor: '#3b82f644',
      
      // Reduce label clutter: only display labels for Ego & Direct Degree-1 partners by default
      nodeReducer: (node, data) => {
        const res = { ...data };
        if (data.degree > 1 && this.hoveredNode !== node) {
          res.label = ''; // Hide label text for distant N-degree background nodes unless hovered
        }
        return res;
      }
    });

    this.bindInteractions();

    // 5. Force camera to auto-fit network node bounding box immediately
    requestAnimationFrame(() => {
      if (this.renderer) {
        this.renderer.refresh();
        this.renderer.getCamera().animatedReset({ duration: 0 });
      }
    });

    setTimeout(() => {
      if (this.renderer) {
        this.renderer.refresh();
        this.renderer.getCamera().animatedReset({ duration: 0 });
      }
    }, 100);

    setTimeout(() => {
      if (this.renderer) {
        this.renderer.refresh();
        this.renderer.getCamera().animatedReset({ duration: 0 });
      }
    }, 300);
  }

  bindInteractions() {
    if (!this.renderer) return;

    // Hover tooltip & highlight
    this.renderer.on('enterNode', ({ node }) => {
      this.hoveredNode = node;
      this.renderer.refresh();
      this.showTooltip(node);
    });

    this.renderer.on('leaveNode', () => {
      this.hoveredNode = null;
      this.renderer.refresh();
      this.hideTooltip();
    });

    // Node drag and drop
    let isDragging = false;
    let draggedNode = null;

    this.renderer.on('downNode', ({ node }) => {
      isDragging = true;
      draggedNode = node;
      this.graph.setNodeAttribute(node, 'highlighted', true);
    });

    this.renderer.getMouseCaptor().on('mousemove', (e) => {
      if (!isDragging || !draggedNode) return;

      const pos = this.renderer.viewportToGraph(e);
      this.graph.setNodeAttribute(draggedNode, 'x', pos.x);
      this.graph.setNodeAttribute(draggedNode, 'y', pos.y);
      this.renderer.refresh();
    });

    this.renderer.getMouseCaptor().on('mouseup', () => {
      if (draggedNode) {
        this.graph.setNodeAttribute(draggedNode, 'highlighted', false);
      }
      isDragging = false;
      draggedNode = null;
    });
  }

  showTooltip(node) {
    if (!this.tooltip || !this.graph) return;

    const attrs = this.graph.getNodeAttributes(node);
    const label = attrs.label || node;
    const type = attrs.relationshipType || 'extended';
    const degree = attrs.degree !== undefined ? attrs.degree : '?';
    const partnersCount = attrs.partnersCount || 'N/A';

    let typeColor = '#00f0ff';
    if (type.includes('polycule')) typeColor = '#00f0ff';
    else if (type.includes('slut')) typeColor = '#ff2a85';
    else if (type.includes('monogamous')) typeColor = '#00ff87';

    this.tooltip.innerHTML = `
      <div style="font-weight: 700; color: ${typeColor}; font-size: 13px;">${escapeHtml(label)}</div>
      <div style="margin-top: 4px; color: #cbd5e1;">Type: <strong>${escapeHtml(type.toUpperCase())}</strong></div>
      <div style="color: #cbd5e1;">Network Distance: <strong>Degree ${escapeHtml(degree)}</strong></div>
      <div style="color: #cbd5e1;">Partners Count: <strong>${escapeHtml(partnersCount)}</strong></div>
    `;

    this.tooltip.style.display = 'block';

    if (this.renderer && this.graph.hasNode(node)) {
      const nodePosition = this.graph.getNodeAttributes(node);
      const viewportPos = this.renderer.graphToViewport({ x: nodePosition.x, y: nodePosition.y });
      this.tooltip.style.left = `${Math.round(viewportPos.x + 15)}px`;
      this.tooltip.style.top = `${Math.round(viewportPos.y + 15)}px`;
    }
  }

  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.style.display = 'none';
    }
  }

  recenter() {
    if (this.renderer) {
      this.renderer.refresh();
      this.renderer.getCamera().animatedReset({ duration: 250 });
    }
  }
}
