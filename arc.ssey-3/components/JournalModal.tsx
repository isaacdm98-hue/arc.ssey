/**
 * JournalModal.tsx — The archivist's logbook
 * Shows all discoveries, catches, notes. Allows writing personal notes.
 * Can export to HTML/PDF after 8 weeks.
 */

import React, { useState, useRef, useEffect } from 'react';
import type { JournalState, JournalEntry } from '../types';
import { addNote, canExportPDF, exportJournalAsHTML } from '../services/journalService';

interface JournalModalProps {
    isOpen: boolean;
    onClose: () => void;
    journal: JournalState | null;
    onJournalUpdate: (journal: JournalState) => void;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
    discovery: { label: 'DISCOVERY', color: 'text-cyan-400' },
    note: { label: 'NOTE', color: 'text-amber-300' },
    catch: { label: 'SPECIMEN', color: 'text-green-400' },
    radio: { label: 'RADIO', color: 'text-pink-400' },
    tarot: { label: 'READING', color: 'text-purple-400' },
};

const EntryCard: React.FC<{ entry: JournalEntry }> = ({ entry }) => {
    const typeInfo = TYPE_LABELS[entry.type] || { label: 'LOG', color: 'text-gray-400' };
    const date = new Date(entry.timestamp).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });

    return (
        <div className="border border-green-900/40 rounded p-3 mb-2 bg-black/30 hover:bg-black/50 transition-colors">
            <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold tracking-widest ${typeInfo.color}`}>{typeInfo.label}</span>
                <span className="text-xs text-green-700">{date}</span>
            </div>
            <h4 className="text-sm text-green-200 mb-1">{entry.title}</h4>
            {entry.imageUrl && (
                <img src={entry.imageUrl} alt="" className="w-full h-24 object-cover rounded mb-1 opacity-80" />
            )}
            <p className="text-xs text-green-400/70 leading-relaxed whitespace-pre-wrap line-clamp-3">{entry.body}</p>
        </div>
    );
};

export const JournalModal: React.FC<JournalModalProps> = ({ isOpen, onClose, journal, onJournalUpdate }) => {
    const [noteText, setNoteText] = useState('');
    const [filter, setFilter] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [isOpen, journal?.entries.length]);

    if (!isOpen || !journal) return null;

    const entries = filter
        ? journal.entries.filter(e => e.type === filter)
        : journal.entries;

    const handleAddNote = () => {
        if (!noteText.trim()) return;
        const updated = addNote(journal, noteText.trim());
        onJournalUpdate(updated);
        setNoteText('');
    };

    const handleExport = () => {
        const html = exportJournalAsHTML(journal);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `arcssey-journal-${journal.topic.replace(/\s+/g, '-')}.html`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const exportReady = canExportPDF(journal);

    return (
        <div className="pointer-events-none fixed inset-0 z-[200] font-crt flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" onClick={onClose} />
            <div
                className="pointer-events-auto w-[min(90vw,600px)] h-[min(85vh,700px)] rounded-lg overflow-hidden shadow-2xl animate-fadeIn flex flex-col"
                style={{ boxShadow: '0 0 40px rgba(0,255,0,.15), 0 0 10px rgba(0,0,0,.5)' }}
            >
                <div className="relative bg-[#051008] border-2 border-green-900/80 flex flex-col flex-grow min-h-0">
                    {/* Header */}
                    <header className="flex items-center justify-between gap-3 px-3 py-2 border-b border-green-900/80 flex-shrink-0">
                        <div className="flex gap-1.5">
                            <button className="w-3.5 h-3.5 rounded-full bg-rose-500 hover:bg-rose-400" onClick={onClose} aria-label="Close" />
                        </div>
                        <div className="text-green-400/80 text-sm tracking-[.15em]" style={{ textShadow: '0 0 2px rgba(0,255,0,0.5)' }}>
                            ARCHIVIST'S JOURNAL
                        </div>
                        <div className="text-xs text-green-600">{journal.entries.length} entries</div>
                    </header>

                    {/* Filter tabs */}
                    <div className="flex gap-1 px-3 py-2 border-b border-green-900/40 flex-shrink-0 overflow-x-auto">
                        <button
                            onClick={() => setFilter(null)}
                            className={`px-2 py-0.5 text-xs rounded ${!filter ? 'bg-green-800 text-green-200' : 'text-green-600 hover:text-green-400'}`}
                        >ALL</button>
                        {Object.entries(TYPE_LABELS).map(([key, { label, color }]) => (
                            <button
                                key={key}
                                onClick={() => setFilter(filter === key ? null : key)}
                                className={`px-2 py-0.5 text-xs rounded ${filter === key ? 'bg-green-800 text-green-200' : `${color} opacity-60 hover:opacity-100`}`}
                            >{label}</button>
                        ))}
                    </div>

                    {/* Entries list */}
                    <div ref={scrollRef} className="flex-grow overflow-y-auto p-3 custom-scrollbar min-h-0">
                        {entries.length === 0 ? (
                            <div className="text-center text-green-700 mt-8">
                                <p className="text-lg mb-2">No entries yet.</p>
                                <p className="text-sm">Your discoveries will be logged here automatically.</p>
                            </div>
                        ) : (
                            entries.map(entry => <EntryCard key={entry.id} entry={entry} />)
                        )}
                    </div>

                    {/* Note input */}
                    <div className="border-t border-green-900/80 p-3 flex-shrink-0">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={noteText}
                                onChange={e => setNoteText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                                placeholder="Write a note..."
                                className="flex-grow bg-black/50 border border-green-900/50 rounded px-3 py-2 text-sm text-green-300 placeholder-green-800 outline-none focus:border-green-600"
                            />
                            <button
                                onClick={handleAddNote}
                                className="px-4 py-2 text-sm bg-green-900/50 text-green-300 border border-green-700/50 rounded hover:bg-green-800/50 transition-colors"
                            >Log</button>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-green-800">Topic: "{journal.topic}"</span>
                            <button
                                onClick={handleExport}
                                disabled={!exportReady}
                                className={`text-xs px-3 py-1 rounded border transition-colors ${
                                    exportReady
                                        ? 'border-cyan-600 text-cyan-400 hover:bg-cyan-900/30'
                                        : 'border-green-900/30 text-green-900 cursor-not-allowed'
                                }`}
                                title={exportReady ? 'Export journal as HTML' : 'Complete 8 weeks of archiving to unlock export'}
                            >
                                {exportReady ? 'Export Journal' : 'Export (8 weeks)'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
