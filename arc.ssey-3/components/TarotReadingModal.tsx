
import React from 'react';
import type { TarotSpread } from '../types';
import { LoadingIcon } from './Icons';
import './TarotReadingModal.css';

interface TarotReadingModalProps {
    isOpen: boolean;
    onClose: () => void;
    spread: TarotSpread | null;
}

export const TarotReadingModal: React.FC<TarotReadingModalProps> = ({ isOpen, onClose, spread }) => {
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 z-[200] font-crt flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" />
            <div 
                className="pointer-events-auto w-full max-w-2xl bg-[#1a0a1f] border-2 border-purple-900/80 rounded-lg shadow-lg flex flex-col animate-fadeIn"
                style={{ boxShadow: '0 0 40px rgba(128,0,255,.3), 0 0 10px rgba(0,0,0,.5)' }}
                onClick={e => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-3 border-b border-purple-900/80">
                    <div className="flex items-center gap-2 text-purple-300">
                        <h2 className="text-lg tracking-widest" style={{textShadow: '0 0 3px rgba(186,85,211,0.5)'}}>{spread ? spread.spreadName.toUpperCase() : 'A READING'}</h2>
                    </div>
                    <button onClick={onClose} className="px-3 py-1 text-xs text-purple-200 bg-purple-900/80 rounded hover:bg-purple-800/90">DISMISS</button>
                </header>

                <main className="p-4 sm:p-6 max-h-[80vh] overflow-y-auto">
                    {!spread ? (
                        <div className="flex flex-col items-center justify-center h-48 text-purple-400">
                            <LoadingIcon className="w-10 h-10 mb-4 animate-spin" />
                            <p>The cosmos aligns...</p>
                        </div>
                    ) : (
                        <div className="text-center">
                            <p className="text-purple-200 mb-6 italic text-lg">{spread.question}</p>
                            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6">
                                {spread.cards.map((reading, index) => (
                                    <div key={index} className="flex flex-col items-center tarot-card-reveal">
                                        <h3 className="text-xl font-bold text-yellow-300 mb-2" style={{ textShadow: '0 0 5px rgba(252, 211, 77, 0.8)' }}>
                                            {reading.card.name}
                                        </h3>
                                        <div className="tarot-card-visual mb-2">
                                            <img src={reading.card.imageUrl} alt={reading.card.name} className="w-full h-full object-cover rounded-md" />
                                        </div>
                                        <p className="text-purple-300 font-bold uppercase text-sm tracking-widest">{reading.positionMeaning}</p>
                                        <p className="text-purple-200 leading-relaxed text-sm max-w-xs mt-1">{reading.interpretation}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};
