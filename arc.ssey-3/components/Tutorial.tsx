import React, { useState } from 'react';
import type { AudioBus } from './AudioBus';

interface TutorialProps {
    isOpen: boolean;
    onClose: () => void;
    audioBus: AudioBus | null;
}

const tutorialSteps = [
    {
        title: "Welcome, Archivist",
        text: "You are an explorer of the data-sea, a vast digital ocean of lost information. Your mission: to navigate the endless calm and recover forgotten signals from the old web."
    },
    {
        title: "Piloting the Skiff",
        text: "Your vessel responds to [W][A][S][D] or [Arrow Keys]. On touch devices, the engines engage with a touch, while steering is controlled by tapping the left or right side of the screen."
    },
    {
        title: "Tuning the Archives",
        text: "Direct your sensors by entering a topic into the search console. The data-sea will reconfigure, populating with crystalline islands that echo your query."
    },
    {
        title: "Signal Recovery",
        text: "Approach the islands to recover their data. A proximity alert will notify you of a nearby signal. Once acquired, the contents will materialize for your review."
    },
    {
        title: "Radio Transmissions",
        text: "Your search also attunes the radio to forgotten broadcasts. Use the dial at the bottom or the station list to listen to themed audio streams adrift in the ether."
    },
    {
        title: "The Mysteries of the Deep",
        text: "The data-sea is full of strange phenomena. Look for mystical tents, playful companions, and ghostly apparitions beneath the waves. The archive is vast. Explore."
    }
];

export const Tutorial: React.FC<TutorialProps> = ({ isOpen, onClose, audioBus }) => {
    const [step, setStep] = useState(0);

    if (!isOpen) return null;

    const handleNext = () => {
        if (step < tutorialSteps.length - 1) {
            setStep(s => s + 1);
        } else {
            onClose();
        }
    };

    const playClick = () => audioBus?.playSfx('https://archive.org/download/classic-click/classic_click.mp3');

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center font-crt bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div 
                className="w-full max-w-lg bg-[#0a1a0f] border-2 border-green-900/80 rounded-lg shadow-lg flex flex-col animate-fadeIn p-6 text-center"
                style={{ boxShadow: '0 0 40px rgba(0,255,0,.2), 0 0 10px rgba(0,0,0,.5)' }}
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-2xl text-cyan-300 tracking-widest mb-4" style={{textShadow: '0 0 4px rgba(0,255,255,0.5)'}}>
                    {tutorialSteps[step].title}
                </h2>
                <p className="text-green-300 text-lg leading-relaxed mb-6">
                    {tutorialSteps[step].text}
                </p>
                <div className="flex justify-center gap-4">
                    <button 
                        onClick={onClose} 
                        onMouseDown={playClick}
                        className="px-4 py-2 text-sm text-green-300 bg-green-900/80 rounded hover:bg-green-800/90 transition-colors">
                        Skip Tutorial
                    </button>
                    <button 
                        onClick={handleNext} 
                        onMouseDown={playClick}
                        className="px-6 py-2 text-lg text-black bg-cyan-300 hover:bg-white transition-colors">
                        {step === tutorialSteps.length - 1 ? 'Begin' : 'Next'}
                    </button>
                </div>
            </div>
        </div>
    );
};