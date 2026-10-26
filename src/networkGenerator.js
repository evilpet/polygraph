import Graph from 'graphology';

// Bounds for user-controllable profile parameters. Without these, an extreme
// (or attacker-crafted) value such as egoPartners=1e9 drives an unbounded
// O(n^2) node/edge build that freezes the main thread / exhausts memory.
const MAX_DIRECT_PARTNERS = 500;
const MAX_DEGREES = 10;

/** Clamp egoPartners to a finite, non-negative integer within [0, MAX_DIRECT_PARTNERS]. */
function clampEgoPartners(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, MAX_DIRECT_PARTNERS);
}

/** Clamp nDegrees to a finite integer within [1, MAX_DEGREES]. */
function clampDegrees(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_DEGREES);
}

export class NetworkGenerator {
  constructor(params = {}) {
    this.params = params;
  }

  updateParams(params) {
    this.params = { ...this.params, ...params };
  }

  /**
   * Generates a Graphology network graph modeling Ego, direct partners,
   * polycules, monogamous cheaters, and extended N-degree connections
   * with Party Scene Triadic Closure (Loopback) dynamics.
   */
  generateGraph() {
    const graph = new Graph({ type: 'undirected' });
    const p = this.params;

    let nodeCounter = 0;
    const maxNodes = p.maxNodesLimit || 250;

    const createNode = (type, label, degree = 1, extra = {}) => {
      nodeCounter++;
      const id = `node_${nodeCounter}_${type}`;
      
      let color = '#9d4edd';
      let size = 10;

      if (type === 'ego') {
        color = '#ff2a85';
        size = 18;
      } else if (type === 'polycule') {
        color = '#00f0ff';
        size = 12;
      } else if (type === 'monogamous') {
        color = '#00ff87';
        size = 11;
      } else if (type === 'slut') {
        color = '#ff2a85';
        size = 14;
      } else if (type === 'cheater_secret') {
        color = '#ff4757';
        size = 9;
      }

      graph.addNode(id, {
        label: `${label} ${type === 'slut' ? '❤️' : ''}`,
        relationshipType: type,
        degree,
        color,
        size,
        ...extra
      });

      return id;
    };

    const addEdge = (source, target, relationshipType, protectedRatio = 0.5) => {
      if (graph.hasEdge(source, target) || graph.hasEdge(target, source)) return;

      let edgeColor = '#3b82f644';
      let size = 1.5;

      if (relationshipType === 'internal') {
        edgeColor = '#00f0ff88';
        size = 2.5;
      } else if (relationshipType === 'cheating') {
        edgeColor = '#ff4757aa';
        size = 2.0;
      } else if (relationshipType === 'external') {
        edgeColor = '#ff2a8566';
      }

      graph.addEdge(source, target, {
        relationshipType,
        protectedRatio,
        color: edgeColor,
        size
      });
    };

    // 1. Create EGO node (Degree 0)
    const egoId = createNode('ego', 'Ego (You)', 0);

    // 2. Determine Direct Partner Allocations (Degree 1)
    const totalPartners = clampEgoPartners(p.egoPartners);
    const maxDegrees = clampDegrees(p.nDegrees);
    const partnerSum = (p.polyculePct + p.monogamousPct + p.slutPct) || 100;
    const numMono = Math.round((p.monogamousPct / partnerSum) * totalPartners);
    const numSlut = Math.round((p.slutPct / partnerSum) * totalPartners);
    const numPoly = Math.max(0, totalPartners - numMono - numSlut);

    const directPartnerNodes = [];

    // Polycule Nodes (Ingrouping vs Outgrouping)
    const polyculeNodes = [];
    for (let i = 0; i < numPoly; i++) {
      const pId = createNode('polycule', `Primary Partner (Poly ${i + 1})`, 1);
      directPartnerNodes.push({ id: pId, type: 'polycule' });
      polyculeNodes.push(pId);
      addEdge(egoId, pId, 'internal', p.condomUsageInternal);
    }

    // Connect Polycule Ingroup bonds (triangles/cliques based on Ingrouping = 1 - sluttiness)
    const ingroupConnectivity = 1 - p.sluttinessIndex;
    for (let i = 0; i < polyculeNodes.length; i++) {
      for (let j = i + 1; j < polyculeNodes.length; j++) {
        if (Math.random() < ingroupConnectivity + 0.3) {
          addEdge(polyculeNodes[i], polyculeNodes[j], 'internal', p.condomUsageInternal);
        }
      }
    }

    // Monogamous Partners (Degree 1)
    for (let i = 0; i < numMono; i++) {
      const mId = createNode('monogamous', `Monogamous Partner ${i + 1}`, 1);
      directPartnerNodes.push({ id: mId, type: 'monogamous' });
      addEdge(egoId, mId, 'internal', p.condomUsageInternal);

      const isCheating = Math.random() * 100 < p.cheatingLikelihood;
      if (isCheating) {
        const secretId = createNode('cheater_secret', `Secret Hookup (Mono ${i + 1})`, 2, {
          isSecret: true
        });
        addEdge(mId, secretId, 'cheating', p.condomUsageCheating);
      }
    }

    // Slut / High-Degree Open Connectors (Degree 1)
    for (let i = 0; i < numSlut; i++) {
      const sId = createNode('slut', `Slut Partner ${i + 1} (${p.slutAvgPartners} Ptrs)`, 1, {
        partnerCapacity: p.slutAvgPartners
      });
      directPartnerNodes.push({ id: sId, type: 'slut' });
      addEdge(egoId, sId, 'external', p.condomUsageExternal);
    }

    // 3. Extended Network Expansion with Party Scene Loopback Dynamics
    const loopbackRatio = ((p.partyLoopbackPct !== undefined ? p.partyLoopbackPct : 40) / 100);

    if (p.previewExtended && maxDegrees >= 2) {
      let currentDegreeNodes = [...directPartnerNodes.map(d => ({ ...d, degree: 1 }))];

      for (let degree = 2; degree <= maxDegrees; degree++) {
        if (graph.order >= maxNodes) break;
        const nextDegreeNodes = [];

        for (const parent of currentDegreeNodes) {
          if (graph.order >= maxNodes) break;

          let numBranch = 1;
          if (parent.type === 'slut') {
            numBranch = Math.min(
              Math.round(p.slutAvgPartners * (degree === 2 ? 0.7 : 0.3)),
              12
            );
          } else if (parent.type === 'polycule') {
            numBranch = Math.round(p.polyculeSize * p.sluttinessIndex * (3 / degree));
          } else if (parent.type === 'monogamous') {
            numBranch = Math.random() < (p.cheatingLikelihood / 100) ? 1 : 0;
          } else {
            numBranch = Math.round(2.5 * p.sluttinessIndex);
          }

          for (let b = 0; b < numBranch; b++) {
            if (graph.order >= maxNodes) break;

            // Party Scene Triadic Closure / Loopback: Connect to existing partner in scene
            const candidatesForLoopback = currentDegreeNodes.filter(n => n.id !== parent.id);
            if (candidatesForLoopback.length > 2 && Math.random() < loopbackRatio) {
              const targetExisting = candidatesForLoopback[Math.floor(Math.random() * candidatesForLoopback.length)];
              if (!graph.hasEdge(parent.id, targetExisting.id)) {
                const condomRate = (parent.type === 'polycule' && targetExisting.type === 'polycule') 
                  ? p.condomUsageInternal 
                  : p.condomUsageExternal;
                addEdge(parent.id, targetExisting.id, 'external', condomRate);
                continue; // Loopback link established!
              }
            }

            // Otherwise spawn new extended partner
            const randType = Math.random();
            let childType = 'extended';
            let label = `Deg ${degree} Partner`;

            if (randType < 0.25) {
              childType = 'slut';
              label = `Extended Slut (Deg ${degree})`;
            } else if (randType < 0.55) {
              childType = 'polycule';
              label = `Extended Poly (Deg ${degree})`;
            } else {
              childType = 'monogamous';
              label = `Extended Mono (Deg ${degree})`;
            }

            const childId = createNode(childType, label, degree);
            const edgeType = (parent.type === 'polycule' && childType === 'polycule' && Math.random() > p.sluttinessIndex) 
              ? 'internal' 
              : 'external';
            const condomRate = edgeType === 'internal' ? p.condomUsageInternal : p.condomUsageExternal;

            addEdge(parent.id, childId, edgeType, condomRate);
            nextDegreeNodes.push({ id: childId, type: childType, degree: degree });
          }
        }

        currentDegreeNodes = nextDegreeNodes;
      }
    }

    return graph;
  }

