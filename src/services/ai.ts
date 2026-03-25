import { GoogleGenAI, Type, Modality } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ReadingFeedback {
  word: string;
  wordIndex: number;
  feedback: string;
  phonetic: string;
}

export async function generateSpeech(text: string): Promise<string | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (error) {
    console.error("Failed to generate speech:", error);
    return null;
  }
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
            Provide the feedback and phonetic spelling in Arabic. Also provide the 0-based index of the word in the text (counting only words, ignoring punctuation and spaces. The first word is index 0, the second is index 1, etc.).` 
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
            wordIndex: { type: Type.INTEGER, description: "The 0-based index of the word in the story (counting only words, not punctuation)" },
            feedback: { type: Type.STRING, description: "A short, encouraging tip on how to say it" },
            phonetic: { type: Type.STRING, description: "Simple phonetic spelling (e.g., 'kuh-at' for cat)" }
          },
          required: ["word", "wordIndex", "feedback", "phonetic"]
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
