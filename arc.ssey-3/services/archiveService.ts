
import type { ThemedRadioStation, WaybackResult, VideoResult, TarotSpread, FestivalData, FishData } from '../types';
import { MARSEILLE_DECK, TAROT_SPREADS } from './tarotData';
import type { CuratedQueries } from './searchService';

// --- TYPES ---
interface ArchiveDoc {
  identifier: string;
  title?: string;
}

interface ArchiveFile {
  name:string;
  format?: string;
  length?: string;
  source?: string;
  size?: string;
}

interface FestivalCatalogItem {
  name: string;
  year: number;
  tags: string[];
  videos: VideoResult[];
}

interface WikipediaSummary {
    extract: string;
    title?: string;
    thumbnail?: {
        source: string;
    };
}

export interface ContentPayload {
    soundscape: ThemedRadioStation;
    radioStations: ThemedRadioStation[];
    archivedSites: WaybackResult[];
    archivedVideos: VideoResult[];
    festivalIslands: FestivalData[];
}

// --- UTILITY ---
async function processInBatches<T, R>(
    items: T[], 
    processor: (item: T, signal: AbortSignal) => Promise<R | null>, 
    batchSize: number, 
    signal: AbortSignal,
    limit?: number
): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += batchSize) {
        if (signal.aborted || (limit && results.length >= limit)) break;
        const batchItems = items.slice(i, i + batchSize);
        const batchPromises = batchItems.map(item => processor(item, signal));
        const batchResults = await Promise.allSettled(batchPromises);

        for (const result of batchResults) {
             if (signal.aborted || (limit && results.length >= limit)) break;
            if (result.status === 'fulfilled' && result.value) {
                results.push(result.value);
            }
        }
    }
    return results;
}


// --- STATIC FESTIVAL DATA ---
export const FESTIVAL_CATALOG: FestivalCatalogItem[] = [
    {
        name: "Lollapalooza", year: 1993, tags: ['music', '90s', 'rock', 'alternative', 'grunge', 'lollapalooza'],
        videos: [
            { identifier: "Lollapalooza1993-08-07.Rage.Against.The.Machine", title: "Rage Against The Machine" },
            { identifier: "Lollapalooza1993-07-24.Fishbone", title: "Fishbone" },
            { identifier: "Lollapalooza1993-07-24.Dinosaur.Jr", title: "Dinosaur Jr." },
            { identifier: "Lollapalooza1993-07-24.Babes.In.Toyland", title: "Babes In Toyland" },
            { identifier: "Lollapalooza1993-07-24.Arrested.Development", title: "Arrested Development" },
            { identifier: "Lollapalooza1993-07-24.Alice.In.Chains", title: "Alice In Chains" },
            { identifier: "Lollapalooza1993-07-03.Primus", title: "Primus" },
            { identifier: "Lollapalooza1993-07-03.Tool", title: "Tool" },
            { identifier: "Lollapalooza1993-07-18.Front.242", title: "Front 242" },
            { identifier: "Lollapalooza1993-08-07.Primus", title: "Primus (Bremerton)" }
        ]
    },
    {
        name: "Woodstock", year: 1994, tags: ['music', '90s', 'rock', 'alternative', 'woodstock'],
        videos: [
            { identifier: "Woodstock94-TheDocumentary", title: "The Documentary" },
            { identifier: "Woodstock94-SundayPart1", title: "Sunday Highlights Pt. 1" },
            { identifier: "Woodstock94-SundayPart2", title: "Sunday Highlights Pt. 2" },
            { identifier: "Woodstock1994Interviews", title: "Interviews & Atmosphere" },
            { identifier: "ws94-lagneiappe", title: "Lagniappe" },
            { identifier: "woodstock-94-saturday-part-1", title: "Saturday Highlights Pt. 1" },
            { identifier: "woodstock-94-saturday-part-2", title: "Saturday Highlights Pt. 2" },
            { identifier: "woodstock-94-friday", title: "Friday Highlights" },
            { identifier: "TheCranberries-LiveAtWoodstock1994", title: "The Cranberries" },
            { identifier: "GreenDay-LiveAtWoodstock1994", title: "Green Day" }
        ]
    },
    {
        name: "Monterey Pop Festival", year: 1967, tags: ['music', '60s', 'rock', 'folk', 'monterey', 'pop'],
        videos: [
            { identifier: "TheWho-MontereyPop", title: "The Who" },
            { identifier: "JimiHendrix-MontereyPop", title: "Jimi Hendrix" },
            { identifier: "RaviShankar-MontereyPop", title: "Ravi Shankar" },
            { identifier: "OtisRedding-MontereyPop", title: "Otis Redding" },
            { identifier: "JanisJoplin-MontereyPop", title: "Janis Joplin" },
            { identifier: "JeffersonAirplane-MontereyPop", title: "Jefferson Airplane" },
            { identifier: "TheMamasThePapas-MontereyPop", title: "The Mamas & The Papas" },
            { identifier: "CannedHeat-MontereyPop", title: "Canned Heat" },
            { identifier: "SimonGarfunkel-MontereyPop", title: "Simon & Garfunkel" },
            { identifier: "EricBurdonTheAnimals-MontereyPop", title: "Eric Burdon & The Animals" }
        ]
    }
];

