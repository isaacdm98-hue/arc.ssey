/**
 * searchService.ts — Free, token-less query generation
 * Replaces Gemini with deterministic keyword expansion using Wikipedia's opensearch API
 * and curated mood/topic mappings. Zero AI tokens consumed.
 */

export interface CuratedQueries {
    radio: string;
    video: string;
    web: string;
    soundscape: string;
}

// Mood → keyword modifiers for each content type
const MOOD_MODIFIERS: Record<string, { audio: string[]; video: string[]; web: string[]; ambient: string[] }> = {
    nostalgic:   { audio: ['retro', 'classic', 'vintage', 'oldies'], video: ['home movie', 'documentary', 'retrospective'], web: ['geocities', 'fansite', 'old web', 'personal homepage'], ambient: ['rain ambience', 'lo-fi', 'vinyl crackle'] },
    melancholy:  { audio: ['blues', 'ambient', 'slow', 'ballad'], video: ['art film', 'essay film', 'noir'], web: ['poetry', 'journal', 'diary', 'blog'], ambient: ['rain', 'thunder ambient', 'lonely piano'] },
    curious:     { audio: ['interview', 'lecture', 'radio show', 'talk'], video: ['educational', 'science', 'how things work'], web: ['encyclopedia', 'wiki', 'research', 'FAQ'], ambient: ['library sounds', 'clock ticking', 'study ambience'] },
    adventurous: { audio: ['world music', 'expedition', 'field recording'], video: ['travel', 'exploration', 'nature'], web: ['travelogue', 'expedition log', 'adventure'], ambient: ['ocean waves', 'jungle sounds', 'wind'] },
    peaceful:    { audio: ['classical', 'meditation', 'acoustic', 'new age'], video: ['nature documentary', 'zen', 'slow TV'], web: ['garden', 'nature', 'zen', 'mindfulness'], ambient: ['forest birds', 'stream', 'ocean waves'] },
    rebellious:  { audio: ['punk', 'underground', 'pirate radio', 'indie'], video: ['counterculture', 'protest', 'underground film'], web: ['zine', 'anarchist', 'independent media', 'subculture'], ambient: ['city night', 'subway', 'static'] },
    dreamy:      { audio: ['shoegaze', 'ambient', 'ethereal', 'dream pop'], video: ['surrealist', 'experimental film', 'art'], web: ['surrealism', 'digital art', 'dream journal'], ambient: ['space ambient', 'drone', 'ethereal'] },
    energetic:   { audio: ['dance', 'electronic', 'rave', 'DJ set'], video: ['concert', 'live performance', 'festival'], web: ['event', 'rave flyer', 'club', 'scene'], ambient: ['crowd ambience', 'city sounds', 'festival'] },
    romantic:    { audio: ['love songs', 'jazz', 'soul', 'R&B'], video: ['romance', 'love story', 'classic film'], web: ['love letter', 'poetry', 'romance'], ambient: ['café ambience', 'fireplace', 'soft rain'] },
    mysterious:  { audio: ['dark ambient', 'experimental', 'shortwave radio'], video: ['mystery', 'conspiracy', 'unexplained'], web: ['occult', 'mystery', 'unsolved', 'paranormal'], ambient: ['deep space', 'underwater', 'cave echo'] },
};

const DEFAULT_MOOD = { audio: ['music', 'radio'], video: ['film', 'documentary'], web: ['website', 'archive'], ambient: ['ambient sounds', 'nature'] };

/**
 * Uses Wikipedia's opensearch API to find related terms for a topic.
 * This is completely free and requires no API key.
 */
