
import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { RPC_ENDPOINTS, MAX_TX_FETCH } from '../constants';
import { ParsedTxInfo } from '../types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const validateAddress = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch (e) {
    return false;
  }
};

// Helper to execute RPC calls with fallback to multiple endpoints
const executeWithFallback = async <T>(
  operation: (connection: Connection) => Promise<T>
): Promise<T> => {
  let lastError: any;
  
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      // Use 'confirmed' commitment for better reliability on public nodes
      const connection = new Connection(endpoint, 'confirmed');
      return await operation(connection);
    } catch (error: any) {
      const errorMsg = error?.message || JSON.stringify(error);
      console.warn(`RPC Error on ${endpoint}:`, errorMsg);
      lastError = error;
      
      // If invalid key, no point retrying other RPCs
      if (typeof errorMsg === 'string' && errorMsg.includes('Invalid Public Key')) {
        throw error;
      }
      
      // Short delay before switching endpoints
      await sleep(300);
    }
  }
  
  throw lastError || new Error("All RPC endpoints failed");
};

export const fetchTransactionHistory = async (address: string, limit: number = MAX_TX_FETCH): Promise<ParsedTxInfo[]> => {
  try {
    const pubKey = new PublicKey(address);
    
    // Cap limit to 200 for public RPC stability (prevent huge timeouts)
    // If the user asks for 500, we try 200 to ensure we at least get data.
    const effectiveLimit = Math.min(limit, 200);

    return await executeWithFallback(async (connection) => {
      // 1. Fetch signatures
      // Note: fetching signatures is usually cheap.
      const signatures = await connection.getSignaturesForAddress(pubKey, { limit: effectiveLimit });
      
      const sigStrings = signatures.map(s => s.signature);
      const parsedTxs: ParsedTxInfo[] = [];
      
      // Reduced batch size to 5 to avoid 413 Payload Too Large or 429 Too Many Requests
      const batchSize = 5; 

      for (let i = 0; i < sigStrings.length; i += batchSize) {
        const batch = sigStrings.slice(i, i + batchSize);
        
        try {
          const txs = await connection.getParsedTransactions(batch, { 
            maxSupportedTransactionVersion: 0 
          });
          
          txs.forEach((tx) => {
            if (!tx) return;
            const info = parseTransaction(tx, address);
            if (info) parsedTxs.push(info);
          });
        } catch (batchErr) {
          console.warn(`Failed to parse batch for ${address}`, batchErr);
          // Don't fail the whole request if one batch fails, just continue
        }

        // Increased delay to 500ms to be nicer to public RPCs
        await sleep(500);
      }

      return parsedTxs;
    });

  } catch (error) {
    console.error(`Final error fetching for ${address}:`, error);
    // Return empty array instead of crashing, so analysis can proceed with whatever was found (if any)
    return [];
  }
};

const parseTransaction = (tx: ParsedTransactionWithMeta, monitoredAddress: string): ParsedTxInfo | null => {
  if (!tx.transaction || !tx.meta) return null;

  const { message } = tx.transaction;
  const signature = tx.transaction.signatures[0];
  const blockTime = tx.blockTime || 0;

  // Identify sender (Signer is usually index 0)
  const accountKeys = message.accountKeys;
  const sender = accountKeys[0].pubkey.toBase58();

  const programIds: string[] = [];
  const recipients: string[] = [];

  // 1. Parse Instructions to find programs and destinations
  message.instructions.forEach((ix) => {
    programIds.push(ix.programId.toBase58());
    
    if ('parsed' in ix) {
       // @ts-ignore
       const info = ix.parsed?.info;
       if (info) {
         if (info.destination) recipients.push(info.destination);
         if (info.newAccount) recipients.push(info.newAccount);
         if (info.authority && info.authority !== sender) recipients.push(info.authority); 
         if (info.owner && info.owner !== sender) recipients.push(info.owner);
       }
    } else {
      ix.accounts.forEach(acc => {
        if (acc.toBase58() !== sender && acc.toBase58() !== ix.programId.toBase58()) {
          recipients.push(acc.toBase58());
        }
      });
    }
  });

  // 2. Parse Token Balances to find implicit transfers/ownership
  // If a TokenAccount received funds, we want to know the OWNER of that account.
  if (tx.meta.postTokenBalances) {
    tx.meta.postTokenBalances.forEach((balance) => {
      // If this balance belongs to an account that is NOT the sender, add the owner as a recipient
      if (balance.owner && balance.owner !== sender) {
        recipients.push(balance.owner);
      }
    });
  }
  
  if (tx.meta.preTokenBalances) {
    tx.meta.preTokenBalances.forEach((balance) => {
      if (balance.owner && balance.owner !== sender) {
        recipients.push(balance.owner);
      }
    });
  }

  const uniqueRecipients = [...new Set(recipients)].filter(r => r !== sender);
  const uniquePrograms = [...new Set(programIds)];

  return {
    signature,
    blockTime,
    sender,
    recipients: uniqueRecipients,
    programIds: uniquePrograms
  };
};
