// app state and configuration
export const CONFIG = {
  NUM_PADS: 16,
  TOTAL_STEPS: 16,
  LOOKAHEAD_MS: 25,
  SCHEDULE_AHEAD_TIME: 0.1,
  MAX_ACTIVE_VOICES: 32,
  MAX_TOASTS: 4,
  DEFAULT_BPM: 120,
  MIN_BPM: 40,
  MAX_BPM: 240,
  SAMPLE_RATE: 44100
};

export const state = {
  pads: Array.from({length: CONFIG.NUM_PADS}, (_,i)=>({
    index:i, name:`Pad ${i+1}`, audioFile:null, audioBuffer:null, volume:100, pitch:0, pan:0, cutoff:20000, trimStart:0, trimEnd:1
  })),
  selectedPadIndex: null,
  sequence: Array.from({length: CONFIG.NUM_PADS}, ()=>Array(CONFIG.TOTAL_STEPS).fill(false)),
  libraries:{factory:[], user:[]},
  playback:{isPlaying:false, currentStep:0, bpm:CONFIG.DEFAULT_BPM},
  bufferCache:new Map()
};
