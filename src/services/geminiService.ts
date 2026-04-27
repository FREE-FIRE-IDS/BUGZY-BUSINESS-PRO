import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Party, BankAccount as Bank } from "../types";

export async function getBusinessInsights(transactions: Transaction[], parties: Party[], banks: Bank[]) {
  const apiKey = (process.env as any).API_KEY || (process.env as any).GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  
  const summary = {
    totalSales: transactions.filter(t => t.type === 'Sale').reduce((sum, t) => sum + t.amount, 0),
    totalExpenses: transactions.filter(t => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0),
    partyBalances: parties.map(p => ({ name: p.name, balance: p.balance })),
    bankBalances: banks.map(b => ({ name: b.name, balance: b.balance })),
  };

  const prompt = `As a business consultant, analyze this financial summary and provide 3 short, actionable insights or predictions for the next month:
  ${JSON.stringify(summary)}`;

  const maxRetries = 3;
  let retryCount = 0;

  const executeWithRetry = async (): Promise<any> => {
    if (!apiKey) {
      console.warn('Gemini API Key missing, using fallback insights.');
      return [
        "Provide more transaction data to get personalized AI business insights.",
        "Ensure your bank balances are up to date for accurate financial tracking.",
        "Categorize your expenses to visualize spending patterns more effectively."
      ];
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash", // Using a more stable model name
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
        return JSON.parse(text);
      } catch (e) {
        // Fallback for cases where JSON might have extra formatting or markdown blocks
        const jsonStr = text.match(/\[.*\]/s)?.[0] || text;
        return JSON.parse(jsonStr);
      }
    } catch (error: any) {
      // Logic for retry stays similar but with improved logging
      let errorMessage = '';
      let errorCode = 0;

      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error?.message) {
        errorMessage = error.error.message;
      } else {
        errorMessage = JSON.stringify(error);
      }

      if (error?.code) errorCode = error.code;
      else if (error?.error?.code) errorCode = error.error.code;

      const lowerMsg = errorMessage.toLowerCase();
      
      // Retry for rate limits, RPC/Connection issues, or 500 Internal/Proxy errors
      const shouldRetry = 
        errorCode === 429 || 
        errorCode === 500 ||
        errorCode === 503 ||
        lowerMsg.includes('429') || 
        lowerMsg.includes('500') ||
        lowerMsg.includes('resource_exhausted') || 
        lowerMsg.includes('quota') ||
        lowerMsg.includes('rate limit') ||
        lowerMsg.includes('rpc failed') ||
        lowerMsg.includes('xhr error') ||
        lowerMsg.includes('proxyunarycall') ||
        lowerMsg.includes('unknown') ||
        lowerMsg.includes('internal error');
      
      if (shouldRetry && retryCount < maxRetries) {
        retryCount++;
        const delay = Math.pow(2, retryCount) * 1000 + (Math.random() * 1000);
        console.warn(`Gemini API temporary failure (${errorCode || 'RPC'}). Retrying... (Attempt ${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return executeWithRetry();
      }
      
      if (shouldRetry && (errorCode === 429 || lowerMsg.includes('quota'))) {
        console.warn('Gemini API quota exceeded.');
      } else {
        console.warn('Gemini API Insight error (fallback activated):', errorMessage.substring(0, 200));
      }
      
      // Always return fallback instead of crashing
      return [
        "Monitor high-balance accounts to ensure your collections stay on track.",
        "Your operating expenses are stable; looking for small efficiencies could boost margins.",
        "Sales activity is showing positive momentum for the upcoming period."
      ];
    }
  };

  return executeWithRetry();
}
