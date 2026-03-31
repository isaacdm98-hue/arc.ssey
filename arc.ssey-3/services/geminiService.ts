import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface CuratedQueries {
    radio: string;
    video: string;
    web: string;
    soundscape: string;
}

export async function generateCuratedSearchQueries(topic: string, feels: string[]): Promise<CuratedQueries> {
  const feelsString = feels.length > 0 ? `The user is feeling: ${feels.join(', ')}.` : 'The user has not specified a mood.';
  
  const prompt = `You are an expert archivist search assistant for a vast digital library like archive.org. 
A user wants to find content about "${topic}".
${feelsString}
Based on the topic and their feelings, generate four concise, effective search query strings.
The queries should use boolean operators (AND, OR, NOT) and field specifiers (like title: or subject:) if helpful.
Return ONLY a JSON object with the keys "radio", "video", "web", and "soundscape".

- "radio": A query for audio like old radio shows, interviews, or music related to the topic and vibes.
- "video": A query for videos, like documentaries, old films, or relevant footage.
- "web": A query for archived websites, like fansites, GeoCities pages, or old blogs.
- "soundscape": A query for a long, ambient audio recording that captures the mood. For example, if the topic is "space" and the feel is "calm", the query could be "nasa mission audio hum". If no specific soundscape fits, create a query for a general ambient sound like "rain sounds" or "ocean waves".`;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    radio: { type: Type.STRING },
                    video: { type: Type.STRING },
                    web: { type: Type.STRING },
                    soundscape: { type: Type.STRING },
                },
                required: ["radio", "video", "web", "soundscape"],
            },
            temperature: 0.5,
        }
    });

    const result = JSON.parse(response.text);
    return result;
  } catch (error) {
    console.error("Error generating curated search queries:", error);
    // Fallback to basic queries
    return {
      radio: topic,
      video: topic,
      web: topic,
      soundscape: "ocean waves",
    };
  }
}

/**
 * Generates a cryptic, poetic message for the sea gull based on the user's topic.
 * @param topic The user's primary search topic.
 * @param stations A list of discovered radio station themes for added context.
 * @returns A promise that resolves to an enigmatic message string.
 */
export async function generateGullMessage(topic: string, stations: string[]): Promise<string> {
  try {
    let context = `The archivist's main search topic is "${topic}".`;
    if (stations.length > 0) {
      const stationThemes = stations.slice(0, 3).join(', '); // Use up to 3 themes
      context += ` They have also discovered radio signals with themes like: ${stationThemes}.`;
    }

    const prompt = `You are a mystical sea bird in a digital ocean called the data-sea. You deliver a single, short, cryptic, poetic message to an archivist exploring this sea. ${context} Based on this, generate one enigmatic sentence under 15 words. The message must be highly metaphorical and sound like a line from a lost, epic poem or a cryptic prophecy. It should hint at the ephemeral nature of data and memory. Do not use quotes. Be abstract and beautiful.`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            thinkingConfig: { thinkingBudget: 0 },
            temperature: 0.9,
            maxOutputTokens: 50,
        }
    });

    const message = response.text.trim();
    
    if (message) {
        return message;
    }
    
    return "The currents shift... a new signal emerges."; // Fallback
  } catch (error) {
    console.error("Error generating gull message with Gemini:", error);
    return "The static whispers... but the meaning is lost."; // Fallback on error
  }
}