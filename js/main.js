// main.js: wires UI -> modules
import { state } from './state.js';
import { audioEngine, audioBufferToWavBlob } from './audioEngine.js';
import { handleZipFile } from './zipHandler.js';
import { toast } from './ui.js';
import { Sequencer } from './sequencer.js';

const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const padsGrid = document.getElementById('padsGrid');
const seqGrid = document.getElementById('seqGrid');
const bpmInput = document.getElementById('bpmInput');
const playSeqBtn = document.getElementById('playSeqBtn');
const exportSeqWavBtn = document.getElementById('exportSeqWavBtn');
const exportPkbankBtn = document.getElementById('exportPkbankBtn');
const editorControls = document.getElementById('editorControls');
const editorTitle = document.getElementById('editorTitle');

let manifest = {pads:[]};

// Resume audio on first user gesture (important for Safari/mobile)
document.addEventListener('pointerdown', ()=>{ audioEngine.ensureRunning(); }, {once:true});

// Basic pad rendering
function renderPads(){
  padsGrid.innerHTML = '';
  state.pads.forEach((pad,i)=>{
    const btn = document.createElement('button');
    btn.className = 'pad-btn'; btn.type='button'; btn.setAttribute('data-idx', i);
    btn.innerHTML = `<div class="pad-index">PAD ${i+1}</div><div class="pad-name">${pad.name}</div>`;
    btn.addEventListener('click', ()=>{ selectPad(i); previewPad(i); });
    btn.addEventListener('keydown', (e)=>{ if (e.key==='Enter' || e.key===' ') { e.preventDefault(); selectPad(i); previewPad(i); } });
    btn.tabIndex = 0;
    padsGrid.appendChild(btn);
  });
}

function renderSequencer(){
  seqGrid.innerHTML = '';
  for (let p=0;p<state.pads.length;p++){
    const label = document.createElement('div'); label.className='seq-row-label'; label.textContent = state.pads[p].name; seqGrid.appendChild(label);
    for (let s=0;s<state.sequence[p].length;s++){
      const step = document.createElement('div'); step.className='seq-step'; step.dataset.pad=p; step.dataset.step=s;
      if (state.sequence[p][s]) step.classList.add('active');
      step.addEventListener('click', ()=>{ state.sequence[p][s]=!state.sequence[p][s]; step.classList.toggle('active', state.sequence[p][s]); });
      seqGrid.appendChild(step);
    }
  }
}

function selectPad(i){ state.selectedPadIndex = i; editorTitle.textContent = `Edit: ${state.pads[i].name}`; editorControls.hidden = false; }

function previewPad(i){ const pad = state.pads[i]; if (!pad.audioBuffer) return; audioEngine.playBuffer(pad.audioBuffer, 0, {volume:pad.volume/100, trimStart:pad.trimStart, trimEnd:pad.trimEnd}); const el = padsGrid.children[i]; if (el){ el.classList.add('playing'); setTimeout(()=>el.classList.remove('playing'), 150); } }

// Drop / file handling
dropZone.addEventListener('click', ()=>fileInput.click());
fileInput.addEventListener('change', async (e)=>{ if (e.target.files.length) await openFile(e.target.files[0]); });

dropZone.addEventListener('dragover', (ev)=>{ ev.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', ()=>dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', async (ev)=>{ ev.preventDefault(); dropZone.classList.remove('dragover'); if (ev.dataTransfer.files.length) await openFile(ev.dataTransfer.files[0]); });

async function openFile(file){ try{
  manifest = await handleZipFile(file);
  // enable controls
  playSeqBtn.disabled = false; exportSeqWavBtn.disabled = false; exportPkbankBtn.disabled = false;
  // map loaded samples into state pads (some manifests have pad mappings)
  // if no mapping, keep samples in library and let user assign manually (future work)
  renderPads(); renderSequencer(); toast.show('Import complete');
 }catch(e){ console.error(e); toast.show('Import failed'); }
}

// Sequencer wiring
const seq = new Sequencer((step)=>{ document.querySelectorAll('.seq-step').forEach(cell=>{ cell.classList.toggle('current-play', parseInt(cell.dataset.step)===step); }); });
playSeqBtn.addEventListener('click', ()=>{ if (state.playback.isPlaying){ seq.stop(); playSeqBtn.textContent='Play Sequence'; }else{ seq.start(); playSeqBtn.textContent='Pause Sequence'; } });

// Export sequence to WAV using OfflineAudioContext
exportSeqWavBtn.addEventListener('click', async ()=>{
  exportSeqWavBtn.disabled = true; exportSeqWavBtn.textContent = 'Rendering WAV...';
  try{
    const bpm = parseFloat(bpmInput.value)||120; const secondsPerStep = 60/bpm/4; const totalDuration = secondsPerStep * state.sequence[0].length + 1.5;
    const sampleRate = 44100;
    const offline = new OfflineAudioContext(2, Math.ceil(sampleRate*totalDuration), sampleRate);
    // Simple offline renderer: schedule bufferSource nodes into offline context
    for (let step=0; step<state.sequence[0].length; step++){
      const t = step * secondsPerStep;
      for (let p=0;p<state.pads.length;p++){
        if (state.sequence[p][step] && state.pads[p].audioBuffer){
          const src = offline.createBufferSource(); src.buffer = state.pads[p].audioBuffer;
          const gain = offline.createGain(); gain.gain.value = state.pads[p].volume/100;
          src.connect(gain); gain.connect(offline.destination);
          const dur = Math.max(0.01, (state.pads[p].trimEnd - state.pads[p].trimStart) * src.buffer.duration);
          const offset = state.pads[p].trimStart * src.buffer.duration;
          src.start(t + 0.001, offset, dur);
        }
      }
    }
    const rendered = await offline.startRendering();
    const blob = audioBufferToWavBlob(rendered);
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='sequence.wav'; a.click();
  }catch(e){ console.error(e); toast.show('WAV export failed'); }
  finally{ exportSeqWavBtn.disabled = false; exportSeqWavBtn.textContent = 'Export Sequence as WAV'; }
});

// Export pkbank (repack manifest into zip)
exportPkbankBtn.addEventListener('click', async ()=>{
  if (typeof JSZip === 'undefined') return toast.show('JSZip missing');
  const zip = new JSZip();
  const outManifest = Object.assign({}, manifest, {sequence: state.sequence, bpmOrig: parseFloat(bpmInput.value)||120});
  zip.file('manifest.json', JSON.stringify(outManifest, null, 2));
  const blob = await zip.generateAsync({type:'blob'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (manifest.name||'my-kit') + '.pkbank'; a.click();
});

// initial render
renderPads(); renderSequencer();
