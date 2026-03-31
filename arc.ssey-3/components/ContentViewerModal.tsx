

import React, { useState, useEffect, useRef } from 'react';
import type { IslandContent } from '../types';
import { LoadingIcon } from './Icons';

export const ContentViewerModal: React.FC<{
  content: IslandContent | null;
  onClose: () => void;
}> = ({ content, onClose }) => {
  const [videoIndex, setVideoIndex] = useState(0);
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  useEffect(() => {
    if (content) {
      setVideoIndex(0);
      setIsIframeLoading(true);
      setLoadingError(null);
    }
  }, [content]);
  
  // Reset loading state when video index changes for festivals
  useEffect(() => {
    if (content?.type === 'festival') {
        setIsIframeLoading(true);
        setLoadingError(null);
    }
  }, [videoIndex, content]);

  if (!content) return null;

  const isFestival = content.type === 'festival';
  const festivalVideos = isFestival ? content.data.videos : [];

  const getTitle = () => {
    switch (content.type) {
      case 'web': return 'WEB ARCHIVE';
      case 'video': return 'VIDEO ARCHIVE';
      case 'festival': return `${content.data.name.toUpperCase()} ARCHIVE`;
      case 'tarot': return 'MYSTICAL SIGNAL';
      default: return 'ARCHIVE RECOVERY';
    }
  }

  const getUrl = () => {
    let baseUrl = '';
    if (content.type === 'web') baseUrl = content.data.url;
    if (content.type === 'video') baseUrl = `https://archive.org/embed/${content.data.identifier}`;
    if (isFestival && festivalVideos.length > 0) {
      baseUrl = `https://archive.org/embed/${festivalVideos[videoIndex].identifier}`;
    }

    // Attempt to autoplay archive.org embeds
    if (baseUrl.includes('archive.org/embed')) {
      return `${baseUrl}?autoplay=1`;
    }
    return baseUrl;
  }

  const getLinkText = () => {
    switch (content.type) {
      case 'web':
        return content.data.originalUrl;
      case 'video':
        return content.data.title || content.data.identifier;
      case 'festival':
        return `${content.data.name} ${content.data.year}`;
      case 'tarot':
        return content.data.title;
      default:
        return 'Source';
    }
  }
  
  const getExternalLink = () => {
    if (content.type === 'web') return `http://${content.data.originalUrl}`;
    if (content.type === 'video') return `https://archive.org/details/${content.data.identifier}`;
    if (isFestival && festivalVideos.length > 0) {
      return `https://archive.org/details/${festivalVideos[videoIndex].identifier}`;
    }
    return '#';
  }

  const handleIframeError = () => {
      setIsIframeLoading(false);
      setLoadingError("This archive signal appears to be corrupted or offline.");
  };

  // FIX: Add a type guard to ensure `content.type` is 'festival' before accessing festival-specific data properties.
  const renderFestivalContent = () => {
    if (content.type !== 'festival') return null;
    return (
      <div className="flex flex-col md:flex-row flex-grow min-h-0">
          <div className="md:w-1/3 flex-shrink-0 bg-black/30 p-2 md:border-r border-b md:border-b-0 border-green-900/50 flex flex-col">
              <h3 className="text-lg font-bold text-green-300 truncate">{content.data.name}</h3>
              <p className="text-sm text-green-500 mb-2">{content.data.year}</p>
              <ul className="flex-grow overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {festivalVideos.map((video, index) => (
                      <li key={video.identifier}>
                          <button 
                              onClick={() => setVideoIndex(index)}
                              className={`w-full text-left p-2 text-sm rounded transition-colors ${
                                  index === videoIndex 
                                  ? 'bg-green-800/90 text-white' 
                                  : 'text-green-400 hover:bg-green-900/60'
                              }`}
                          >
                              {video.title}
                          </button>
                      </li>
                  ))}
              </ul>
          </div>
          <div className="relative flex-grow bg-black/50 overflow-hidden flex items-center justify-center">
               {isIframeLoading && !loadingError && (
                  <div className="flex flex-col items-center text-green-400">
                      <LoadingIcon className="w-8 h-8 animate-spin mb-2" />
                      <p>Accessing Recording...</p>
                  </div>
                )}
                {loadingError && <p className="text-rose-400 p-4 text-center">{loadingError}</p>}
               <iframe 
                  src={getUrl()}
                  key={festivalVideos[videoIndex].identifier}
                  title={festivalVideos[videoIndex].title}
                  className={`w-full h-full border-0 absolute inset-0 transition-opacity duration-300 ${isIframeLoading || loadingError ? 'opacity-0' : 'opacity-100'}`}
                  sandbox="allow-scripts allow-same-origin"
                  allow="autoplay; encrypted-media; fullscreen"
                  onLoad={() => setIsIframeLoading(false)}
                  onError={handleIframeError}
                />
          </div>
      </div>
    );
  };

  const renderStandardContent = () => (
      <main className="p-2 bg-[#0a1a0f] flex-grow">
            <div className="relative w-full h-full bg-black/50 rounded border border-green-900/50 overflow-hidden flex items-center justify-center">
              {isIframeLoading && !loadingError && (
                <div className="flex flex-col items-center text-green-400">
                    <LoadingIcon className="w-8 h-8 animate-spin mb-2" />
                    <p>Accessing Archive...</p>
                </div>
              )}
              {loadingError && <p className="text-rose-400 p-4 text-center">{loadingError}</p>}
              <iframe 
                src={getUrl()}
                title={getTitle()}
                className={`w-full h-full border-0 absolute inset-0 transition-opacity duration-300 ${isIframeLoading || loadingError ? 'opacity-0' : 'opacity-100'}`}
                sandbox="allow-scripts allow-same-origin"
                allow="autoplay; encrypted-media; fullscreen"
                onLoad={() => setIsIframeLoading(false)}
                onError={handleIframeError}
              />
            </div>
      </main>
  );


  return (
    <div className="pointer-events-none fixed inset-0 z-[200] font-crt flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" onClick={onClose}/>
      <div className="pointer-events-auto w-[min(90vw,1200px)] h-[min(90vh,900px)] rounded-lg overflow-hidden shadow-2xl animate-fadeIn flex flex-col"
           style={{ boxShadow: '0 0 40px rgba(0,255,0,.2), 0 0 10px rgba(0,0,0,.5)' }}>
        <div className="relative bg-[#051008] border-2 border-green-900/80 flex flex-col flex-grow">
          <header className="flex items-center justify-between gap-3 px-3 py-1.5 border-b border-green-900/80 flex-shrink-0">
            <div className="flex gap-1.5">
                <button className="w-3.5 h-3.5 rounded-full bg-rose-500 hover:bg-rose-400" onClick={onClose} aria-label="Close"/>
            </div>
            <div className="text-green-400/80 text-sm tracking-[.15em] truncate" style={{textShadow: '0 0 2px rgba(0,255,0,0.5)'}}>
                {getTitle()}
            </div>
            <a href={getExternalLink()} target="_blank" rel="noreferrer" className="text-xs text-green-500 hover:text-green-300 truncate max-w-xs">
                {getLinkText()}
            </a>
          </header>

          {isFestival ? renderFestivalContent() : renderStandardContent()}

        </div>
      </div>
    </div>
  );
};