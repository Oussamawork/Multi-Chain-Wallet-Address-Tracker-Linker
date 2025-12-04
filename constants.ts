
export const RPC_ENDPOINTS = [
  'https://solana-rpc.publicnode.com',
  'https://rpc.ankr.com/solana',
  'https://solana-mainnet.rpc.extrnode.com',
  'https://api.mainnet-beta.solana.com',
];

export const SOLANA_RPC_ENDPOINT = RPC_ENDPOINTS[0];

// Limits to prevent rate-limiting on public RPCs during demo
// We increase this slightly as better RPCs can handle it, but keep it safe.
export const MAX_TX_FETCH = 100; 

// Known system programs to ignore in "Shared Program" analysis to reduce noise
export const IGNORED_PROGRAMS = [
  '11111111111111111111111111111111', // System Program
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token Program
  'ComputeBudget111111111111111111111111111111', // Compute Budget
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcQb', // Memo
];

export const COLORS = {
  input: '#3b82f6', // Blue
  counterparty: '#10b981', // Emerald
  program: '#f59e0b', // Amber
  linkDirect: '#ef4444', // Red (High interest)
  linkShared: '#64748b', // Slate (Background)
};
