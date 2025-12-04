import { ParsedTxInfo, GraphData, Node, Link, ConnectionType, AnalysisSummary, AnalysisConfig } from '../types';
import { IGNORED_PROGRAMS } from '../constants';

// Helper to calculate confidence score (0-100)
const calculateConfidence = (pairs: any[]) => {
  if (pairs.length === 0) return 0;
  
  let totalScore = 0;
  // Weighted scoring
  pairs.forEach(p => {
    switch (p.type) {
      case ConnectionType.DIRECT: totalScore += 40; break;
      case ConnectionType.MIDDLEMAN: totalScore += 30; break;
      case ConnectionType.TIME_PROXIMATE: totalScore += 20; break;
      case ConnectionType.SHARED_COUNTERPARTY: totalScore += 10; break;
      default: totalScore += 5;
    }
  });

  // Cap at 100
  return Math.min(Math.round(totalScore), 100);
};

export const analyzeConnections = (
  inputs: { [address: string]: ParsedTxInfo[] },
  config: AnalysisConfig
): { graph: GraphData; summary: AnalysisSummary } => {
  const inputAddresses = Object.keys(inputs);
  const nodes = new Map<string, Node>();
  const links = new Map<string, Link>();
  const connectedPairs = new Map<string, { addressA: string, addressB: string, reason: string, score: number, type: ConnectionType }>();
  
  let totalTx = 0;
  const uniqueCounterpartiesSet = new Set<string>();

  // 1. Initialize Input Nodes
  inputAddresses.forEach(addr => {
    nodes.set(addr, {
      id: addr,
      group: 'input',
      label: `${addr.slice(0, 4)}...${addr.slice(-4)}`,
      val: 25
    });
    totalTx += inputs[addr].length;
  });

  // Helper to add link
  const addLink = (source: string, target: string, type: ConnectionType, weight = 1, details = "") => {
    if (source === target) return;
    const linkId = [source, target].sort().join('-');
    
    if (links.has(linkId)) {
      const l = links.get(linkId)!;
      l.value += weight;
      if (type === ConnectionType.DIRECT || type === ConnectionType.MIDDLEMAN) {
        l.type = type; // Upgrade link type if stronger connection found
      }
    } else {
      links.set(linkId, { source, target, type, value: weight, details });
    }
  };

  const addNode = (id: string, group: 'counterparty' | 'program' | 'middleman') => {
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        group,
        label: `${id.slice(0, 4)}...${id.slice(-4)}`,
        val: group === 'middleman' ? 15 : 5
      });
    } else {
      const n = nodes.get(id)!;
      n.val += 1;
      if (group === 'middleman') n.group = 'middleman'; // Upgrade node type
    }
  };

  const recordPair = (addrA: string, addrB: string, reason: string, score: number, type: ConnectionType) => {
    const pairKey = [addrA, addrB].sort().join('-');
    // Keep the strongest reason/score for this pair
    if (!connectedPairs.has(pairKey) || (connectedPairs.get(pairKey)!.score < score)) {
      connectedPairs.set(pairKey, { addressA: addrA, addressB: addrB, reason, score, type });
    }
  };

  // --- DATA STRUCTURES FOR ADVANCED ANALYSIS ---
  // Map<Counterparty, Array<{inputAddr, timestamp, txSig}>>
  const interactionLog = new Map<string, Array<{input: string, time: number, tx: string}>>();

  // 2. Process Data
  inputAddresses.forEach(sourceAddr => {
    const txs = inputs[sourceAddr];
    
    txs.forEach(tx => {
      // 2.1 Direct Transfers
      tx.recipients.forEach(recipient => {
        if (inputAddresses.includes(recipient)) {
          addLink(sourceAddr, recipient, ConnectionType.DIRECT, 5, "Direct Transfer");
          recordPair(sourceAddr, recipient, `Direct transfer in tx ${tx.signature.slice(0,8)}...`, 50, ConnectionType.DIRECT);
        } else {
          // Track for Common Counterparty & Time Analysis
          uniqueCounterpartiesSet.add(recipient);
          addNode(recipient, 'counterparty');
          addLink(sourceAddr, recipient, ConnectionType.SHARED_COUNTERPARTY, 0.5);

          if (!interactionLog.has(recipient)) interactionLog.set(recipient, []);
          interactionLog.get(recipient)!.push({ input: sourceAddr, time: tx.blockTime, tx: tx.signature });
        }
      });

      // 2.2 Shared Programs
      if (config.includePrograms) {
        tx.programIds.forEach(prog => {
          if (IGNORED_PROGRAMS.includes(prog)) return;
          addNode(prog, 'program');
          addLink(sourceAddr, prog, ConnectionType.SHARED_PROGRAM, 0.5);
        });
      }
    });
  });

  // 3. Advanced Heuristics

  // 3.1 Time-Proximate Transactions & Common Counterparties
  interactionLog.forEach((interactions, counterparty) => {
    // Only interesting if > 1 distinct input address interacted with this counterparty
    const distinctInputs = new Set(interactions.map(i => i.input));
    if (distinctInputs.size < 2) return;

    // Check Time Proximity
    interactions.sort((a, b) => a.time - b.time);
    
    for (let i = 0; i < interactions.length; i++) {
      for (let j = i + 1; j < interactions.length; j++) {
        const a = interactions[i];
        const b = interactions[j];
        
        if (a.input === b.input) continue; // Skip same wallet
        
        const timeDiff = Math.abs(a.time - b.time);
        
        if (timeDiff <= config.timeWindowSeconds) {
           addLink(a.input, counterparty, ConnectionType.TIME_PROXIMATE, 2);
           addLink(b.input, counterparty, ConnectionType.TIME_PROXIMATE, 2);
           
           recordPair(a.input, b.input, 
             `Interacted with same entity (${counterparty.slice(0,4)}..) within ${timeDiff}s`, 
             30, 
             ConnectionType.TIME_PROXIMATE
           );
        }
      }
    }
  });

  // 3.2 Middleman Detection (1-Hop)
  // Logic: Input A -> Middleman -> Input B (or vice versa)
  // We need to look at the flow. 
  // In the current limited fetch, we see A->Recipients. We don't have Recipient->B history unless B is also an input.
  // However, if A sent to M, and B sent to M, that's a common counterparty.
  // If A sent to M, and M is actually B (checked in Direct).
  // True "Middleman" in this context usually means we see A->M and B receiving from M. 
  // Without scraping M's history, we can only infer if M is a known connector.
  // Simplified "Hub" Detection: If a counterparty connects > 2 inputs, mark as Middleman/Hub.
  
  interactionLog.forEach((interactions, entity) => {
    const distinctInputs = new Set(interactions.map(i => i.input));
    if (distinctInputs.size >= 2) {
       // It's a connector. Check if it's strong enough to be a middleman
       if (distinctInputs.size > 2 || interactions.length > 5) {
          addNode(entity, 'middleman');
          // Add links
          distinctInputs.forEach(input => {
            addLink(input, entity, ConnectionType.MIDDLEMAN, 3);
          });
          
          const inputsArr = Array.from(distinctInputs);
          recordPair(inputsArr[0], inputsArr[1], `Connected via high-traffic hub ${entity.slice(0,4)}...`, 20, ConnectionType.MIDDLEMAN);
       } else {
         // Just a shared counterparty
         const inputsArr = Array.from(distinctInputs);
         recordPair(inputsArr[0], inputsArr[1], `Shared counterparty: ${entity.slice(0,4)}...`, 10, ConnectionType.SHARED_COUNTERPARTY);
       }
    }
  });


  // 4. Graph Pruning (Only keep relevant nodes)
  const relevantNodes = new Set<string>(inputAddresses);
  const finalLinks: Link[] = [];

  links.forEach(link => {
    const s = link.source;
    const t = link.target;
    
    // Always keep Direct
    if (inputAddresses.includes(s) && inputAddresses.includes(t)) {
      relevantNodes.add(s); relevantNodes.add(t);
      finalLinks.push(link);
      return;
    }

    // Keep if it connects to at least one input AND is part of a larger chain (already handled by interactionLog logic mostly)
    // Actually, we only want to show nodes that connect >= 2 inputs, OR are direct neighbors if depth is small.
    // To minimize clutter, strictly filter for nodes connecting >= 2 inputs
    const isRelevant = (id: string) => {
       const interactions = interactionLog.get(id);
       if (!interactions) return false; // program or other
       const unique = new Set(interactions.map(i => i.input));
       return unique.size >= 2;
    };
    
    const other = inputAddresses.includes(s) ? t : s;
    if (isRelevant(other) || nodes.get(other)?.group === 'program') {
      relevantNodes.add(s);
      relevantNodes.add(t);
      finalLinks.push(link);
    }
  });

  const finalNodes = Array.from(nodes.values()).filter(n => relevantNodes.has(n.id));
  const summaryPairs = Array.from(connectedPairs.values()).sort((a, b) => b.score - a.score);

  return {
    graph: {
      nodes: finalNodes,
      links: finalLinks
    },
    summary: {
      connectedPairs: summaryPairs,
      totalTransactionsScanned: totalTx,
      uniqueCounterparties: uniqueCounterpartiesSet.size,
      confidenceScore: calculateConfidence(summaryPairs)
    }
  };
};