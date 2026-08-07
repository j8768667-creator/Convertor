// audioEngine: provides AudioContext helpers and decoding
import { state } from './state.js';
import { CONFIG } from './state.js';

class AudioEngine {
  constructor(){
    this.ctx = new (window.AudioContext||window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
  }

  async ensureRunning(){
    if (this.ctx.state === 'suspended'){
      try{ await this.ctx.resume(); }catch(e){}
    }
  }

  async decodeAudioData(arrayBuffer, cacheKey=null){
    if (cacheKey && state.bufferCache.has(cacheKey)) return state.bufferCache.get(cacheKey);
    const decoded = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
    if (cacheKey) state.bufferCache.set(cacheKey, decoded);
    return decoded;
  }

  playBuffer(buffer, when=0, opts={}){
    if (!buffer) return null;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime((opts.volume??1), this.ctx.currentTime);
    source.connect(gain); gain.connect(this.masterGain);
    const duration = Math.max(0.01, buffer.duration * ((opts.trimEnd??1)-(opts.trimStart??0)));
    const offset = (opts.trimStart||0) * buffer.duration;
    try{ source.start(when || this.ctx.currentTime, offset, duration); }catch(e){ }
    source.onended = () => {
      try{ source.disconnect(); gain.disconnect(); }catch(e){}
    };
    return source;
  }
}

export const audioEngine = new AudioEngine();

// utility: convert AudioBuffer to 16-bit PCM WAV Blob
export function audioBufferToWavBlob(buffer){
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const bufferLen = 44 + dataSize;
  const ab = new ArrayBuffer(bufferLen);
  const view = new DataView(ab);
  let offset = 0;
  function writeString(s){
    for (let i=0;i<s.length;i++) view.setUint8(offset++, s.charCodeAt(i));
  }
  writeString('RIFF');
  view.setUint32(offset, 36 + dataSize, true); offset+=4;
  writeString('WAVE');
  writeString('fmt ');
  view.setUint32(offset,16,true); offset+=4;
  view.setUint16(offset,1,true); offset+=2;
  view.setUint16(offset,numChannels,true); offset+=2;
  view.setUint32(offset,sampleRate,true); offset+=4;
  view.setUint32(offset,sampleRate*blockAlign,true); offset+=4;
  view.setUint16(offset,blockAlign,true); offset+=2;
  view.setUint16(offset,bytesPerSample*8,true); offset+=2;
  writeString('data');
  view.setUint32(offset,dataSize,true); offset+=4;

  // interleave
  const channelData = [];
  for (let ch=0; ch<numChannels; ch++) channelData.push(buffer.getChannelData(ch));
  for (let i=0;i<buffer.length;i++){
    for (let ch=0; ch<numChannels; ch++){
      let sample = Math.max(-1, Math.min(1, channelData[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  return new Blob([ab], {type:'audio/wav'});
}