// --- GENERIC SEARCH HELPER ---
async function searchArchive(baseQuery: string, mediaType: string, rows: number, page: number, signal: AbortSignal): Promise<ArchiveDoc[]> {
    const enhancedQuery = `(title:(${baseQuery}) OR subject:(${baseQuery}) OR description:(${baseQuery}))`;
    const query = encodeURIComponent(`${enhancedQuery} AND mediatype:(${mediaType})`);
    const searchUrl = `https://archive.org/advancedsearch.php?q=${query}&fl[]=identifier,title&sort[]=downloads+desc&output=json&rows=${rows}&page=${page}`;
    
    try {
        const res = await fetch(searchUrl, { signal });
        if (!res.ok) throw new Error(`IA API error: ${res.status}`);
        const data = await res.json();
        const docs: ArchiveDoc[] = data?.response?.docs || [];
        return docs.sort(() => Math.random() - 0.5); // Shuffle results for variety
    } catch (e) {
        if ((e as Error).name !== 'AbortError') {
            console.error(`Archive search failed for ${mediaType} with query "${baseQuery}":`, e);
        }
        return [];
    }
}

// --- RADIO SEARCH ---
async function findPlayableAudio(doc: ArchiveDoc, signal: AbortSignal): Promise<ThemedRadioStation | null> {
    try {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const metaUrl = `https://archive.org/metadata/${doc.identifier}`;
        const metaRes = await fetch(metaUrl, { signal });
        if (!metaRes.ok) return null;
        
        const metaData = await metaRes.json();
        const files: ArchiveFile[] = metaData?.files || [];
      
        const audioFile = files.find(f => 
            f.name?.toLowerCase().endsWith('.mp3') &&
            f.format?.includes('MP3') && 
            f.source === 'original' &&
            f.length && parseFloat(f.length) > 180 && // Must be > 3 minutes
            f.size && parseInt(f.size, 10) > 2000000 // Must be > 2MB
        );

        if (audioFile) {
            return {
                theme: doc.title || 'Unknown Signal',
                query: '',
                streamUrl: `https://archive.org/download/${doc.identifier}/${encodeURIComponent(audioFile.name)}`
            };
        }
    } catch(e) {
        if ((e as Error).name !== 'AbortError') console.error(`Error finding audio for identifier "${doc.identifier}":`, e);
    }
    return null;
}

export async function searchRadioStations(topic: string, signal: AbortSignal, limit: number, page: number = 1): Promise<ThemedRadioStation[]> {
    const docs = await searchArchive(topic, 'audio', 50, page, signal); // Fetch more docs to have a better chance of finding valid ones
    const uniqueDocs = Array.from(new Map(docs.map(doc => [doc.identifier, doc])).values());
    return await processInBatches(uniqueDocs, findPlayableAudio, 8, signal, limit);
}


