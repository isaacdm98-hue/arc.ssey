import React, { useState, useEffect } from 'react';

const Title: React.FC = () => {
    const text = "arc.ssey";
    const [displayedText, setDisplayedText] = useState("");
  
    useEffect(() => {
        setDisplayedText("");
        const interval = setInterval(() => {
            setDisplayedText(current => {
                if (current.length < text.length) {
                    return current + text[current.length];
                }
                clearInterval(interval);
                return current;
            });
        }, 150);
        return () => clearInterval(interval);
    }, []);
  
    return <h1 className="text-7xl font-bold text-cyan-300 mb-4 tracking-[0.2em] font-orbitron">{displayedText}<span className="animate-blink">_</span></h1>;
};


export const TitleScreen: React.FC<{ onStart: () => void }> = ({ onStart }) => {
  return (
    <div className="fixed inset-0 bg-black text-cyan-200 font-crt flex flex-col items-center justify-center p-8 z-[300]">
      {/* CRT Scanline and Vignette Effects */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_50%,black)]" />
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(0deg, black 0, black 1px, transparent 1px, transparent 2px)'}}/>
      
      <div className="text-center animate-fadeIn z-10">
        <Title />
        <p className="max-w-xl mx-auto text-lg mb-8 leading-relaxed">
            In the quiet hum of the digital void, echoes of a forgotten network persist. You are an Archivist. Your mission: navigate the data-sea, tune into lost signals, and recover fragments of a world that was...
        </p>
        <button 
            onClick={onStart} 
            className="px-8 py-3 text-2xl tracking-widest text-black bg-cyan-300 hover:bg-white hover:shadow-[0_0_25px_rgba(0,255,255,0.8)] transition-all duration-300 transform hover:scale-105"
        >
            BEGIN TRANSMISSION
        </button>
      </div>
    </div>
  );
};