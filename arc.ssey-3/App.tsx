
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ContentViewerModal } from './components/ContentViewerModal';
import ThreeScene, { type ThreeSceneHandle } from './components/ThreeScene';
import { getTarotSpread, fetchInitialContent, searchRadioStations, type ContentPayload, fetchRandomFishData } from './services/archiveService';
import { generateCuratedSearchQueries, generateGullMessage, type CuratedQueries } from './services/geminiService';
import { AudioBus } from './components/AudioBus';
import type { RadioStatus, ThemedRadioStation, IslandContent, WaybackResult, VideoResult, TarotSpread, FestivalData, FishData, FishingMinigameState } from './types';
import { LoadingIcon, RadioIcon, RetuneIcon, FishIcon } from './components/Icons';
import { TuningDial } from './components/TuningDial';
import { RadioPanel } from './components/RadioPanel';
import { TarotReadingModal } from './components/TarotReadingModal';
import { SystemMessage } from './components/SystemMessage';
import { Intro } from './components/Intro';
import { FeelsCatcher } from './components/FeelsCatcher';
import { Euler } from 'three';
import type { Vector3, Quaternion } from 'three';

// --- NEW INLINE UI COMPONENTS ---

const SustenanceBar: React.FC<{ sustenance: number; onClick: () => void }> = ({ sustenance, onClick }) => (
    <div className="flex items-center gap-2 cursor-pointer" onClick={onClick} role="button" aria-label="Start fishing">
        <FishIcon className="w-5 h-5 text-cyan-200" />
        <div className="w-24 h-3 bg-black/50 border border-cyan-700 rounded-sm p-0.5">
            <div className="h-full bg-cyan-400 rounded-sm transition-all duration-500" style={{ width: `${sustenance * 100}%` }} />
        </div>
    </div>
);

const FishingOverlay: React.FC<{ state: FishingMinigameState; tension: number }> = ({ state, tension }) => {
    let message: string | null = null;
    if (state === 'bite') message = '! ! !';
    if (state === 'reeling' && tension > 0.85) message = 'TOO MUCH TENSION';
    if (state === 'success') message = 'SUCCESS!';
    if (state === 'fail') message = 'LINE SNAPPED';

    return (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-20">
            {message && (
                <div className={`text-4xl font-bold text-yellow-300 animate-pulse transition-opacity duration-300 ${state === 'bite' || state === 'reeling' ? 'opacity-100' : 'opacity-0'}`} style={{ textShadow: '0 0 10px #facc15' }}>
                    {message}
                </div>
            )}
            <div className={`absolute left-1/2 -translate-x-1/2 bottom-32 w-64 h-4 bg-black/50 border-2 border-cyan-700 rounded-sm p-0.5 transition-opacity duration-300 ${state === 'reeling' ? 'opacity-100' : 'opacity-0'}`}>
                <div className="h-full bg-gradient-to-r from-yellow-400 to-red-500 rounded-sm" style={{ width: `${tension * 100}%` }}/>
            </div>
        </div>
    );
};

const FishCaughtCard: React.FC<{ fish: FishData; onClose: () => void }> = ({ fish, onClose }) => (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center font-crt bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
        <div 
            className="w-full max-w-md bg-[#0a1a0f] border-2 border-green-900/80 rounded-lg shadow-lg flex flex-col animate-fadeIn p-6 text-center"
            style={{ boxShadow: '0 0 40px rgba(0,255,0,.2), 0 0 10px rgba(0,0,0,.5)' }}
            onClick={e => e.stopPropagation()}
        >
            <h2 className="text-2xl text-cyan-300 tracking-widest mb-4" style={{textShadow: '0 0 4px rgba(0,255,255,0.5)'}}>
                {`SPECIMEN: ${fish.name.toUpperCase()}`}
            </h2>
            {fish.imageUrl && <img src={fish.imageUrl} alt={fish.name} className="w-full h-48 object-cover rounded-md mb-4 border-2 border-green-900/50" />}
            <p className="text-green-300 text-base leading-relaxed mb-6 text-left max-h-40 overflow-y-auto">
                {fish.summary}
            </p>
            <button 
                onClick={onClose} 
                className="px-6 py-2 text-lg text-black bg-cyan-300 hover:bg-white transition-colors">
                Continue
            </button>
        </div>
    </div>
);

interface RadarTarget { position: Vector3; type: string; }
interface PlayerState { position: Vector3; quaternion: Quaternion; }