// --- VIDEO VALIDATION ---
export async function validateAndFilterVideos(videos: VideoResult[], signal: AbortSignal): Promise<VideoResult[]> {
     const validator = async (video: VideoResult, signal: AbortSignal): Promise<VideoResult | null> => {
        try {
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
            const metaUrl = `https://archive.org/metadata/${video.identifier}`;
            const metaRes = await fetch(metaUrl, { signal });
            if (!metaRes.ok) return null;
            const metaData = await metaRes.json();
            const files: ArchiveFile[] = metaData?.files || [];
            const hasPlayableVideo = files.some(f => f.format?.includes('MPEG4') || f.format?.includes('h.264'));
            return hasPlayableVideo ? video : null;
        } catch (e) {
            if ((e as Error).name !== 'AbortError') console.warn(`Validation failed for video ${video.identifier}:`, e);
            return null;
        }
    };
    return processInBatches(videos, validator, 8, signal, 25);
}


// --- WEBSITE SEARCH ---
export async function searchWebsites(topic: string, signal: AbortSignal): Promise<WaybackResult[]> {
    let docs = await searchArchive(topic, 'web', 50, 1, signal);

    if (docs.length < 20) {
        const fallbackDocs = await searchArchive("subject:(zine OR fansite OR geocities OR blog)", 'web', 50, 1, signal);
        docs.push(...fallbackDocs);
    }
    
    const results: WaybackResult[] = docs
        .map(doc => {
            const match = doc.identifier.match(/^web-(\d{14})-(.*)$/);
            if (!match) return null;
            const [, timestamp, urlPart] = match;
            const originalUrl = doc.title || urlPart;
            return {
                timestamp: timestamp,
                url: `https://web.archive.org/web/${timestamp}/${urlPart}`,
                originalUrl: originalUrl
            };
        })
        .filter((item): item is WaybackResult => item !== null)
        .reduce((acc: WaybackResult[], current) => {
            if (!acc.some(item => item.originalUrl === current.originalUrl)) {
                acc.push(current);
            }
            return acc;
        }, [])
        .slice(0, 40);
    return results;
}

// --- VIDEO SEARCH ---
export async function searchVideos(topic: string, signal: AbortSignal): Promise<VideoResult[]> {
    let docs = await searchArchive(topic, 'movies', 50, 1, signal);
    
    if (docs.length < 20) {
        const fallbackDocs = await searchArchive("subject:(public domain OR ephemeral film OR prelinger OR home movie)", 'movies', 40, 1, signal);
        const existingIds = new Set(docs.map(d => d.identifier));
        docs.push(...fallbackDocs.filter(d => !existingIds.has(d.identifier)));
    }
    
    return docs
        .filter(doc => doc.title && doc.identifier)
        .map(doc => ({
            identifier: doc.identifier,
            title: doc.title!,
        }))
        .slice(0, 50);
}

// --- FESTIVAL SEARCH ---
function findMatchingFestivals(topic: string): FestivalData[] {
    const topicWords = topic.toLowerCase().split(/\s+/).filter(w => w.length > 2); // Ignore short words
    return FESTIVAL_CATALOG.filter(festival => {
        const festivalTags = new Set([...festival.tags, festival.name.toLowerCase(), String(festival.year)]);
        return topicWords.some(word => {
            for (const tag of festivalTags) {
                if (tag.includes(word)) {
                    return true;
                }
            }
            return false;
        });
    });
}

