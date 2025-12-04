import React, { useState } from 'react';
import { Network, Sparkles, Activity, ShieldCheck, Download, FileJson, FileText } from 'lucide-react';
import AddressInput from './components/AddressInput';
import GraphVisualization from './components/GraphVisualization';
import { fetchTransactionHistory } from './services/solanaService';
import { analyzeConnections } from './services/analysisService';
import { generateAiInsight } from './services/geminiService';
import { GraphData, AnalysisSummary, ParsedTxInfo, AnalysisConfig, ConnectionType } from './types';

const App: React.FC = () => {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>("");

  const handleAnalyze = async (addresses: string[], config: AnalysisConfig) => {
    setIsLoading(true);
    setGraphData(null);
    setSummary(null);
    setAiInsight(null);

    try {
      const txData: { [addr: string]: ParsedTxInfo[] } = {};
      
      for (const addr of addresses) {
        setStatus(`Fetching last ${config.maxTransactions} txs for ${addr.slice(0, 4)}...`);
        const history = await fetchTransactionHistory(addr, config.maxTransactions);
        txData[addr] = history;
      }

      setStatus("Running heuristics & identifying clusters...");
      const { graph, summary } = analyzeConnections(txData, config);
      
      setGraphData(graph);
      setSummary(summary);

      if (process.env.API_KEY && summary.connectedPairs.length > 0) {
        setStatus("Generating AI insights...");
        const insight = await generateAiInsight(summary, addresses);
        setAiInsight(insight);
      } else if (!process.env.API_KEY) {
         setAiInsight("AI Insights unavailable: Missing API Key.");
      } else {
         setAiInsight("No strong connections found to analyze.");
      }

    } catch (e) {
      console.error(e);
      alert("An error occurred during analysis.");
    } finally {
      setIsLoading(false);
      setStatus("");
    }
  };

  const downloadJSON = () => {
    if (!summary) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(summary, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "nexus_analysis.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const downloadCSV = () => {
    if (!summary) return;
    const headers = ["Address A", "Address B", "Type", "Reason", "Score"];
    const rows = summary.connectedPairs.map(p => 
      `${p.addressA},${p.addressB},${p.type},"${p.reason.replace(/"/g, '""')}",${p.score}`
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "nexus_analysis.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="min-h-screen bg-background text-slate-100 pb-12">
      {/* Header */}
      <header className="border-b border-slate-800 bg-surface/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary/20 p-2 rounded-lg">
              <Network className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              NexusTracker
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-700">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              Solana Mainnet
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Input & Summary */}
          <div className="lg:col-span-4 space-y-6">
            <AddressInput onAnalyze={handleAnalyze} isLoading={isLoading} />
            
            {isLoading && (
              <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 flex items-center justify-center text-slate-400 animate-pulse">
                {status}
              </div>
            )}

            {summary && (
              <div className="bg-surface rounded-xl border border-slate-700 shadow-lg overflow-hidden animate-in fade-in zoom-in-95">
                <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Analysis Results
                  </h3>
                  <div className="flex gap-2">
                    <button onClick={downloadJSON} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white" title="Export JSON">
                       <FileJson className="w-4 h-4" />
                    </button>
                    <button onClick={downloadCSV} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white" title="Export CSV">
                       <FileText className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="p-4 space-y-4 text-sm">
                  {/* Score Card */}
                  <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-slate-400 text-xs uppercase tracking-wider">Confidence Score</span>
                       <span className={`text-xl font-bold ${summary.confidenceScore > 70 ? 'text-red-400' : summary.confidenceScore > 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                         {summary.confidenceScore}/100
                       </span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                       <div 
                         className={`h-full ${summary.confidenceScore > 70 ? 'bg-red-500' : summary.confidenceScore > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                         style={{ width: `${summary.confidenceScore}%` }}
                       ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900 p-3 rounded-lg">
                      <div className="text-slate-500 text-xs mb-1">Tx Scanned</div>
                      <div className="text-xl font-mono text-white">{summary.totalTransactionsScanned}</div>
                    </div>
                    <div className="bg-slate-900 p-3 rounded-lg">
                      <div className="text-slate-500 text-xs mb-1">Entities</div>
                      <div className="text-xl font-mono text-white">{summary.uniqueCounterparties}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-3">Strongest Links</h4>
                    {summary.connectedPairs.length === 0 ? (
                      <div className="text-slate-500 italic text-center py-2">No direct links detected yet.</div>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {summary.connectedPairs.map((pair, i) => (
                          <div key={i} className="p-3 bg-slate-900/50 rounded-lg border border-slate-800/50 hover:border-slate-700 transition-colors">
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-mono text-blue-300 bg-blue-900/30 px-1.5 py-0.5 rounded">
                                {pair.addressA.slice(0,4)}...
                              </span>
                              <div className="flex flex-col items-center px-1">
                                <span className="text-[10px] text-slate-600 font-bold tracking-widest">{pair.type.replace('_', ' ')}</span>
                                <span className="text-xs text-slate-500">&harr;</span>
                              </div>
                              <span className="text-xs font-mono text-blue-300 bg-blue-900/30 px-1.5 py-0.5 rounded">
                                {pair.addressB.slice(0,4)}...
                              </span>
                            </div>
                            <p className="text-slate-400 text-xs mt-1">{pair.reason}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {aiInsight && (
              <div className="bg-gradient-to-br from-violet-900/20 to-slate-900 rounded-xl border border-violet-500/30 shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                <div className="p-4 border-b border-violet-500/20 bg-violet-900/10 flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2 text-violet-200">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    AI Forensic Insight
                  </h3>
                  <div className="px-2 py-0.5 rounded text-[10px] bg-violet-500 text-white font-bold">GEMINI 2.5</div>
                </div>
                <div className="p-5 text-sm text-slate-300 leading-relaxed prose prose-invert prose-sm max-w-none">
                  {/* Simple rendering of the markdown text */}
                  {aiInsight.split('\n').map((line, i) => (
                    <p key={i} className="mb-2 last:mb-0">{line}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Visualization */}
          <div className="lg:col-span-8">
            <div className="h-full min-h-[600px] flex flex-col">
              <div className="flex-1 rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-black/20 relative">
                 {graphData ? (
                   <GraphVisualization data={graphData} />
                 ) : (
                   <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                     <ShieldCheck className="w-16 h-16 opacity-20" />
                     <p>Enter wallet addresses to visualize connections</p>
                   </div>
                 )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default App;