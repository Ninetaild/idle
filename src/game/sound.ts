/**
 * Lightweight procedural retro Web Audio synthesizer.
 * Produces clean pixel-RPG sound cues without external audio assets.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  public setMuted(muted: boolean) {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = 'triangle',
    gainPeak = 0.08
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    const pitchJitter = 0.95 + Math.random() * 0.1;
    osc.frequency.setValueAtTime(freq * pitchJitter, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq * pitchJitter), now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playSwing() {
    this.playTone(520, 240, 0.09, 'triangle', 0.06);
  }

  public playHit() {
    this.playTone(220, 95, 0.11, 'square', 0.07);
  }

  public playHurt() {
    this.playTone(160, 70, 0.16, 'sawtooth', 0.08);
  }

  public playPickup() {
    this.playTone(480, 760, 0.09, 'sine', 0.07);
  }

  public playElixir() {
    this.playTone(523, 784, 0.12, 'triangle', 0.08);
    setTimeout(() => this.playTone(784, 1046, 0.18, 'triangle', 0.08), 90);
  }

  public playCoin() {
    this.playTone(880, 1320, 0.1, 'sine', 0.06);
  }

  public playAdReward() {
    this.playTone(523, 659, 0.11, 'triangle', 0.07);
    setTimeout(() => this.playTone(659, 987, 0.18, 'triangle', 0.08), 100);
  }
}

export const soundEngine = new SoundEngine();