const Radar: React.FC<{ targets: RadarTarget[]; playerState: PlayerState | null; }> = ({ targets, playerState }) => {
    if (!playerState) return null;

    const RADAR_SIZE = 120; // in pixels
    const RADAR_RANGE = 4000; // in world units
    const { position: playerPos, quaternion: playerQuat } = playerState;
    const playerAngle = new Euler().setFromQuaternion(playerQuat, 'YXZ').y;

    const getDotColor = (type: string) => {
        switch (type) {
            case 'web': return '#67e8f9'; // cyan
            case 'video': return '#86efac'; // green
            case 'festival': return '#c4b5fd'; // violet
            case 'tarot': return '#f9a8d4'; // pink
            default: return '#9ca3af'; // gray
        }
    };

    return (
        <div
            className="fixed bottom-28 sm:bottom-4 left-4 w-32 h-32 bg-black/40 border-2 border-cyan-400/30 rounded-full flex items-center justify-center"
            style={{ backdropFilter: 'blur(3px)' }}
        >
            <div className="absolute w-full h-px bg-cyan-400/20" />
            <div className="absolute h-full w-px bg-cyan-400/20" />
            <div className="w-1 h-1 bg-cyan-300 rounded-full" /> {/* Player dot */}
            {targets.map((target, i) => {
                const relPos = target.position.clone().sub(playerPos);
                const dist = relPos.length();
                if (dist > RADAR_RANGE) return null;

                const rotatedX = relPos.x * Math.cos(-playerAngle) - relPos.z * Math.sin(-playerAngle);
                const rotatedZ = relPos.x * Math.sin(-playerAngle) + relPos.z * Math.cos(-playerAngle);

                const radarX = (rotatedX / RADAR_RANGE) * (RADAR_SIZE / 2);
                const radarY = (rotatedZ / RADAR_RANGE) * (RADAR_SIZE / 2);
                
                if (Math.sqrt(radarX*radarX + radarY*radarY) > RADAR_SIZE/2) return null;

                return (
                    <div
                        key={i}
                        className="absolute w-1.5 h-1.5 rounded-full"
                        style={{
                            backgroundColor: getDotColor(target.type),
                            transform: `translate(${radarX}px, ${radarY}px)`,
                            opacity: 1 - (dist / RADAR_RANGE),
                        }}
                    />
                );
            })}
        </div>
    );
};

const GullMessage: React.FC<{ message: string | null, position: { x: number, y: number } | null }> = ({ message, position }) => {
    if (!message || !position) return null;
    
    return (
        <div 
            className="fixed top-0 left-0 -translate-x-1/2 -translate-y-[120%] z-50 transition-opacity duration-300"
            style={{ transform: `translate(${position.x}px, ${position.y}px) translate(-50%, -120%)` }}
        >
             <div className="relative bg-[#0a1a0f]/95 border-2 border-cyan-300/80 rounded-lg p-3 max-w-xs text-cyan-200 shadow-lg" style={{textShadow: '0 0 5px rgba(0,255,255,0.5)'}}>
                <p>{message}</p>
                <div className="absolute left-1/2 -translate-x-1/2 bottom-[-10px] w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[10px] border-t-cyan-300/80" />
            </div>
        </div>
    );
};

const loadingMessages = [
    "Contacting archival AI assistant...",
    "Tuning carrier wave to topic signal...",
    "Searching for stable radio signals...",
    "Calibrating deep-sea sensors...",
    "Populating the data-sea...",
    "Finalizing navigation coordinates...",
];