// --- TAROT READING ---
export async function getTarotSpread(topic: string): Promise<TarotSpread> {
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2000));
    
    const spreadDefinition = TAROT_SPREADS[0];
    const shuffledDeck = [...MARSEILLE_DECK].sort(() => 0.5 - Math.random());
    
    const drawnCards = spreadDefinition.positions.map((position, index) => {
        const card = shuffledDeck[index];
        let interpretation = '';
        switch(position.meaning) {
            case 'The Past':
                interpretation = `Your search is anchored in the past. The ${card.name} appears, a relic of foundational energies. It speaks of ${card.description}, suggesting the seeds of your current quest were sown in moments of this nature, their echoes still shaping the currents you navigate.`;
                break;
            case 'The Present':
                interpretation = `Here, in the now, the data-sea churns with immediate concerns. The ${card.name} manifests, representing the challenge or advantage directly before you. It points to a focus on ${card.description}, urging you to pilot your skiff with this energy as your guide through the present moment.`;
                break;
            case 'The Future':
                 interpretation = `The fog of what's to come parts for a moment. The ${card.name} offers a cryptic signal from the future, a potential destination on your archival map. It hints at outcomes related to ${card.description}, a destiny that will crystallize based on the choices you make now.`;
                 break;
            default:
                 interpretation = `Regarding the ${position.meaning.toLowerCase()}, the ${card.name} suggests ${card.description}`;
        }
        return { card: card, positionMeaning: position.meaning, interpretation: interpretation };
    });

    return {
        spreadName: spreadDefinition.name,
        question: `Considering your search for "${topic}", what does the data-sea reveal about your path?`,
        cards: drawnCards,
    };
}

// --- WIKIPEDIA ENDANGERED ANIMALS ---
// Real animals from Earth — a sweet way to learn about conservation while archiving
const ANIMAL_LIST: { name: string; conservationStatus: string }[] = [
    { name: 'Blue whale', conservationStatus: 'Endangered' },
    { name: 'Sea otter', conservationStatus: 'Endangered' },
    { name: 'Vaquita', conservationStatus: 'Critically Endangered' },
    { name: 'Hawksbill sea turtle', conservationStatus: 'Critically Endangered' },
    { name: 'Atlantic bluefin tuna', conservationStatus: 'Endangered' },
    { name: 'Whale shark', conservationStatus: 'Endangered' },
    { name: 'Coelacanth', conservationStatus: 'Critically Endangered' },
    { name: 'Giant manta ray', conservationStatus: 'Endangered' },
    { name: 'Maui dolphin', conservationStatus: 'Critically Endangered' },
    { name: 'Humphead wrasse', conservationStatus: 'Endangered' },
    { name: 'Leatherback sea turtle', conservationStatus: 'Vulnerable' },
    { name: 'Great white shark', conservationStatus: 'Vulnerable' },
    { name: 'Dugong', conservationStatus: 'Vulnerable' },
    { name: 'European eel', conservationStatus: 'Critically Endangered' },
    { name: 'Hammerhead shark', conservationStatus: 'Critically Endangered' },
    { name: 'Mediterranean monk seal', conservationStatus: 'Endangered' },
    { name: 'Narwhal', conservationStatus: 'Vulnerable' },
    { name: 'Oarfish', conservationStatus: 'Least Concern' },
    { name: 'Ocean sunfish', conservationStatus: 'Vulnerable' },
    { name: 'North Atlantic right whale', conservationStatus: 'Critically Endangered' },
    { name: 'Galapagos penguin', conservationStatus: 'Endangered' },
    { name: 'Axolotl', conservationStatus: 'Critically Endangered' },
    { name: 'Beluga sturgeon', conservationStatus: 'Critically Endangered' },
    { name: 'Giant Pacific octopus', conservationStatus: 'Least Concern' },
    { name: 'Horseshoe crab', conservationStatus: 'Vulnerable' },
    { name: 'Leafy seadragon', conservationStatus: 'Near Threatened' },
    { name: 'Nautilus', conservationStatus: 'Endangered' },
    { name: 'Green sea turtle', conservationStatus: 'Endangered' },
];