  /**
   * Calculates mathematical extended network node statistics
   * incorporating Party Scene Loopback / Triadic Closure saturation
   */
  calculateNetworkMetrics(graph) {
    const p = this.params;
    const egoPartners = clampEgoPartners(p.egoPartners);
    const maxDegrees = clampDegrees(p.nDegrees);
    const loopbackRatio = ((p.partyLoopbackPct !== undefined ? p.partyLoopbackPct : 40) / 100);
    
    const slutRatio = p.slutPct / 100;
    const polyRatio = p.polyculePct / 100;
    const monoRatio = p.monogamousPct / 100;

    const rawBranching = (slutRatio * p.slutAvgPartners) + 
                         (polyRatio * p.polyculeSize * p.sluttinessIndex) + 
                         (monoRatio * (1 + (p.cheatingLikelihood / 100)));

    const avgDirectBranching = rawBranching * (1 - (loopbackRatio * 0.45));

    const theoreticalCountByDegree = [1];
    let cumulativeTheoretical = 1;
    const maxSubculturePoolSize = p.demographicProfile === 'sf_high_risk' ? 50000 : 500000;

    for (let d = 1; d <= maxDegrees; d++) {
      if (d === 1) {
        const d1Count = Math.min(maxSubculturePoolSize, egoPartners);
        theoreticalCountByDegree.push(d1Count);
        cumulativeTheoretical += d1Count;
      } else {
        const prevCount = theoreticalCountByDegree[d - 1];
        const effectiveBranch = (avgDirectBranching < 0.05) ? 0 : Math.max(0.05, avgDirectBranching * Math.pow(1 - (loopbackRatio * 0.25), d - 1));
        const remainingCap = Math.max(0, maxSubculturePoolSize - cumulativeTheoretical);
        const degreeCount = Math.min(remainingCap, Math.round(prevCount * effectiveBranch));
        theoreticalCountByDegree.push(degreeCount);
        cumulativeTheoretical += degreeCount;
      }
    }

    const partnerSum = (p.polyculePct + p.monogamousPct + p.slutPct) || 100;
    const casualRatio = p.slutPct / partnerSum;
    const totalOutgroupRatio = Math.min(1.0, casualRatio + ((1 - casualRatio) * (p.sluttinessIndex || 0)));
    const ingroupRatio = 1 - totalOutgroupRatio;

    return {
      renderedNodes: graph.order,
      renderedEdges: graph.size,
      theoreticalTotalNodes: cumulativeTheoretical,
      theoreticalCountByDegree,
      avgBranchingFactor: avgDirectBranching.toFixed(2),
      ingroupRatio: (ingroupRatio * 100).toFixed(0),
      outgroupRatio: (totalOutgroupRatio * 100).toFixed(0)
    };
  }
}
