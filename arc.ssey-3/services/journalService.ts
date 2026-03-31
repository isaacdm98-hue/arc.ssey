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
