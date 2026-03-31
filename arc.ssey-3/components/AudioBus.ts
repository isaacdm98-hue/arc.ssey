
const silentAudioSrc = 'data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zRDAAAAOkAAADmlAJkgAACgAABRgAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zRDEAAPgAAApGgAAAAAABNWgUIAnhCAGgACIAAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';

export class AudioBus {
  private ambientAudio: HTMLAudioElement;
  private radioAudio: HTMLAudioElement;
  private engineAudio: HTMLAudioElement;
  private proximityAudio: HTMLAudioElement;
  
  private sfxPool: HTMLAudioElement[] = [];
  private sfxPoolIndex = 0;
  private readonly sfxPoolSize = 5;

  private isInitialized = false;

  constructor() {
    this.ambientAudio = new Audio();
    this.ambientAudio.crossOrigin = "anonymous";
    this.ambientAudio.loop = true;
    
    this.radioAudio = new Audio();
    this.radioAudio.crossOrigin = "anonymous";

    this.engineAudio = new Audio();
    this.engineAudio.crossOrigin = "anonymous";
    this.engineAudio.loop = true;

    this.proximityAudio = new Audio();
    this.proximityAudio.crossOrigin = "anonymous";
    this.proximityAudio.loop = true;

    for (let i = 0; i < this.sfxPoolSize; i++) {
        const sfx = new Audio();
        sfx.crossOrigin = "anonymous";
        this.sfxPool.push(sfx);
    }
  }

  public async init() {
    if (this.isInitialized) return;

    const players = [this.ambientAudio, this.radioAudio, this.engineAudio, this.proximityAudio, ...this.sfxPool];
    players.forEach(p => { p.src = silentAudioSrc; });

    try {
      // This "unlock" sequence must be called from within a user gesture.
      // It plays and immediately pauses each audio element to get it ready for programmatic playback.
      await Promise.all(players.map(p => p.play()));
      players.forEach(p => p.pause());

      this.isInitialized = true;
      
      // Clear the silent src so they are ready for real sources
      this.radioAudio.src = '';
      this.sfxPool.forEach(sfx => { sfx.src = '' });

    } catch (error) {
        console.error("AudioBus initialization failed. User may need to interact with the page again.", error);
        this.isInitialized = false;
        throw error;
    }
  }

  public playAmbient(url: string) {
    if (!this.isInitialized) return;
    this.ambientAudio.src = url;
    this.ambientAudio.volume = 1.0;
    this.ambientAudio.play().catch(e => console.error("Ambient audio playback failed:", e));
  }
  
  public loadLoopingSounds() {
      if (!this.isInitialized) return;
      this.engineAudio.src = 'https://archive.org/download/scifi-engine-heavy-loop/scifi-engine-heavy-loop.mp3';
      this.proximityAudio.src = 'https://archive.org/download/MysteriousHum/MysteriousHum.mp3';
      this.engineAudio.volume = 0;
      this.proximityAudio.volume = 0;
      this.engineAudio.play().catch(e => console.error("Engine audio loop failed to start:", e));
      this.proximityAudio.play().catch(e => console.error("Proximity audio loop failed to start:", e));
  }

  public setEngineLevel(level: number) {
    if (!this.isInitialized || !this.engineAudio) return;
    const clampedLevel = Math.max(0, Math.min(1, level));
    this.engineAudio.volume = clampedLevel * 0.7;
    this.engineAudio.playbackRate = 0.8 + clampedLevel * 0.6;
  }

  public setProximityLevel(level: number, type: 'default' | 'festival') {
    if (!this.isInitialized || !this.proximityAudio) return;
    const clampedLevel = Math.max(0, Math.min(1, level));
    const baseVolume = type === 'festival' ? 0.9 : 0.6;
    this.proximityAudio.volume = clampedLevel * baseVolume;
  }

  public playSfx(url: string) {
    if (!this.isInitialized) return;
    const sfx = this.sfxPool[this.sfxPoolIndex];
    this.sfxPoolIndex = (this.sfxPoolIndex + 1) % this.sfxPoolSize;

    sfx.src = url;
    sfx.play().catch(e => console.error(`SFX playback failed for ${url}:`, e));
  }
  
  public playRadioStream(
    url: string, 
    callbacks: {
        onLoadStart: () => void;
        onPlay: () => void;
        onPause: () => void;
        onError: () => void;
    }
  ) {
    if (!this.isInitialized) return;

    this.radioAudio.onloadstart = null;
    this.radioAudio.onplaying = null;
    this.radioAudio.onpause = null;
    this.radioAudio.onerror = null;

    this.radioAudio.onloadstart = callbacks.onLoadStart;
    this.radioAudio.onplaying = callbacks.onPlay;
    this.radioAudio.onpause = callbacks.onPause;
    this.radioAudio.onerror = (e) => {
        const mediaError = this.radioAudio.error;
        if (mediaError && mediaError.code === mediaError.MEDIA_ERR_ABORTED) {
            return;
        }
        callbacks.onError();
    };
    
    this.radioAudio.src = url;
    
    this.radioAudio.play().catch(e => {
        if ((e as DOMException).name !== 'AbortError') {
            console.error("Radio stream playback failed:", e);
            callbacks.onError();
        }
    });
    
    this.ambientAudio.volume = 0.2;
  }

  public stopRadioStream() {
    if (!this.isInitialized) return;

    this.radioAudio.pause();
    this.radioAudio.src = '';
    
    this.ambientAudio.volume = 1.0;
  }

  public dispose() {
    this.ambientAudio.pause();
    this.ambientAudio.src = '';
    this.radioAudio.pause();
    this.radioAudio.src = '';
    this.engineAudio.pause();
    this.engineAudio.src = '';
    this.proximityAudio.pause();
    this.proximityAudio.src = '';
  }
}
