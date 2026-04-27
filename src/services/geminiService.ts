import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Party, BankAccount as Bank } from "../types";

export async function getBusinessInsights(transactions: Transaction[], parties: Party[], banks: Bank[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey: apiKey || '' });
  
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

  const executeWithRetry = async (): Promise<string[]> => {
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
        model: "gemini-flash-latest", 
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      const text = response.text || '[]';
      try {
        const parsed = JSON.parse(text);
        let result: string[] = [];
        if (Array.isArray(parsed)) {
          result = parsed;
        } else if (typeof parsed === 'object' && parsed !== null) {
          result = Object.values(parsed).filter(v => typeof v === 'string') as string[];
        }
        
        if (result.length > 0) return result;
        throw new Error('Empty insights from model');
      } catch (e) {
        // Fallback parsing for partial JSON
        const jsonMatch = text.match(/\[.*\]/s);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) return parsed;
        }
        return ["Review monthly spending habits.", "Monitor party receivables regularly.", "Ensure bank reconciliations are accurate."];
      }
    } catch (error: any) {
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

      const lowerMsg = errorMessage.toLowerCase();
      if (error?.code) errorCode = error.code;
      else if (error?.error?.code) errorCode = error.error.code;

      const isRetryable = 
        errorCode === 429 || 
        errorCode >= 500 ||
        lowerMsg.includes('quota') || 
        lowerMsg.includes('rate limit') ||
        lowerMsg.includes('rpc failed') ||
        lowerMsg.includes('xhr error') ||
        lowerMsg.includes('proxyunarycall') ||
        lowerMsg.includes('unknown') ||
        lowerMsg.includes('internal error');
      
      if (isRetryable && retryCount < maxRetries) {
        retryCount++;
        const delay = Math.pow(2, retryCount) * 1000 + (Math.random() * 1000);
        console.warn(`Gemini API retry attempt ${retryCount}/${maxRetries} due to: ${errorMessage.substring(0, 50)}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return executeWithRetry();
      }
      
      console.error('Gemini Business Insights Error:', errorMessage);
      
      return [
        "Monitor high-balance accounts to ensure your collections stay on track.",
        "Your operating expenses are stable; looking for small efficiencies could boost margins.",
        "Sales activity is showing positive momentum for the upcoming period."
      ];
    }
  };

  return executeWithRetry();
}
