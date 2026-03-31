import React, { useState, useEffect, useRef } from 'react';
import { GoIcon } from './Icons';

const cinematicTexts = [
  "The data-sea is calm tonight...",
  "Lost signals echo in the void...",
  "A forgotten world awaits rediscovery.",
  "Listen closely, Archivist."
];

export const Intro: React.FC<{ onTopicSubmitted: (topic: string) => void }> = ({ onTopicSubmitted }) => {
  const [step, setStep] = useState(0);
  const [text, setText] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [topicInput, setTopicInput] = useState('');
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step < cinematicTexts.length) {
      const currentText = cinematicTexts[step];
      setText(currentText);
      setPhase('in');
      
      const inTimer = setTimeout(() => {
        setPhase('out');
      }, 3000); // Hold text for 3s
      
      const outTimer = setTimeout(() => {
        setStep(s => s + 1);
      }, 4500); // Fade out and wait 1.5s before next
      
      return () => {
        clearTimeout(inTimer);
        clearTimeout(outTimer);
      };

    } else {
      setShowInput(true);
    }
  }, [step]);
  
  useEffect(() => {
    if (showInput) {
      inputRef.current?.focus();
    }
  }, [showInput]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topicInput.trim()) {
      onTopicSubmitted(topicInput.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-cyan-200 font-crt flex flex-col items-center justify-center p-8 z-[300]">
       <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_50%,black)]" />
       <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(0deg, black 0, black 1px, transparent 1px, transparent 2px)'}}/>
       
       <div className="text-center z-10 w-full max-w-2xl">
         {!showInput && (
            <p className={`text-3xl transition-opacity duration-1000 ease-in-out ${phase === 'in' ? 'opacity-100' : 'opacity-0'}`}>
              {text}
            </p>
         )}
         
         {showInput && (
            <div className="animate-fadeIn">
              <p className="text-3xl mb-8">What do you truly want to explore today?</p>
               <form onSubmit={handleSubmit} className="relative w-full max-w-lg mx-auto">
                    <input 
                        ref={inputRef}
                        type="text"
                        value={topicInput}
                        onChange={(e) => setTopicInput(e.target.value)}
                        placeholder="e.g., 90s alternative rock music videos..."
                        className="w-full bg-transparent border-b-2 border-cyan-400/50 py-2 text-2xl text-center text-cyan-200 placeholder:text-cyan-400/60 focus:outline-none focus:ring-0 focus:border-cyan-300 transition-all"
                    />
                    <button 
                        type="submit"
                        className="absolute right-0 top-1/2 -translate-y-1/2 text-cyan-400 hover:text-cyan-200">
                        <GoIcon className="w-8 h-8"/>
                    </button>
                </form>
            </div>
         )}
       </div>
    </div>
  );
};
