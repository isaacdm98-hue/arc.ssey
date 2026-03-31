
import React from 'react';
import type { RadioStatus, ThemedRadioStation } from '../types';
import { LoadingIcon } from './Icons';

interface RadioPanelProps {
    isOpen: boolean;
    onClose: () => void;
    stations: ThemedRadioStation[];
    status: RadioStatus;
    onTune: (station: ThemedRadioStation | null) => void;
}

export const RadioPanel: React.FC<RadioPanelProps> = ({ isOpen, onClose, stations, status, onTune }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center font-crt" onClick={onClose}>
            <div 
                className="w-full max-w-md bg-[#0a1a0f] border-2 border-green-900/80 rounded-lg shadow-lg flex flex-col animate-fadeIn"
                style={{ boxShadow: '0 0 40px rgba(0,255,0,.2), 0 0 10px rgba(0,0,0,.5)' }}
                onClick={e => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-3 border-b border-green-900/80">
                    <h2 className="text-lg text-green-400 tracking-widest" style={{textShadow: '0 0 3px rgba(0,255,0,0.5)'}}>RADIO SIGNALS</h2>
                    <button 
                        onClick={onClose} 
                        className="px-3 py-1 text-xs text-green-300 bg-green-900/80 rounded hover:bg-green-800/90">CLOSE</button>
                </header>

                <main className="p-2 flex-grow overflow-y-auto h-96">
                    {stations.length === 0 && (
                        <div className="flex items-center justify-center h-full text-green-700">
                            <p>No radio signals found for this topic.</p>
                        </div>
                    )}
                    <ul className="space-y-1">
                        {stations.map((station, i) => {
                            const isPlaying = status.isPlaying && status.title === station.theme;
                            const isLoading = status.isLoading && status.title === station.theme;

                            const handleTuneClick = () => {
                                if (isPlaying) {
                                    onTune(null); // Explicitly stop
                                } else {
                                    onTune(station); // Play this station
                                }
                            };

                            return (
                                <li key={i} className="flex items-center justify-between p-2 rounded bg-black/30 hover:bg-green-900/40 transition-colors">
                                    <span className="text-green-400">{station.theme}</span>
                                    <button 
                                        onClick={handleTuneClick} 
                                        className={`w-20 px-3 py-1 text-sm text-center rounded border transition-colors ${
                                            isPlaying
                                              ? 'bg-rose-800/80 border-rose-600/80 text-rose-200 hover:bg-rose-700/90'
                                              : 'bg-green-900/80 border-green-800 text-green-300 hover:bg-green-800/90'
                                          }`}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? <LoadingIcon className="w-4 h-4 mx-auto animate-spin" /> : (isPlaying ? 'STOP' : 'PLAY')}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </main>
            </div>
        </div>
    );
};