async function getRelatedTerms(topic: string): Promise<string[]> {
    try {
        const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(topic)}&limit=8&namespace=0&format=json&origin=*`;
        const res = await fetch(url);
        if (!res.ok) return [topic];
        const data = await res.json();
        // opensearch returns [query, [titles], [descriptions], [urls]]
        const titles: string[] = data[1] || [];
        return titles.length > 0 ? titles.slice(0, 5) : [topic];
    } catch {
        return [topic];
    }
}

/**
 * Generates curated search queries without any AI tokens.
 * Uses the topic + mood keywords + Wikipedia related terms.
 */
export async function generateCuratedSearchQueries(topic: string, feels: string[]): Promise<CuratedQueries> {
    // Get related terms from Wikipedia (free API)
    const relatedTerms = await getRelatedTerms(topic);
    const topicExpanded = relatedTerms.slice(0, 3).join(' OR ');

    // Collect mood modifiers
    const moodAudio: string[] = [];
    const moodVideo: string[] = [];
    const moodWeb: string[] = [];
    const moodAmbient: string[] = [];

    for (const feel of feels) {
        const key = feel.toLowerCase();
        const mod = MOOD_MODIFIERS[key] || DEFAULT_MOOD;
        moodAudio.push(...mod.audio);
        moodVideo.push(...mod.video);
        moodWeb.push(...mod.web);
        moodAmbient.push(...mod.ambient);
    }

    // If no feels selected, use defaults
    if (moodAudio.length === 0) {
        moodAudio.push(...DEFAULT_MOOD.audio);
        moodVideo.push(...DEFAULT_MOOD.video);
        moodWeb.push(...DEFAULT_MOOD.web);
        moodAmbient.push(...DEFAULT_MOOD.ambient);
    }

    // Pick random modifiers for variety
    const pickRandom = (arr: string[], n: number) => {
        const shuffled = [...arr].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, n);
    };

    const radioMods = pickRandom(moodAudio, 2).join(' OR ');
    const videoMods = pickRandom(moodVideo, 2).join(' OR ');
    const webMods = pickRandom(moodWeb, 2).join(' OR ');
    const ambientMods = pickRandom(moodAmbient, 2).join(' OR ');

    return {
        radio: `(${topicExpanded}) AND (${radioMods})`,
        video: `(${topicExpanded}) AND (${videoMods})`,
        web: `${topic} ${pickRandom(moodWeb, 1)[0]}`,
        soundscape: ambientMods,
    };
}

/**
 * Generates gull messages using Wikipedia's random article feature.
 * Returns a cryptic fragment from a random Wikipedia article related to the topic.
 * Completely free, no AI tokens.
 */
export async function generateGullMessage(topic: string, _stations: string[]): Promise<string> {
    const POETIC_FRAGMENTS = [
        "The tides remember what the servers forgot...",
        "Every broken link was once someone's homepage.",
        "In the static between stations, old voices linger.",
        "The cache expires, but the memory persists.",
        "Somewhere, a GeoCities page still loads in someone's dream.",
        "The data sea has no bottom, only deeper archives.",
        "What was uploaded can never truly be deleted.",
        "Every 404 is a ghost of what once was.",
        "The Wayback Machine remembers everything you've forgotten.",
        "Beneath the waves, old forums still argue.",
        "A thousand unread emails drift like jellyfish.",
        "The cursor blinks in an empty chat room, waiting.",
        "Your bookmarks are fossils of who you used to be.",
        "The modem's song was the first whale call of the digital sea.",
        "Every pixel was placed by a human hand.",
        "The internet was handmade, once.",
        "Between the packets, silence speaks volumes.",
        "An abandoned blog is a message in a bottle.",
        "The web rings still turn, if you know where to listen.",
        "What you seek has already been archived.",
    ];

    try {
        // Try to get a real Wikipedia extract related to the topic for variety
        const url = `https://en.wikipedia.org/api/rest_v1/page/random/summary`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json; charset=utf-8' } });
        if (res.ok) {
            const data = await res.json();
            const extract: string = data.extract || '';
            // Take the first sentence, truncate to ~15 words
            const firstSentence = extract.split('.')[0];
            const words = firstSentence.split(/\s+/).slice(0, 12);
            if (words.length > 5) {
                return words.join(' ') + '...';
            }
        }
    } catch {
        // Fall through to poetic fragments
    }

    return POETIC_FRAGMENTS[Math.floor(Math.random() * POETIC_FRAGMENTS.length)];
}
