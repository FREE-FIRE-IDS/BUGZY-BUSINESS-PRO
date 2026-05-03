import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Party, BankAccount as Bank } from "../types";

export async function getBusinessInsights(transactions: Transaction[], parties: Party[], banks: Bank[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.warn('Gemini API Key missing. Using fallback insights.');
    return [
      "Keep an eye on your high-balance parties to ensure timely collections.",
      "Your expenses are consistent; consider a 5% reduction in non-essential costs.",
      "Sales are trending positively. It might be a good time to expand your inventory."
    ];
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const summary = {
    totalSales: transactions.filter(t => t.type === 'Sale').reduce((sum, t) => sum + t.amount, 0),
    totalExpenses: transactions.filter(t => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0),
    partyBalances: parties.map(p => ({ name: p.name, balance: p.balance })),
    bankBalances: banks.map(b => ({ name: b.name, balance: b.balance })),
  };

  const prompt = `As a business consultant, analyze this financial summary and provide 3 short, actionable insights or predictions for the next month:
  ${JSON.stringify(summary)}`;

  const maxRetries = 2; // Reduced retries to avoid long delays
  let retryCount = 0;

  const executeWithRetry = async (): Promise<string[]> => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
            description: "A list of 3 short, actionable business insights."
          }
        }
      });
      
      const text = response.text || '[]';
      try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        // Fallback for cases where JSON might have extra formatting
        const match = text.match(/\[.*\]/s);
        if (match) {
          return JSON.parse(match[0]);
        }
        return [];
      }
    } catch (error: any) {
      const errorMessage = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
      
      // Retry for rate limits OR RPC/Connection issues
      const isRetryable = 
        errorMessage.includes('429') || 
        errorMessage.includes('RESOURCE_EXHAUSTED') || 
        errorMessage.toLowerCase().includes('quota') ||
        errorMessage.toLowerCase().includes('rate limit') ||
        errorMessage.toLowerCase().includes('rpc failed') ||
        errorMessage.toLowerCase().includes('xhr error') ||
        errorMessage.toLowerCase().includes('internal error') ||
        errorMessage.toLowerCase().includes('500') ||
        errorMessage.includes('ProxyUnaryCall');
      
      if (isRetryable && retryCount < maxRetries) {
        retryCount++;
        const delay = Math.pow(2, retryCount) * 2000; // Increased delay slightly
        console.warn(`Gemini RPC/Proxy error (Retry ${retryCount}/${maxRetries}): ${errorMessage.slice(0, 100)}... Retrying in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return executeWithRetry();
      }
      
      // If we reach here, we failed all retries or it's a non-retryable error
      if (isRetryable) {
        console.warn('AI Insights failed after retries. Using fallbacks.');
      } else {
        console.error('Gemini Service Error:', errorMessage);
      }

      return [
        "Keep an eye on your high-balance parties to ensure timely collections.",
        "Your expenses are consistent; consider a 5% reduction in non-essential costs.",
        "Sales are trending positively. It might be a good time to expand your inventory."
      ];
    }
  };

  return executeWithRetry();
}
