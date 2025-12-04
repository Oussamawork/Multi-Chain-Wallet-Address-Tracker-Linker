import React, { useState } from 'react';
import { Plus, Trash2, Search, AlertCircle, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { validateAddress } from '../services/solanaService';
import { AnalysisConfig } from '../types';

interface Props {
  onAnalyze: (addresses: string[], config: AnalysisConfig) => void;
  isLoading: boolean;
}

const AddressInput: React.FC<Props> = ({ onAnalyze, isLoading }) => {
  const [addresses, setAddresses] = useState<string[]>(['', '']);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Settings State
  const [limit, setLimit] = useState(50);
  const [timeWindow, setTimeWindow] = useState(300); // seconds
  const [includePrograms, setIncludePrograms] = useState(true);

  const handleChange = (index: number, value: string) => {
    const newAddresses = [...addresses];
    newAddresses[index] = value;
    setAddresses(newAddresses);
    setError(null);
  };

  const addField = () => {
    if (addresses.length < 5) {
      setAddresses([...addresses, '']);
    }
  };

  const removeField = (index: number) => {
    if (addresses.length > 2) {
      const newAddresses = addresses.filter((_, i) => i !== index);
      setAddresses(newAddresses);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validAddresses = addresses.map(a => a.trim()).filter(a => a !== '');
    
    if (validAddresses.length < 2) {
      setError("Please enter at least 2 wallet addresses.");
      return;
    }

    const invalid = validAddresses.find(a => !validateAddress(a));
    if (invalid) {
      setError(`Invalid Solana address: ${invalid}`);
      return;
    }

    onAnalyze(validAddresses, {
      maxTransactions: limit,
      timeWindowSeconds: timeWindow,
      includePrograms
    });
  };

  return (
    <div className="bg-surface p-6 rounded-xl border border-slate-700 shadow-lg">
      <h2 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
        <Search className="w-5 h-5 text-primary" />
        Target Wallets
      </h2>
      <form onSubmit={handleSubmit}>
        <div className="space-y-3">
          {addresses.map((addr, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                value={addr}
                onChange={(e) => handleChange(idx, e.target.value)}
                placeholder={`Solana Address ${idx + 1}`}
                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder-slate-500 font-mono"
              />
              {addresses.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeField(idx)}
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        
        {addresses.length < 5 && (
          <button
            type="button"
            onClick={addField}
            className="mt-3 text-sm text-primary hover:text-blue-400 flex items-center gap-1 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add another address
          </button>
        )}

        {/* Settings Toggle */}
        <div className="mt-6 border-t border-slate-700 pt-4">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors w-full"
          >
            <Settings className="w-4 h-4" />
            <span>Analysis Configuration</span>
            {showSettings ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
          </button>
          
          {showSettings && (
            <div className="mt-4 space-y-4 bg-slate-900/50 p-4 rounded-lg animate-in slide-in-from-top-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Max Transactions per Wallet</label>
                <input 
                  type="range" 
                  min="25" 
                  max="500" 
                  step="25"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="w-full accent-primary h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>25 (Fast)</span>
                  <span className="text-primary font-mono">{limit} txs</span>
                  <span>500 (Deep)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Coordinated Time Window (Seconds)</label>
                <input 
                  type="number" 
                  value={timeWindow}
                  onChange={(e) => setTimeWindow(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:border-primary outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">Max time diff between transactions to flag as "coordinated".</p>
              </div>

               <div className="flex items-center gap-2">
                <input 
                  type="checkbox"
                  id="programs"
                  checked={includePrograms}
                  onChange={(e) => setIncludePrograms(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-primary focus:ring-primary"
                />
                <label htmlFor="programs" className="text-sm text-slate-300">Include Smart Contracts</label>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg flex items-start gap-2 text-red-200 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className={`mt-6 w-full py-3 rounded-lg font-medium text-white shadow-lg transition-all 
            ${isLoading 
              ? 'bg-slate-600 cursor-not-allowed opacity-70' 
              : 'bg-gradient-to-r from-primary to-blue-600 hover:from-blue-600 hover:to-blue-700 active:scale-[0.98]'
            }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Scanning Blockchain...
            </span>
          ) : (
            'Start Investigation'
          )}
        </button>
      </form>
    </div>
  );
};

export default AddressInput;