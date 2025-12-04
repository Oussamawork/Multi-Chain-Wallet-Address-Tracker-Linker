export interface WalletInput {
  id: string;
  address: string;
}

export enum ConnectionType {
  DIRECT = 'DIRECT',
  SHARED_COUNTERPARTY = 'SHARED_COUNTERPARTY',
  SHARED_PROGRAM = 'SHARED_PROGRAM',
  MIDDLEMAN = 'MIDDLEMAN',
  TIME_PROXIMATE = 'TIME_PROXIMATE',
}

export interface AnalysisConfig {
  maxTransactions: number;
  timeWindowSeconds: number; // For time-proximate analysis
  includePrograms: boolean;
}

export interface Node {
  id: string;
  group: 'input' | 'counterparty' | 'program' | 'middleman';
  label: string;
  val: number; // Size/weight
}

export interface Link {
  source: string;
  target: string;
  type: ConnectionType;
  details?: string;
  value: number; // Thickness/Strength
}

export interface GraphData {
  nodes: Node[];
  links: Link[];
}

export interface AnalysisSummary {
  connectedPairs: {
    addressA: string;
    addressB: string;
    reason: string;
    score: number;
    type: ConnectionType;
  }[];
  totalTransactionsScanned: number;
  uniqueCounterparties: number;
  confidenceScore: number; // 0-100 overall score
}

export interface ParsedTxInfo {
  signature: string;
  blockTime: number;
  sender: string;
  recipients: string[];
  programIds: string[];
}