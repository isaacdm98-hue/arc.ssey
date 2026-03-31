import React, { useState } from 'react';

const ALL_FEELS = [
  "nostalgic", "melancholy", "curious", "adventurous", "peaceful",
  "rebellious", "dreamy", "energetic", "romantic", "mysterious",
  "Cozy rainy days", "8-bit video game music", "Learning about space",
  "Vintage computer aesthetics", "Obscure documentaries", "Live folk music",
  "The sound of a dial-up modem", "Exploring abandoned places",
  "Silent films", "Cryptic puzzles", "DIY electronics",
  "Early 2000s internet culture", "Jazz clubs at midnight",
  "Deep sea exploration", "Stories about pirates", "Old radio shows",
  "Lo-fi beats", "Thunderstorms", "Stargazing", "Library whispers",
];

// Pre-calculate random properties for consistent rendering
const rainingFeels = ALL_FEELS.map((feel, index) => ({
  id: index,
  text: feel,
  left: `${Math.random() * 95}%`,
  duration: `${10 + Math.random() * 10}s`,
  delay: `-${Math.random() * 20}s`,
}));

export const FeelsCatcher: React.FC<{ onFeelsSubmitted: (feels: string[]) => void }> = ({ onFeelsSubmitted }) => {
  const [selectedFeels, setSelectedFeels] = useState<Set<string>>(new Set());

  const handleFeelClick = (feelText: string) => {
    setSelectedFeels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(feelText)) {
        newSet.delete(feelText);
      } else {
        newSet.add(feelText);
      }
      return newSet;
    });
  };

  const handleSubmit = () => {
    onFeelsSubmitted(Array.from(selectedFeels));
  };
  
  return (
    <div className="fixed inset-0 bg-black text-cyan-200 font-crt flex flex-col items-center justify-center p-4 z-[300] overflow-hidden">
      <style>{`
        @keyframes rain {
          from { transform: translateY(-10vh); }
          to { transform: translateY(110vh); }
        }
        .raining-feel {
          animation-name: rain;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}</style>
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_50%,black)]" />
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(0deg, black 0, black 1px, transparent 1px, transparent 2px)'}}/>
      
      <div className="text-center z-10">
        <h1 className="text-4xl text-cyan-300 mb-4 animate-fadeIn">Feels Catcher</h1>
        <p className="text-lg mb-8 max-w-2xl mx-auto animate-fadeIn" style={{ animationDelay: '0.5s' }}>
          Click the falling signals to tune the data-sea to your mood. What are you feeling today?
        </p>
      </div>

      <div className="absolute inset-0 z-0">
        {rainingFeels.map(feel => (
          <button
            key={feel.id}
            onClick={() => handleFeelClick(feel.text)}
            className={`raining-feel absolute top-0 text-lg transition-all duration-300 whitespace-nowrap ${selectedFeels.has(feel.text) ? 'text-yellow-300 scale-110' : 'text-cyan-400/70 hover:text-cyan-200 hover:scale-110'}`}
            style={{
              left: feel.left,
              animationDuration: feel.duration,
              animationDelay: feel.delay,
            }}
          >
            {feel.text}
          </button>
        ))}
      </div>
      
      <button
        onClick={handleSubmit}
        className="fixed bottom-10 z-20 px-8 py-3 text-2xl tracking-widest text-black bg-cyan-300 hover:bg-white disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
      >
        Tune Signals ({selectedFeels.size})
      </button>
    </div>
  );
};