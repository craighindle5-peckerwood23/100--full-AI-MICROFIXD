import { GoogleGenAI } from "@google/genai";

export class GoogleGenerativeAI {
  private client: GoogleGenAI;
  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }
  getGenerativeModel({ model }: { model: string }) {
    return {
      generateContent: async (prompt: string) => {
        const response = await this.client.models.generateContent({ model, contents: prompt });
        return { response: { text: () => response.text ?? "" } };
      },
      embedContent: async (text: string) => {
        const response = await this.client.models.embedContent({ model, contents: text });
        const values = response.embeddings?.[0]?.values ?? [];
        return { embedding: { values } };
      },
    };
  }
}
