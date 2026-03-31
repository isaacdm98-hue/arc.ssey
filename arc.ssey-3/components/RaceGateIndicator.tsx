
import React from 'react';

interface RaceGateIndicatorProps {
  position: { x: number; y: number } | null;
}

export const RaceGateIndicator: React.FC<RaceGateIndicatorProps> = ({ position }) => {
  if (!position) return null;
  
  // Clamp position to stay within the viewport with a small margin
  const margin = 20;
  const clampedX = Math.max(margin, Math.min(window.innerWidth - margin, position.x));
  const clampedY = Math.max(margin, Math.min(window.innerHeight - margin, position.y));

  return (
    <div
      className="fixed z-10 pointer-events-none transition-all duration-100 ease-linear"
      style={{
        left: `${clampedX}px`,
        top: `${clampedY}px`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
           className="text-cyan-300 animate-pulse drop-shadow-[0_0_5px_rgba(0,255,255,0.8)]">
        <path d="M12 4L12 20M12 4L8 8M12 4L16 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
      </svg>
    </div>
  );
};
