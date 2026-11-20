/**
 * Lightweight procedural Web Audio synthesizer for retro 8-bit terminal SFX.
 * Gracefully no-ops in headless or restricted environments.
 */
class TerminalSoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType = 'square',
    gainPeak = 0.045,
    delaySec = 0
  ): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSec + 0.01);
  }

  public playSpawn(): void {
    this.playTone(320, 0.06, 'square', 0.035);
    this.playTone(480, 0.05, 'square', 0.03, 0.04);
  }

  public playWireConnect(): void {
    this.playTone(540, 0.05, 'square', 0.035);
    this.playTone(760, 0.07, 'square', 0.035, 0.04);
  }

  public playWireCut(): void {
    this.playTone(300, 0.05, 'sawtooth', 0.03);
    this.playTone(170, 0.07, 'sawtooth', 0.025, 0.035);
  }

  public playError(): void {
    this.playTone(165, 0.09, 'sawtooth', 0.04);
    this.playTone(140, 0.12, 'sawtooth', 0.035, 0.08);
  }

  public playVictory(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 0.12, 'square', 0.04, idx * 0.075);
    });
  }
}

export const soundEngine = new TerminalSoundEngine();
