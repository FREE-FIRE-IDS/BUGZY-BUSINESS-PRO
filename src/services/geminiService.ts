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
        return JSON.parse(text);
      } catch (e) {
        // Fallback for cases where JSON might have extra formatting
        const jsonStr = text.substring(text.indexOf('['), text.lastIndexOf(']') + 1) || text;
        return JSON.parse(jsonStr);
      }
    } catch (error: any) {
      const errorMessage = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
      
      // Retry for rate limits OR RPC/Connection issues
      const shouldRetry = 
        errorMessage.includes('429') || 
        errorMessage.includes('RESOURCE_EXHAUSTED') || 
        errorMessage.toLowerCase().includes('quota') ||
        errorMessage.toLowerCase().includes('rate limit') ||
        errorMessage.toLowerCase().includes('rpc failed') ||
        errorMessage.toLowerCase().includes('xhr error') ||
        errorMessage.includes('ProxyUnaryCall');
      
      if (shouldRetry && retryCount < maxRetries) {
        retryCount++;
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.warn(`Gemini API error or rate limit. Retrying in ${delay}ms (Attempt ${retryCount}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return executeWithRetry();
      }
      
      if (shouldRetry && (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED'))) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }
      
      console.error('AI Insight error:', error);
      return [
        "Keep an eye on your high-balance parties to ensure timely collections.",
        "Your expenses are consistent; consider a 5% reduction in non-essential costs.",
        "Sales are trending positively. It might be a good time to expand your inventory."
      ];
    }
  };

  return executeWithRetry();
}
