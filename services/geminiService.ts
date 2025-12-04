import { GoogleGenAI } from "@google/genai";
import { AnalysisSummary } from '../types';

// NOTE: In a real production app, this call would happen server-side to protect the key.
// As per instructions, we use process.env.API_KEY.
const getAiClient = () => {
    if (!process.env.API_KEY) return null;
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateAiInsight = async (summary: AnalysisSummary, inputs: string[]) => {
  const ai = getAiClient();
  if (!ai) return "API Key missing. Cannot generate AI insights.";

  const prompt = `
    You are a blockchain forensics expert. Analyze the following summary of connections between specific Solana wallet addresses.
    
    Target Wallets Investigated: ${inputs.join(', ')}
    
    Data Found:
    - Total Transactions Scanned: ${summary.totalTransactionsScanned}
    - Unique Counterparties: ${summary.uniqueCounterparties}
    - Key Connections Identified: ${JSON.stringify(summary.connectedPairs)}

    Task:
    1. Assess the likelihood that these wallets belong to the same entity or are coordinating.
    2. Provide a "Confidence Score" from 0 to 100.
    3. Explain your reasoning briefly, highlighting specific suspicious connections (shared counterparties, direct transfers).
    4. Keep it concise (under 150 words).

    Format the output as simple text with markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating AI insights. Please check your API usage or network connection.";
  }
};
