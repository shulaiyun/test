import { GoogleGenAI, ThinkingLevel, Modality } from '@google/genai';
import { pcmToWav } from './audio-utils';

// Initialize with the default key for non-Lyria/Veo models
export const getDefaultAI = () => {
  return new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
};

// Removed getUserAI to keep the app free and without API key requirements.

export async function generateDreamStory(prompt: string, lang: 'en' | 'zh' = 'en'): Promise<string> {
  const ai = getDefaultAI();
  const langInstruction = lang === 'zh' ? 'IMPORTANT: You MUST write the story in Simplified Chinese (简体中文).' : 'Write the story in English.';
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: `You are a Dream Weaver. A user will give you a brief description of their dream. Your task is to expand it into a beautiful, poetic, and vivid story (around 150-200 words). Make it feel surreal and immersive. ${langInstruction}\n\nUser's dream: ${prompt}`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
    }
  });
  return response.text || '';
}

export async function generateDreamImage(story: string): Promise<{ data: string, mimeType: string } | null> {
  const ai = getDefaultAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: `A surreal, highly detailed, cinematic dreamscape based on this story: ${story}` }
      ]
    }
  });
  
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData && part.inlineData.data) {
      return {
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'image/png'
      };
    }
  }
  return null;
}

export async function generateDreamVoice(story: string, lang: 'en' | 'zh' = 'en'): Promise<{ data: string, mimeType: string } | null> {
  const ai = getDefaultAI();
  const textPrompt = lang === 'zh' 
    ? `用平静、舒缓、神秘的声音朗读这个梦境故事：${story}`
    : `Read this dream story in a calm, soothing, and mysterious voice: ${story}`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [{ parts: [{ text: textPrompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Zephyr' },
        },
      },
    },
  });
  
  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (base64Audio) {
    const wavBase64 = pcmToWav(base64Audio, 24000);
    return {
      data: wavBase64,
      mimeType: 'audio/wav'
    };
  }
  return null;
}

// Removed Lyria and Veo functions to keep the app free and without API key requirements.
