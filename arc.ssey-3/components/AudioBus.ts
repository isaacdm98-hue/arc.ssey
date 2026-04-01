
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
  private ambientVolume = 0.4; // Default ambient volume - gentle, not overpowering

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

    // Unlock each audio element individually — don't let one failure block all others.
    // Browser autoplay policies require a user gesture to unlock audio.
    const players = [this.ambientAudio, this.radioAudio, this.engineAudio, this.proximityAudio, ...this.sfxPool];

    let unlocked = 0;
    for (const p of players) {
        try {
            p.src = silentAudioSrc;
            await p.play();
            p.pause();
            unlocked++;
        } catch {
            // Individual element failed — continue with the rest
        }
    }

    // Consider initialized if we unlocked at least the core elements
    this.isInitialized = unlocked >= 2;

    // Clear sources so they're ready for real audio
    this.radioAudio.src = '';
    this.sfxPool.forEach(sfx => { sfx.src = ''; });

    if (!this.isInitialized) {
        console.warn(`AudioBus: only ${unlocked}/${players.length} elements unlocked. Audio may be limited.`);
    }
  }

  public playAmbient(url: string) {
    if (!this.isInitialized) return;
    this.ambientAudio.src = url;
    this.ambientAudio.volume = this.ambientVolume;
    this.ambientAudio.play().catch(e => console.warn("Ambient audio playback failed:", e));
  }

  public loadLoopingSounds() {
      if (!this.isInitialized) return;

      // Engine hum — very subtle low mechanical sound
      this.engineAudio.src = 'https://archive.org/download/scifi-engine-heavy-loop/scifi-engine-heavy-loop.mp3';
      this.engineAudio.volume = 0;
      this.engineAudio.play().catch(() => {
          // Fallback: engine audio is optional atmosphere
          console.warn("Engine audio unavailable — continuing without it");
      });

      // Proximity hum — subtle sonar-like sound near islands
      this.proximityAudio.src = 'https://archive.org/download/MysteriousHum/MysteriousHum.mp3';
      this.proximityAudio.volume = 0;
      this.proximityAudio.play().catch(() => {
          console.warn("Proximity audio unavailable — continuing without it");
      });
  }

  public setEngineLevel(level: number) {
    if (!this.isInitialized || !this.engineAudio.src) return;
    const clampedLevel = Math.max(0, Math.min(1, level));
    // Very subtle — never louder than 0.25
    this.engineAudio.volume = clampedLevel * 0.25;
    this.engineAudio.playbackRate = 0.8 + clampedLevel * 0.4;
  }

  public setProximityLevel(level: number, type: 'default' | 'festival') {
    if (!this.isInitialized || !this.proximityAudio.src) return;
    const clampedLevel = Math.max(0, Math.min(1, level));
    const baseVolume = type === 'festival' ? 0.5 : 0.3;
    this.proximityAudio.volume = clampedLevel * baseVolume;
  }

  public playSfx(url: string) {
    if (!this.isInitialized) return;
    const sfx = this.sfxPool[this.sfxPoolIndex];
    this.sfxPoolIndex = (this.sfxPoolIndex + 1) % this.sfxPoolSize;
    sfx.volume = 0.3;
    sfx.src = url;
    sfx.play().catch(() => { /* SFX are optional */ });
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
    this.radioAudio.onplaying = () => {
        callbacks.onPlay();
        // Duck ambient when radio plays — gentle crossfade
        this.ambientAudio.volume = this.ambientVolume * 0.3;
    };
    this.radioAudio.onpause = callbacks.onPause;
    this.radioAudio.onerror = () => {
        const mediaError = this.radioAudio.error;
        if (mediaError && mediaError.code === mediaError.MEDIA_ERR_ABORTED) return;
        callbacks.onError();
    };

    this.radioAudio.src = url;
    this.radioAudio.volume = 0.6;

    this.radioAudio.play().catch(e => {
        if ((e as DOMException).name !== 'AbortError') {
            console.warn("Radio stream playback failed:", e);
            callbacks.onError();
        }
    });
  }

  public stopRadioStream() {
    if (!this.isInitialized) return;
    this.radioAudio.pause();
    this.radioAudio.src = '';
    // Restore ambient volume
    this.ambientAudio.volume = this.ambientVolume;
  }

  public dispose() {
    [this.ambientAudio, this.radioAudio, this.engineAudio, this.proximityAudio].forEach(a => {
        a.pause();
        a.src = '';
    });
    this.sfxPool.forEach(sfx => { sfx.pause(); sfx.src = ''; });
  }
}
