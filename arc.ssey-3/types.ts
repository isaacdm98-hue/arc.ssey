
export const BRAND = 'arc.ssey';

export interface RadioStation {
  name: string;
  url: string;
}

export interface ThemedRadioStation {
  theme: string;
  streamUrl: string;
  query: string;
}

export interface RadioStatus {
  isLoading: boolean;
  isPlaying: boolean;
  title: string;
}

export type FishingMinigameState = 'idle' | 'starting' | 'waiting' | 'bite' | 'reeling' | 'success' | 'fail' | 'ending';

export interface FishData {
    name: string;
    summary: string;
    imageUrl: string | null;
}

// --- Content & Archive Types ---

export interface WaybackResult {
  timestamp: string;
  url: string;
  originalUrl: string;
}

export interface VideoResult {
  identifier: string;
  title: string;
}

export interface TarotCard {
    name: string;
    imageUrl: string;
    description: string;
}

export interface TarotCardReading {
    card: TarotCard;
    positionMeaning: string;
    interpretation: string;
}

export interface TarotSpread {
    spreadName: string;
    question: string;
    cards: TarotCardReading[];
}

export interface FestivalData {
  name: string;
  year: number;
  videos: VideoResult[];
}

export type IslandContent = 
  | { type: 'web', data: WaybackResult } 
  | { type: 'video', data: VideoResult }
  | { type: 'tarot', data: { title: string } }
  | { type: 'festival', data: FestivalData };