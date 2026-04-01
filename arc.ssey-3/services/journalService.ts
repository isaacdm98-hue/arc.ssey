/**
 * journalService.ts — Persistent journal/logbook using localStorage
 * Auto-logs discoveries, catches, and radio listens.
 * Users can also write their own notes.
 */

import type { JournalEntry, JournalState } from '../types';

const STORAGE_KEY = 'arcssey_journal';

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function loadJournal(): JournalState | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function saveJournal(state: JournalState): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('Failed to save journal:', e);
    }
}

export function createJournal(topic: string): JournalState {
    const state: JournalState = {
        entries: [],
        topic,
        startedAt: Date.now(),
        sessionsCompleted: 0,
    };
    saveJournal(state);
    return state;
}

export function addEntry(
    journal: JournalState,
    type: JournalEntry['type'],
    title: string,
    body: string,
    imageUrl?: string,
    metadata?: Record<string, string>
): JournalState {
    const entry: JournalEntry = {
        id: generateId(),
        timestamp: Date.now(),
        type,
        title,
        body,
        imageUrl,
        metadata,
    };
    const updated = {
        ...journal,
        entries: [...journal.entries, entry],
    };
    saveJournal(updated);
    return updated;
}

export function addNote(journal: JournalState, noteText: string): JournalState {
    return addEntry(journal, 'note', 'Personal Note', noteText);
}

export function logDiscovery(
    journal: JournalState,
    contentType: string,
    title: string,
    url?: string
): JournalState {
    return addEntry(
        journal,
        'discovery',
        `${contentType}: ${title}`,
        `Discovered while exploring the data sea.`,
        undefined,
        url ? { url } : undefined
    );
}

export function logCatch(
    journal: JournalState,
    name: string,
    summary: string,
    conservationStatus: string,
    imageUrl?: string
): JournalState {
    return addEntry(
        journal,
        'catch',
        `Specimen: ${name}`,
        `${summary}\n\nConservation Status: ${conservationStatus}`,
        imageUrl,
        { conservationStatus }
    );
}

export function logRadio(
    journal: JournalState,
    stationName: string
): JournalState {
    return addEntry(
        journal,
        'radio',
        `Tuned: ${stationName}`,
        `Picked up a signal from the archives.`
    );
}

// --- OBLIQUE RESEARCH PROMPTS ---
// Appear every 5 entries as printed cards on the journal page.
// Not AI-generated — curated oblique strategy-style research provocations.
export const OBLIQUE_PROMPTS = [
    "What is missing from what you've found so far?",
    "If this topic were a place, where would it be?",
    "What would someone who disagreed with this say?",
    "Find the oldest thing related to this topic.",
    "What are you avoiding?",
    "Who made this, and why?",
    "What does this remind you of from your childhood?",
    "Is there a sound associated with this topic?",
    "What was happening in the world when this was made?",
    "Follow the weakest signal.",
    "What would this look like in 100 years?",
    "What's the most human thing you've found?",
    "Look for something that contradicts everything else.",
    "If you could ask the creator one question, what would it be?",
    "What was deleted? What's in the gaps?",
    "Find something beautiful that nobody else would notice.",
    "What's the connection between the last three things you found?",
    "Search for something adjacent — not the topic itself, but what surrounds it.",
    "What would a child make of all this?",
    "Is there a pattern you're not seeing?",
    "What was the first thing that surprised you?",
    "Stop looking for answers. Look for better questions.",
    "What would you archive from today, right now, for someone in 2074?",
    "Find the funniest thing related to this topic.",
    "What's the loneliest artifact you've found?",
    "If this were music, what genre would it be?",
    "What's the opposite of what you expected to find?",
    "Look for something handmade.",
    "What would a librarian say about your collection so far?",
    "Find something that was once important and is now forgotten.",
    "What's the smallest detail that changes everything?",
    "Who is missing from this story?",
    "What would you title this research if it were a book?",
    "Search for something you're embarrassed to be curious about.",
    "What connects this to the ocean?",
    "Find the edges. What's just outside this topic?",
    "What would your future self want you to notice?",
    "Look for repetition. What keeps coming back?",
    "If this topic were weather, what kind?",
    "What has changed the most since this was created?",
    "Find something that makes you feel something unexpected.",
    "What's the most fragile thing in your collection?",
    "Look backwards. What came before the beginning?",
    "What would someone from a completely different culture think of this?",
    "The next thing you find — write about why it matters to you personally.",
    "What would you tell someone who has never heard of this topic?",
    "Find something that proves time has passed.",
    "What's the thread connecting everything you've found?",
    "Stop and listen. What do you hear in the silence between signals?",
    "What would you send into space to represent this?",
];

export function getObliquePrompt(entryCount: number): string | null {
    if (entryCount > 0 && entryCount % 5 === 0) {
        return OBLIQUE_PROMPTS[Math.floor(Math.random() * OBLIQUE_PROMPTS.length)];
    }
    return null;
}

/**
 * Check if 8 weeks of journaling have passed (for PDF export unlock)
 */
export function canExportPDF(journal: JournalState): boolean {
    const eightWeeks = 8 * 7 * 24 * 60 * 60 * 1000;
    return (Date.now() - journal.startedAt) >= eightWeeks && journal.entries.length >= 10;
}

/**
 * Generate a simple text/HTML export of the journal for PDF creation.
 */
export function exportJournalAsHTML(journal: JournalState): string {
    const dateFormat = (ts: number) => new Date(ts).toLocaleDateString('en-GB', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const typeIcons: Record<string, string> = {
        discovery: '&#x1F50E;',
        note: '&#x270D;',
        catch: '&#x1F41F;',
        radio: '&#x1F4FB;',
        tarot: '&#x2728;',
    };

    const entries = journal.entries.map(e => `
        <div style="margin-bottom:24px;padding:16px;border:1px solid #333;border-radius:8px;background:#0a0a0a;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <span style="color:#67e8f9;font-size:14px;">${typeIcons[e.type] || ''} ${e.title}</span>
                <span style="color:#666;font-size:12px;">${dateFormat(e.timestamp)}</span>
            </div>
            ${e.imageUrl ? `<img src="${e.imageUrl}" style="width:100%;max-height:200px;object-fit:cover;border-radius:4px;margin-bottom:8px;" />` : ''}
            <p style="color:#a7f3d0;font-size:14px;line-height:1.6;white-space:pre-wrap;">${e.body}</p>
        </div>
    `).join('');

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>arc.ssey Journal: ${journal.topic}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=VT323&family=Orbitron:wght@700&display=swap');
        body { font-family: 'VT323', monospace; background: #000; color: #e2e8f0; max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        h1 { font-family: 'Orbitron', sans-serif; color: #67e8f9; text-align: center; font-size: 32px; letter-spacing: 0.2em; }
        h2 { color: #f9a8d4; text-align: center; font-size: 18px; margin-bottom: 40px; }
        .meta { text-align: center; color: #666; margin-bottom: 32px; font-size: 14px; }
    </style>
</head>
<body>
    <h1>arc.ssey</h1>
    <h2>Archival Journal: "${journal.topic}"</h2>
    <div class="meta">
        <p>Journey began: ${dateFormat(journal.startedAt)}</p>
        <p>${journal.entries.length} entries logged</p>
    </div>
    ${entries}
    <div style="text-align:center;color:#333;margin-top:60px;font-size:12px;">
        <p>Generated by arc.ssey — the old internet museum</p>
    </div>
</body>
</html>`;
}
