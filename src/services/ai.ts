import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ReadingFeedback {
  word: string;
  feedback: string;
  phonetic: string;
}

export async function analyzeReading(text: string, audioBase64: string, mimeType: string): Promise<ReadingFeedback[]> {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        parts: [
          { 
            text: `You are a friendly, encouraging reading teacher for kids. The child is reading the following Arabic text: "${text}". 
            Listen to the audio and identify any words the child mispronounced, skipped, or struggled with. 
            If they read perfectly, return an empty array. Do not be overly strict, but catch obvious mistakes.
            Provide the feedback and phonetic spelling in Arabic.` 
          },
          { 
            inlineData: { data: audioBase64, mimeType } 
          }
        ]
      }
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING, description: "The exact word from the text that was incorrect (case-insensitive)" },
            feedback: { type: Type.STRING, description: "A short, encouraging tip on how to say it" },
            phonetic: { type: Type.STRING, description: "Simple phonetic spelling (e.g., 'kuh-at' for cat)" }
          },
          required: ["word", "feedback", "phonetic"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("Failed to parse AI response:", e);
    return [];
  }
}
