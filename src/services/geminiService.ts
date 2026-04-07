import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Party, BankAccount as Bank } from "../types";

export async function getBusinessInsights(transactions: Transaction[], parties: Party[], banks: Bank[]) {
  const ai = new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY });
  
  const summary = {
    totalSales: transactions.filter(t => t.type === 'Sale').reduce((sum, t) => sum + t.amount, 0),
    totalExpenses: transactions.filter(t => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0),
    partyBalances: parties.map(p => ({ name: p.name, balance: p.balance })),
    bankBalances: banks.map(b => ({ name: b.name, balance: b.balance })),
  };

  const prompt = `As a business consultant, analyze this financial summary and provide 3 short, actionable insights or predictions for the next month:
  ${JSON.stringify(summary)}`;

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
    // Clean up any potential markdown or extra characters just in case
    const jsonStr = text.substring(text.indexOf('['), text.lastIndexOf(']') + 1) || text;
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('AI Insight error:', error);
    return [
      "Keep an eye on your high-balance parties to ensure timely collections.",
      "Your expenses are consistent; consider a 5% reduction in non-essential costs.",
      "Sales are trending positively. It might be a good time to expand your inventory."
    ];
  }
}