export async function fetchRandomFishData(): Promise<FishData | null> {
    try {
        const animal = ANIMAL_LIST[Math.floor(Math.random() * ANIMAL_LIST.length)];
        const summaryEndpoint = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(animal.name)}`;

        const summaryResponse = await fetch(summaryEndpoint, { headers: { 'Accept': 'application/json; charset=utf-8' } });
        if (!summaryResponse.ok) throw new Error(`Wikipedia summary API error: ${summaryResponse.status}`);

        const summaryData = await summaryResponse.json();

        const name = summaryData.title || animal.name;
        const summary = summaryData.extract || 'No description available.';
        const imageUrl = summaryData.thumbnail?.source || null;

        return {
            name,
            summary,
            imageUrl,
            conservationStatus: animal.conservationStatus,
        };

    } catch (e) {
        console.error("Failed to fetch animal data:", e);
        return {
            name: "Unknown Specimen",
            summary: "A strange anomaly corrupted the data stream. The identity of this catch remains a mystery of the deep.",
            imageUrl: null,
            conservationStatus: 'Data Unavailable',
        };
    }
}

async function searchForSoundscape(topic: string, signal: AbortSignal): Promise<ThemedRadioStation | null> {
    const docs = await searchArchive(topic, 'audio', 20, 1, signal);
    if (signal.aborted) return null;

    // Use Promise.all to check documents in parallel for speed
    const checkPromises = docs.map(async (doc) => {
        if (signal.aborted) return null;
        const metaUrl = `https://archive.org/metadata/${doc.identifier}`;
        try {
            const metaRes = await fetch(metaUrl, { signal });
            if (!metaRes.ok) return null;

            const metaData = await metaRes.json();
            const files: ArchiveFile[] = metaData?.files || [];
            
            const audioFile = files.find(f => 
                f.name?.toLowerCase().endsWith('.mp3') &&
                f.format?.includes('MP3') && 
                f.source === 'original' &&
                f.length && parseFloat(f.length) > 600 // Must be > 10 minutes for a soundscape
            );

            if (audioFile) {
                return {
                    theme: doc.title || 'Ambient Soundscape',
                    query: topic,
                    streamUrl: `https://archive.org/download/${doc.identifier}/${encodeURIComponent(audioFile.name)}`
                };
            }
        } catch (e) {
             if ((e as Error).name !== 'AbortError') console.warn(`Could not process soundscape metadata for ${doc.identifier}`, e);
        }
        return null;
    });

    // Return the first valid soundscape found
    for (const promise of checkPromises) {
        const result = await promise;
        if (result) return result;
    }

    return null;
}

// --- NEW MASTER FETCH FUNCTION ---
export async function fetchInitialContent(queries: CuratedQueries, signal: AbortSignal): Promise<ContentPayload> {
    const emptyPayload: ContentPayload = {
        soundscape: { theme: 'Default Seascape', query: 'seascape', streamUrl: 'https://archive.org/download/seaside-ambience/Seaside%20Ambience.mp3' },
        radioStations: [], archivedSites: [], archivedVideos: [], festivalIslands: []
    };
    try {
        const [soundscapeResult, radioStations, archivedSites, archivedVideos] = await Promise.all([
            searchForSoundscape(queries.soundscape, signal),
            searchRadioStations(queries.radio, signal, 10, 1),
            searchWebsites(queries.web, signal),
            searchVideos(queries.video, signal),
        ]);

        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        
        const festivalIslands = findMatchingFestivals(queries.radio);
        
        const finalSoundscape = soundscapeResult || emptyPayload.soundscape;

        const validVideos = await validateAndFilterVideos(archivedVideos, signal);

        if (festivalIslands.length === 0) {
            const randomFestival = FESTIVAL_CATALOG[Math.floor(Math.random() * FESTIVAL_CATALOG.length)];
            festivalIslands.push(randomFestival);
        }

        return {
            soundscape: finalSoundscape,
            radioStations,
            archivedSites,
            archivedVideos: validVideos,
            festivalIslands
        };
    } catch(e) {
        if ((e as Error).name !== 'AbortError') {
            console.error("Failed to fetch initial content:", e);
        }
        return emptyPayload;
    }
}
