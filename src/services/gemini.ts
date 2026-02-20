import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface Question {
  text: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface PlayerInfo {
  name: string;
  age: number;
  club: string;
  nationality: string;
  position: string;
  marketValue: string;
  recentForm: string;
  funFact: string;
}

export async function generateFootballQuestion(): Promise<Question> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "Generate a challenging and interesting football trivia question based on recent football news, player transfers, or historical facts. The question should be suitable for a real-time quiz game.",
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "The trivia question text" },
          options: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Four possible answers"
          },
          correctAnswer: { type: Type.STRING, description: "The correct answer from the options" },
          explanation: { type: Type.STRING, description: "A brief explanation of the answer" }
        },
        required: ["text", "options", "correctAnswer", "explanation"]
      }
    }
  });

  return JSON.parse(response.text);
}

export async function scoutPlayer(playerName: string): Promise<PlayerInfo> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Provide a detailed scouting report for the football player: ${playerName}. Include their current club, age, nationality, position, estimated market value, recent form, and one interesting fun fact.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          age: { type: Type.NUMBER },
          club: { type: Type.STRING },
          nationality: { type: Type.STRING },
          position: { type: Type.STRING },
          marketValue: { type: Type.STRING },
          recentForm: { type: Type.STRING },
          funFact: { type: Type.STRING }
        },
        required: ["name", "age", "club", "nationality", "position", "marketValue", "recentForm", "funFact"]
      }
    }
  });

  return JSON.parse(response.text);
}
