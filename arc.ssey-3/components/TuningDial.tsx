
import React, { useState, useRef, useEffect } from 'react';
import type { RadioStatus, ThemedRadioStation } from '../types';
import { LoadingIcon, RadioIcon, FishIcon } from './Icons';
import { MathUtils } from 'three';

interface TuningDialProps {
    stations: ThemedRadioStation[];
    onTune: (station: ThemedRadioStation | null) => void;
    status: RadioStatus;
    mode?: 'radio' | 'fishing';
    onReelSpin?: () => void;
}

const noiseTexture = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`;

export const TuningDial: React.FC<TuningDialProps> = ({ stations, onTune, status, mode = 'radio', onReelSpin }) => {
    const dialRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isSpinning, setIsSpinning] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0, position: 0 });
    const tuneTimeoutRef = useRef<number | null>(null);
    const spinTimeoutRef = useRef<number | null>(null);
    const lastTunedStationRef = useRef<ThemedRadioStation | null>(null);

    const dialWidth = 2000;

    const handleReel = () => {
        onReelSpin?.();
        setIsSpinning(true);
        if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
        spinTimeoutRef.current = window.setTimeout(() => setIsSpinning(false), 200);
    };
    
    useEffect(() => {
        const handlePointerMoveRadio = (e: PointerEvent) => {
            if (!isDragging || !dialRef.current) return;
            e.preventDefault();
            const dx = e.clientX - dragStartRef.current.x;
            const newPos = dragStartRef.current.position - dx;
            setPosition(MathUtils.clamp(newPos, 0, dialWidth - dialRef.current.clientWidth));
        };
        
        const handlePointerMoveFishing = (e: PointerEvent) => {
            if (!isDragging) return;
            e.preventDefault();
            const dy = e.clientY - dragStartRef.current.y;
            if (Math.abs(dy) > 10) {
                handleReel();
                dragStartRef.current.y = e.clientY;
            }
        };

        const handlePointerUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            const moveHandler = mode === 'radio' ? handlePointerMoveRadio : handlePointerMoveFishing;
            window.addEventListener('pointermove', moveHandler);
            window.addEventListener('pointerup', handlePointerUp);
            return () => {
                window.removeEventListener('pointermove', moveHandler);
                window.removeEventListener('pointerup', handlePointerUp);
            };
        }
    }, [isDragging, mode, onReelSpin]);
    
    useEffect(() => {
        if (mode !== 'radio') return;
        if (tuneTimeoutRef.current) clearTimeout(tuneTimeoutRef.current);

        tuneTimeoutRef.current = window.setTimeout(() => {
            if (!dialRef.current || stations.length === 0) {
                if (lastTunedStationRef.current) onTune(null);
                lastTunedStationRef.current = null;
                return;
            };

            const needlePosition = position + dialRef.current.clientWidth / 2;
            const snapDistance = stations.length > 1 ? (dialWidth / stations.length) / 2.1 : 50;

            let closestStation: ThemedRadioStation | null = null;
            let minDistance = Infinity;

            stations.forEach((station, i) => {
                const stationPos = (i + 0.5) * (dialWidth / stations.length);
                const distance = Math.abs(needlePosition - stationPos);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestStation = station;
                }
            });
            
            const stationToTune = minDistance < snapDistance ? closestStation : null;

            if (stationToTune?.streamUrl !== lastTunedStationRef.current?.streamUrl) {
                onTune(stationToTune);
            }
            lastTunedStationRef.current = stationToTune;

        }, isDragging ? 250 : 100);

        return () => { if (tuneTimeoutRef.current) clearTimeout(tuneTimeoutRef.current); }
    }, [position, stations, onTune, isDragging, mode]);


    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY, position };
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (!dialRef.current) return;
        e.preventDefault();
        if (mode === 'radio') {
            const newPos = position + e.deltaY * 0.5 + e.deltaX * 0.5;
            setPosition(MathUtils.clamp(newPos, 0, dialWidth - dialRef.current.clientWidth));
        } else {
            handleReel();
        }
    };
    
    const getStationDisplay = () => {
        if (status.isLoading) return "TUNING...";
        if (status.isPlaying) return status.title;
        const tunedStation = lastTunedStationRef.current;
        if (tunedStation) return tunedStation.theme;
        return "STATIC";
    }
    
    const renderRadioMode = () => (
        <>
          <div className="w-64 h-10 bg-black/50 border-2 border-amber-900/80 rounded-t-md mb-[-2px] flex items-center justify-center font-crt text-amber-300 text-lg tracking-widest px-2"
               style={{textShadow: '0 0 5px rgba(251, 191, 36, 0.7)'}}>
              <p className="truncate">{getStationDisplay()}</p>
          </div>

          <div ref={dialRef} className="relative w-full h-14 bg-[#111] border-4 border-black/50 rounded-md overflow-hidden shadow-inner-strong">
              <div className="absolute top-0 h-full bg-[#3a3325] transition-transform duration-100 ease-linear"
                   style={{ 
                      width: `${dialWidth}px`, left: 0, transform: `translateX(-${position}px)`,
                      backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px), ${noiseTexture}`,
                      backgroundSize: '20px 20px, 20px 20px, 100px 100px', opacity: 0.8,
                   }} >
                  {stations.map((station, i) => {
                      const stationPos = (i + 0.5) * (dialWidth / stations.length);
                      const spacePerStation = dialWidth / stations.length;
                      return (
                          <div key={i} className="absolute top-1/2 -translate-y-1/2 text-center text-amber-200/60"
                               style={{ left: `${stationPos}px`, transform: 'translate(-50%, -50%)', maxWidth: `${spacePerStation - 10}px` }}>
                              <div className="w-0.5 h-4 bg-amber-200/50 mx-auto" />
                              <span className="text-[10px] font-sans uppercase tracking-wider truncate block">{station.theme}</span>
                          </div>
                      )
                  })}
              </div>

              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-full bg-red-500 shadow-lg" style={{boxShadow: '0 0 5px red'}}/>
              <div className="absolute top-1.5 left-1.5 right-1.5 h-1/2 pointer-events-none rounded-t" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 50%, transparent 100%)'}} />
          </div>
        </>
    );
    
    const renderFishingMode = () => (
         <>
          <div className="w-64 h-10 bg-black/50 border-2 border-cyan-900/80 rounded-t-md mb-[-2px] flex items-center justify-center font-crt text-cyan-300 text-lg tracking-widest px-2"
               style={{textShadow: '0 0 5px rgba(0, 255, 255, 0.7)'}}>
              <p className="truncate">FISHING MODE</p>
          </div>

          <div ref={dialRef} className="relative w-full h-14 bg-[#111] border-4 border-black/50 rounded-md overflow-hidden shadow-inner-strong flex items-center justify-center">
             <FishIcon className={`w-10 h-10 text-cyan-400 transition-transform duration-200 ease-out ${isSpinning ? 'rotate-[360deg]' : ''}`} />
             <p className="absolute bottom-1 text-xs text-cyan-600">DRAG/SCROLL TO REEL</p>
          </div>
        </>
    );

    return (
        <div className="fixed bottom-0 left-0 right-0 z-10 h-24 pointer-events-none flex justify-center">
            <div 
              className="absolute bottom-0 left-0 right-0 h-full bg-gradient-to-t from-black/80 via-black/50 to-transparent" 
              style={{
                backdropFilter: 'blur(2px)',
                maskImage: 'linear-gradient(to top, black 50%, transparent 100%)',
              }}
            />
            <div 
                className="relative w-full max-w-3xl h-full flex flex-col items-center justify-end pointer-events-auto touch-none"
                onPointerDown={handlePointerDown}
                onWheel={handleWheel}
            >
                {mode === 'radio' ? renderRadioMode() : renderFishingMode()}
            </div>
        </div>
    );
}
