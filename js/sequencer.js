// Sequencer: schedules notes using AudioContext timing
import { state } from './state.js';
import { audioEngine } from './audioEngine.js';
import { CONFIG } from './state.js';

export class Sequencer{
  constructor(onStep){ this.onStep = onStep; this.timerID = null; }
  start(){ if (state.playback.isPlaying) return; state.playback.isPlaying = true; state.playback.currentStep = 0; this.nextNoteTime = audioEngine.ctx.currentTime; this.scheduler(); }
  stop(){ state.playback.isPlaying = false; clearTimeout(this.timerID); }
  toggle(){ state.playback.isPlaying ? this.stop() : this.start(); }
  scheduler(){
    while (this.nextNoteTime < audioEngine.ctx.currentTime + CONFIG.SCHEDULE_AHEAD_TIME){
      this.scheduleNote(state.playback.currentStep, this.nextNoteTime);
      this.nextNote();
    }
    if (state.playback.isPlaying) this.timerID = setTimeout(()=>this.scheduler(), CONFIG.LOOKAHEAD_MS);
  }
  nextNote(){ const secondsPerBeat = 60.0 / state.playback.bpm; this.nextNoteTime += 0.25 * secondsPerBeat; state.playback.currentStep = (state.playback.currentStep + 1) % CONFIG.TOTAL_STEPS; }
  scheduleNote(stepIndex, time){
    for (let p=0;p<state.pads.length;p++){
      if (state.sequence[p][stepIndex] && state.pads[p].audioBuffer){
        audioEngine.playBuffer(state.pads[p].audioBuffer, time, {volume:state.pads[p].volume/100, trimStart:state.pads[p].trimStart, trimEnd:state.pads[p].trimEnd});
      }
    }
    const delay = Math.max(0,(time - audioEngine.ctx.currentTime)*1000);
    setTimeout(()=>{ if (this.onStep) this.onStep(stepIndex); }, delay);
  }
}
