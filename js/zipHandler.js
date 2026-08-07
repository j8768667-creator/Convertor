// zipHandler: load .zip/.pkbank archives and decode wavs into buffers
import { audioEngine } from './audioEngine.js';
import { state } from './state.js';
import { toast } from './ui.js';

export async function handleZipFile(file){
  if (typeof JSZip === 'undefined'){
    toast.show('JSZip not loaded', 'error');
    throw new Error('JSZip missing');
  }
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file('manifest.json');
  let manifest = {pads:[]};
  if (manifestFile){
    try{ manifest = JSON.parse(await manifestFile.async('string')); }catch(e){ console.warn('manifest parse',e); }
  }

  const audioFiles = Object.keys(zip.files).filter(n=>/\.(wav|mp3|ogg|m4a|flac)$/i.test(n));
  for (const path of audioFiles){
    try{
      const ab = await zip.file(path).async('arraybuffer');
      const buf = await audioEngine.decodeAudioData(ab, file.name + '::' + path);
      const nameOnly = path.split('/').pop().replace(/\.[^/.]+$/,'');
      const sample = {id:`z_${Date.now()}_${Math.random()}`, name:nameOnly, filePath:path, buffer:buf};
      state.libraries.factory.push(sample);
    }catch(e){ console.warn('decode',path,e); }
  }

  // If manifest describes pads with audioFile keys, assign to state.pads
  (manifest.pads||[]).forEach(p=>{
    if (typeof p.index === 'number' && p.audioFile){
      const pad = state.pads[p.index];
      const sample = state.libraries.factory.find(s=>s.filePath===p.audioFile);
      if (pad && sample){ pad.name = p.name||pad.name; pad.audioFile = p.audioFile; pad.audioBuffer = sample.buffer; }
    }
  });

  toast.show(`Imported ${audioFiles.length} audio files from ${file.name}`);
  return manifest;
}