export default function App() {
  const [appState, setAppState] = useState<'init' | 'intro' | 'feels_catcher' | 'loading' | 'playing'>('init');
  
  const [activeContent, setActiveContent] = useState<IslandContent | null>(null);
  const [activeContentPosition, setActiveContentPosition] = useState<Vector3 | null>(null);
  const [radioStatus, setRadioStatus] = useState<RadioStatus>({ isLoading: false, isPlaying: false, title: '' });
  const [proximityText, setProximityText] = useState<string | null>(null);
  
  const queriesRef = useRef<CuratedQueries | null>(null);
  const topicRef = useRef<string>('');
  const [gullMessage, setGullMessage] = useState<string | null>(null);

  const [radioStations, setRadioStations] = useState<ThemedRadioStation[]>([]);
  const [archivedSites, setArchivedSites] = useState<WaybackResult[]>([]);
  const [archivedVideos, setArchivedVideos] = useState<VideoResult[]>([]);
  const [festivalIslands, setFestivalIslands] = useState<FestivalData[]>([]);
  
  const [isRadioPanelOpen, setRadioPanelOpen] = useState(false);
  
  const [tarotSpread, setTarotSpread] = useState<TarotSpread | null>(null);
  const [isTarotModalOpen, setTarotModalOpen] = useState(false);
  
  const [systemMessage, setSystemMessage] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
  const messageKey = useRef(0);

  const [sustenance, setSustenance] = useState(1);
  const [isFishing, setIsFishing] = useState(false);
  const [fishingState, setFishingState] = useState<FishingMinigameState>('idle');
  const [fishingTension, setFishingTension] = useState(0);
  const [caughtFish, setCaughtFish] = useState<FishData | null>(null);
  const sustenanceTimerRef = useRef<number | null>(null);

  const [radarTargets, setRadarTargets] = useState<RadarTarget[]>([]);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [gullScreenPosition, setGullScreenPosition] = useState<{x: number, y: number} | null>(null);

  const threeSceneRef = useRef<ThreeSceneHandle>(null);
  const audioBusRef = useRef<AudioBus | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handlePlayerStateUpdate = (position: Vector3, quaternion: Quaternion) => {
    setPlayerState({ position, quaternion });
  };

  const handleSetSystemMessage = useCallback((baseMessage: string) => {
    messageKey.current += 1;
    setSystemMessage(baseMessage);
  }, []);
  
  const handleInit = async () => {
    if (!audioBusRef.current) {
        audioBusRef.current = new AudioBus();
        try {
            await audioBusRef.current.init();
            audioBusRef.current.playAmbient('https://archive.org/download/seaside-ambience/Seaside%20Ambience.mp3');
            audioBusRef.current.loadLoopingSounds();
        } catch(e) {
            console.error("Audio bus failed to initialize:", e);
            handleSetSystemMessage("Audio system failed. Please click again.");
            audioBusRef.current = null; // Reset on failure to allow retry
            return;
        }
    }
    setAppState('intro');
  };

  const handleTopicSubmitted = (topic: string) => {
    topicRef.current = topic;
    setAppState('feels_catcher');
  };
  
  const handleFeelsSubmitted = (feels: string[]) => {
    setAppState('loading');
    
    // Start the loading process
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const loadInitialContent = async () => {
        let loadingMsgIndex = 0;
        const msgInterval = setInterval(() => {
            loadingMsgIndex = (loadingMsgIndex + 1) % loadingMessages.length;
            setLoadingMessage(loadingMessages[loadingMsgIndex]);
        }, 2000);

        try {
            const queries = await generateCuratedSearchQueries(topicRef.current, feels);
            queriesRef.current = queries;
            
            const initialContent = await fetchInitialContent(queries, controller.signal);
            
            if (controller.signal.aborted) return;
            
            setRadioStations(initialContent.radioStations);
            setArchivedSites(initialContent.archivedSites);
            setArchivedVideos(initialContent.archivedVideos);
            setFestivalIslands(initialContent.festivalIslands);
            
            if (initialContent.soundscape) {
                audioBusRef.current?.playAmbient(initialContent.soundscape.streamUrl);
            }
            
            setAppState('playing');
        } catch (error) {
            if ((error as Error).name !== 'AbortError') {
                console.error("Failed to load initial content:", error);
                handleSetSystemMessage("Failed to acquire signals. Please try a new search.");
                // Reset to intro to allow user to try again
                setAppState('intro');
            }
        } finally {
            clearInterval(msgInterval);
        }
    };

    loadInitialContent();
  };
  
  useEffect(() => {
    const audioBus = audioBusRef.current;
    return () => {
      audioBus?.dispose();
      abortControllerRef.current?.abort();
    };
  }, []);
  
  // New "Retune" logic
  const handleRetune = async () => {
    if (!queriesRef.current?.radio) return;
    
    handleSetSystemMessage("Searching for more radio signals...");
    const controller = new AbortController();
    const newStations = await searchRadioStations(queriesRef.current.radio, controller.signal, 10, radioStations.length);
    if (newStations.length > 0) {
        setRadioStations(prev => [...prev, ...newStations]);
        handleSetSystemMessage(`Found ${newStations.length} new signals.`);
    } else {
        handleSetSystemMessage("No new signals found on this band.");
    }
  };


  const resetSustenanceTimer = useCallback(() => {
    if (sustenanceTimerRef.current) clearInterval(sustenanceTimerRef.current);
    const DURATION_MS = 45 * 60 * 1000;
    sustenanceTimerRef.current = window.setInterval(() => {
        setSustenance(s => {
            const newSustenance = s - (1000 / DURATION_MS);
            if (newSustenance <= 0) {
                handleStartFishing();
                return 0;
            }
            return newSustenance;
        });
    }, 1000);
  }, []);

  useEffect(() => {
    if (appState === 'playing' && !isFishing) {
        resetSustenanceTimer();
    } else if (sustenanceTimerRef.current) {
        clearInterval(sustenanceTimerRef.current);
    }
    return () => {
        if (sustenanceTimerRef.current) clearInterval(sustenanceTimerRef.current);
    };
  }, [appState, isFishing, resetSustenanceTimer]);

  const handleStartFishing = useCallback(() => {
      if (isFishing || appState !== 'playing') return;
      setIsFishing(true);
      handlePlayStation(null); // Pause radio
      threeSceneRef.current?.startFishing();
      if (sustenanceTimerRef.current) clearInterval(sustenanceTimerRef.current);
  }, [isFishing, appState]);
  
  const handleFishCaught = useCallback(async () => {
    const fish = await fetchRandomFishData();
    if(fish) {
        setCaughtFish(fish);
        setSustenance(1);
    }
  }, []);

  const handleFishingEnd = useCallback(() => {
    setIsFishing(false);
  }, []);

  const handleFishingStateChange = (state: FishingMinigameState, tension: number) => {
    setFishingState(state);
    setFishingTension(tension);
  }

  useEffect(() => {
    const shouldBePaused = !!activeContent || isRadioPanelOpen || isTarotModalOpen || isFishing;
    if (shouldBePaused) {
      threeSceneRef.current?.pause();
    } else {
      threeSceneRef.current?.resume();
    }
  }, [activeContent, isRadioPanelOpen, isTarotModalOpen, isFishing]);
  
  const handlePlayStation = (station: ThemedRadioStation | null) => {
    const audioBus = audioBusRef.current;
    if (!audioBus || isFishing) return;
    
    if (station) {
        audioBus.playRadioStream(station.streamUrl, {
            onLoadStart: () => setRadioStatus({ isLoading: true, isPlaying: false, title: station.theme }),
            onPlay: () => setRadioStatus({ isLoading: false, isPlaying: true, title: station.theme }),
            onPause: () => setRadioStatus(prev => ({ ...prev, isPlaying: false })),
            onError: () => {
                console.error("Failed to load or play stream audio for:", station.streamUrl);
                setRadioStatus({ isLoading: false, isPlaying: false, title: `Stream Error` });
            }
        });
    } else {
        audioBus.stopRadioStream();
        setRadioStatus({ isLoading: false, isPlaying: false, title: '' });
    }
  };
  
  const handleIslandCollision = (content: IslandContent, position: Vector3) => {
      setActiveContent(content);
      setActiveContentPosition(position);
      handlePlayStation(null);
  };
  
  const handleCloseViewer = () => {
      if (activeContentPosition) {
          threeSceneRef.current?.repelFrom(activeContentPosition);
      }
      setActiveContent(null);
      setActiveContentPosition(null);
  };

  const handleStartTarotReading = async () => {
    handlePlayStation(null);
    setTarotModalOpen(true);
    setTarotSpread(null); // Clear previous spread

    const spread = await getTarotSpread(topicRef.current);
    setTarotSpread(spread);
  };

  const handleFestivalProximity = (seed: number | null) => {
    // Festival music removed with audio system refactor
  };
  
  const handleGullRequest = useCallback(async () => {
    if (!topicRef.current) return;
    
    const stationThemes = radioStations.map(s => s.theme);
    const message = await generateGullMessage(topicRef.current, stationThemes);
    
    setGullMessage(message);
  }, [radioStations]);

  if (appState === 'init') {
    return (
        <div className="fixed inset-0 bg-black text-cyan-200 font-crt flex flex-col items-center justify-center p-8 z-[300] cursor-pointer" onClick={handleInit}>
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_50%,black)]" />
            <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(0deg, black 0, black 1px, transparent 1px, transparent 2px)'}}/>
            <div className="text-center z-10 animate-pulse">
                <h1 className="text-7xl font-bold text-cyan-300 mb-4 tracking-[0.2em]">arc.ssey</h1>
                <p className="text-xl">Click to Begin</p>
            </div>
        </div>
    );
  }

  if (appState === 'intro') {
    return <Intro onTopicSubmitted={handleTopicSubmitted} />;
  }
  
  if (appState === 'feels_catcher') {
      return <FeelsCatcher onFeelsSubmitted={handleFeelsSubmitted} />;
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black' }}>
      {appState === 'loading' && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center text-cyan-300 font-crt animate-fadeIn">
            <LoadingIcon className="w-12 h-12 animate-spin mb-4" />
            <p className="text-2xl tracking-widest">{loadingMessage}</p>
        </div>
      )}

      {(appState === 'playing') && (
        <ThreeScene
          ref={threeSceneRef}
          onIslandCollision={handleIslandCollision}
          onProximityChange={setProximityText}
          onTarotReadingStart={handleStartTarotReading}
          onSystemMessage={handleSetSystemMessage}
          onFestivalProximity={handleFestivalProximity}
          onGullRequest={handleGullRequest}
          onFishCaught={handleFishCaught}
          onFishingEnd={handleFishingEnd}
          onFishingStateChange={handleFishingStateChange}
          gullMessage={gullMessage}
          onClearGullMessage={() => setGullMessage(null)}
          onRadarUpdate={setRadarTargets}
          onPlayerStateUpdate={handlePlayerStateUpdate}
          onGullUpdate={setGullScreenPosition}
          sites={archivedSites}
          videos={archivedVideos}
          festivals={festivalIslands}
          isFishing={isFishing}
          audioBus={audioBusRef.current}
          autoStart
        />
      )}
      
      <div className={`fixed inset-0 pointer-events-none text-cyan-200 font-crt z-10 p-4 transition-opacity duration-1000 ${appState === 'playing' ? 'opacity-100' : 'opacity-0'}`}>
        <header className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="flex flex-col pointer-events-auto">
                <h1 className="text-2xl font-bold text-cyan-300 tracking-widest uppercase">arc.ssey</h1>
                <p className="text-sm opacity-80">Archival System Version 2.4</p>
                <div className="mt-2 text-base font-bold text-pink-300">
                    <SustenanceBar sustenance={sustenance} onClick={handleStartFishing} />
                </div>
            </div>
            <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
                <button 
                  onClick={handleRetune}
                  className="p-2 bg-black/30 border-2 border-cyan-400/50 rounded-sm hover:bg-cyan-400/30 transition-colors pointer-events-auto"
                  aria-label="Retune - Find more radio stations"
                >
                  <RetuneIcon className="w-6 h-6" />
                </button>
                 <button 
                    onClick={() => setRadioPanelOpen(true)}
                    className="p-2 bg-black/30 border-2 border-cyan-400/50 rounded-sm hover:bg-cyan-400/30 transition-colors pointer-events-auto"
                    aria-label="Open radio station list"
                >
                    <RadioIcon className="w-6 h-6" />
                </button>
            </div>
        </header>

        <div className="absolute top-1/4 left-4 text-sm max-w-xs">
            <p className="text-pink-300 transition-opacity duration-500" style={{ textShadow: '0 0 5px #f9a8d4' }}>{proximityText ?? ''}</p>
        </div>
        
        <Radar targets={radarTargets} playerState={playerState} />
      </div>

      <GullMessage message={gullMessage} position={gullScreenPosition} />
      
      <div className={`transition-opacity duration-1000 ${appState === 'playing' ? 'opacity-100' : 'opacity-0'}`}>
        <TuningDial 
          stations={radioStations} 
          onTune={handlePlayStation}
          status={radioStatus}
          mode={isFishing ? 'fishing' : 'radio'}
          onReelSpin={() => threeSceneRef.current?.triggerReelAction()}
        />
      </div>

      <ContentViewerModal 
        content={activeContent} 
        onClose={handleCloseViewer} 
      />
      
      <RadioPanel
        isOpen={isRadioPanelOpen}
        onClose={() => setRadioPanelOpen(false)}
        stations={radioStations}
        status={radioStatus}
        onTune={handlePlayStation}
      />
      
      <TarotReadingModal
        isOpen={isTarotModalOpen}
        onClose={() => setTarotModalOpen(false)}
        spread={tarotSpread}
      />
      
      <SystemMessage message={systemMessage} key={messageKey.current} />

      {isFishing && <FishingOverlay state={fishingState} tension={fishingTension} />}
      {caughtFish && <FishCaughtCard fish={caughtFish} onClose={() => setCaughtFish(null)} />}
    </div>
  );
}
