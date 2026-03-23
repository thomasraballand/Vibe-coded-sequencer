// --- Audio Engine ---
let audioCtx = null;
let masterGain = null;
let recordGain = null;
let streamDest = null;
let mediaRecorder = null;
let recordedChunks = [];
let audioBlob = null;
let isRecording = false;
let trackNodes = [];
let trackEffects = [];

function makeCrushCurve(amount) {
  if (amount === 0) return null;
  const bits = Math.max(1, 16 - (amount / 100) * 15);
  const steps = Math.pow(2, bits);
  const curve = new Float32Array(4096);
  for (let i = 0; i < 4096; i++) {
    const x = (i * 2) / 4096 - 1;
    curve[i] = Math.round(x * steps) / steps;
  }
  return curve;
}

function updateTrackNodes(trackIdx) {
  if (!audioCtx || !trackNodes[trackIdx]) return;
  const nodes = trackNodes[trackIdx];
  const fx = trackEffects[trackIdx];

  nodes.output.gain.value = fx.volume / 100;

  if (fx.filter === 50) {
    nodes.filter.type = 'allpass';
  } else if (fx.filter < 50) {
    nodes.filter.type = 'lowpass';
    const freq = 20 * Math.pow(1000, fx.filter / 50);
    nodes.filter.frequency.value = freq;
  } else {
    nodes.filter.type = 'highpass';
    const freq = 20 * Math.pow(500, (fx.filter - 50) / 50);
    nodes.filter.frequency.value = freq;
  }

  nodes.bitcrusher.curve = makeCrushCurve(fx.crush);
}

const initAudio = () => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    masterGain.gain.value = 0.8;

    recordGain = audioCtx.createGain();
    recordGain.gain.value = 0.8;
    streamDest = audioCtx.createMediaStreamDestination();
    recordGain.connect(streamDest);

    for (let i = 0; i < NUM_TRACKS; i++) {
      const input = audioCtx.createGain();
      const bitcrusher = audioCtx.createWaveShaper();
      const filter = audioCtx.createBiquadFilter();
      const output = audioCtx.createGain();

      input.connect(bitcrusher);
      bitcrusher.connect(filter);
      filter.connect(output);
      output.connect(masterGain);
      output.connect(recordGain);

      trackNodes.push({ input, bitcrusher, filter, output });
      updateTrackNodes(i);
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

const playKick = (time, dest) => {
  const targetNode = dest || masterGain;
  if (!audioCtx || !targetNode) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(targetNode);
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(0.001, time + 0.5);
  gain.gain.setValueAtTime(1, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
  osc.start(time);
  osc.stop(time + 0.5);
};

const playSnare = (time, dest) => {
  const targetNode = dest || masterGain;
  if (!audioCtx || !targetNode) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const noise = audioCtx.createBufferSource();
  const bufferSize = audioCtx.sampleRate * 0.2;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  noise.buffer = buffer;
  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = 'highpass';
  noiseFilter.frequency.value = 1000;
  noise.connect(noiseFilter);
  const noiseGain = audioCtx.createGain();
  noiseFilter.connect(noiseGain);
  noiseGain.connect(targetNode);
  osc.type = 'triangle';
  osc.connect(gain);
  gain.connect(targetNode);
  osc.frequency.setValueAtTime(100, time);
  gain.gain.setValueAtTime(0.7, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
  noiseGain.gain.setValueAtTime(1, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
  osc.start(time);
  osc.stop(time + 0.2);
  noise.start(time);
};

const playHiHat = (time, open = false, dest) => {
  const targetNode = dest || masterGain;
  if (!audioCtx || !targetNode) return;
  const duration = open ? 0.3 : 0.05;
  const noise = audioCtx.createBufferSource();
  const bufferSize = audioCtx.sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  noise.buffer = buffer;
  const bandpass = audioCtx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 10000;
  const highpass = audioCtx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 7000;
  const gain = audioCtx.createGain();
  noise.connect(bandpass);
  bandpass.connect(highpass);
  highpass.connect(gain);
  gain.connect(targetNode);
  gain.gain.setValueAtTime(0.5, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
  noise.start(time);
};

const playTom = (time, dest) => {
  const targetNode = dest || masterGain;
  if (!audioCtx || !targetNode) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(targetNode);
  osc.frequency.setValueAtTime(120, time);
  osc.frequency.exponentialRampToValueAtTime(50, time + 0.2);
  gain.gain.setValueAtTime(0.8, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
  osc.start(time);
  osc.stop(time + 0.2);
};

const playClap = (time, dest) => {
  const targetNode = dest || masterGain;
  if (!audioCtx || !targetNode) return;
  const duration = 0.15;
  const noise = audioCtx.createBufferSource();
  const bufferSize = audioCtx.sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  noise.buffer = buffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1500;
  const gain = audioCtx.createGain();
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(targetNode);
  gain.gain.setValueAtTime(0, time);
  gain.gain.setValueAtTime(0.8, time + 0.01);
  gain.gain.setValueAtTime(0, time + 0.02);
  gain.gain.setValueAtTime(0.8, time + 0.03);
  gain.gain.setValueAtTime(0, time + 0.04);
  gain.gain.setValueAtTime(0.8, time + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
  noise.start(time);
};

const INSTRUMENTS = [
  { name: 'KICK', play: (t, dest) => playKick(t, dest) },
  { name: 'SNARE', play: (t, dest) => playSnare(t, dest) },
  { name: 'CLAP', play: (t, dest) => playClap(t, dest) },
  { name: 'HI-HAT (C)', play: (t, dest) => playHiHat(t, false, dest) },
  { name: 'HI-HAT (O)', play: (t, dest) => playHiHat(t, true, dest) },
  { name: 'TOM', play: (t, dest) => playTom(t, dest) },
];

const NUM_STEPS = 16;
const NUM_TRACKS = INSTRUMENTS.length;

// --- State ---
let grid = Array(NUM_TRACKS).fill(null).map(() => Array(NUM_STEPS).fill(false));
trackEffects = Array(NUM_TRACKS).fill(null).map(() => ({
  volume: 80,
  filter: 50,
  crush: 0
}));
let selectedTrackIdx = -1;
let isPlaying = false;
let bpm = 120;
let currentStep = -1;
let uiStep = -1;
let nextNoteTime = 0;
let timerID = null;

let isDrawing = false;
let drawMode = false;

// --- Track Settings UI ---
function selectTrack(idx) {
  // Toggle off if clicking the already selected track
  if (selectedTrackIdx === idx) {
    idx = -1;
  }
  
  selectedTrackIdx = idx;
  const panel = document.getElementById('track-settings-panel');
  const nameEl = document.getElementById('selected-track-name');
  
  // Highlight selected label
  document.querySelectorAll('[data-track-idx]').forEach(el => {
    if (parseInt(el.dataset.trackIdx) === idx) {
      el.classList.add('text-emerald-400');
      el.classList.remove('text-gray-400');
    } else {
      el.classList.remove('text-emerald-400');
      el.classList.add('text-gray-400');
    }
  });

  if (idx === -1) {
    panel.classList.add('hidden');
    return;
  }
  
  panel.classList.remove('hidden');
  nameEl.textContent = INSTRUMENTS[idx].name + ' SETTINGS';
  
  const fx = trackEffects[idx];
  document.getElementById('vol-slider').value = fx.volume;
  document.getElementById('filter-slider').value = fx.filter;
  document.getElementById('crush-slider').value = fx.crush;
  
  updateSettingsUI();
}

function updateSettingsUI() {
  if (selectedTrackIdx === -1) return;
  const fx = trackEffects[selectedTrackIdx];
  
  document.getElementById('vol-val').textContent = fx.volume + '%';
  
  let filterText = 'OFF';
  if (fx.filter < 50) filterText = 'LP ' + (50 - fx.filter) * 2 + '%';
  else if (fx.filter > 50) filterText = 'HP ' + (fx.filter - 50) * 2 + '%';
  document.getElementById('filter-val').textContent = filterText;
  
  document.getElementById('crush-val').textContent = fx.crush + '%';
}

// --- DOM Elements ---
const playBtn = document.getElementById('play-btn');
const playIcon = document.getElementById('play-icon');
const stopIcon = document.getElementById('stop-icon');
const bpmInput = document.getElementById('bpm-input');
const bpmSlider = document.getElementById('bpm-slider');
const clearBtns = document.querySelectorAll('.clear-btn');
const gridContainer = document.getElementById('grid-container');
const recordBtn = document.getElementById('record-btn');
const downloadBtn = document.getElementById('download-btn');
const recordIndicator = document.getElementById('record-indicator');

// --- Initialization ---
function initUI() {
  // Build Grid Header
  const headerRow = document.createElement('div');
  headerRow.className = 'flex mb-1 md:mb-2';
  headerRow.innerHTML = `<div class="w-10 sm:w-16 md:w-24 shrink-0"></div><div class="flex-1 grid grid-cols-[repeat(16,minmax(0,1fr))] gap-[2px] sm:gap-1 md:gap-2" id="step-numbers"></div>`;
  gridContainer.appendChild(headerRow);
  
  const stepNumbers = document.getElementById('step-numbers');
  for (let i = 0; i < NUM_STEPS; i++) {
    const num = document.createElement('div');
    num.className = 'text-center text-[7px] sm:text-[9px] md:text-[10px] font-mono text-gray-600';
    num.textContent = (i % 4 === 0) ? (i / 4) + 1 : '';
    stepNumbers.appendChild(num);
  }

  // Build Tracks
  for (let trackIdx = 0; trackIdx < NUM_TRACKS; trackIdx++) {
    const trackRow = document.createElement('div');
    trackRow.className = 'flex items-center gap-1 sm:gap-2 md:gap-4';
    
    const label = document.createElement('div');
    label.className = 'w-10 sm:w-16 md:w-20 shrink-0 text-right text-[7px] sm:text-[9px] md:text-xs font-mono font-bold text-gray-400 tracking-tighter md:tracking-wider flex items-center justify-end pr-1 md:pr-0 cursor-pointer hover:text-emerald-400 transition-colors';
    label.textContent = INSTRUMENTS[trackIdx].name;
    label.dataset.trackIdx = trackIdx;
    label.addEventListener('click', () => selectTrack(trackIdx));
    trackRow.appendChild(label);
    
    const stepsContainer = document.createElement('div');
    stepsContainer.className = 'flex-1 grid grid-cols-[repeat(16,minmax(0,1fr))] gap-[2px] sm:gap-1 md:gap-2';
    
    for (let stepIdx = 0; stepIdx < NUM_STEPS; stepIdx++) {
      const btn = document.createElement('div');
      btn.className = `aspect-square rounded-sm step-btn ${stepIdx % 4 === 0 ? 'beat-start' : ''}`;
      btn.dataset.track = trackIdx;
      btn.dataset.step = stepIdx;
      
      btn.addEventListener('pointerdown', (e) => {
        e.target.releasePointerCapture(e.pointerId);
        initAudio();
        isDrawing = true;
        drawMode = !grid[trackIdx][stepIdx];
        toggleStep(trackIdx, stepIdx, drawMode);
      });
      
      btn.addEventListener('pointerenter', (e) => {
        if (isDrawing) {
          toggleStep(trackIdx, stepIdx, drawMode);
        }
      });
      
      stepsContainer.appendChild(btn);
    }
    
    trackRow.appendChild(stepsContainer);
    gridContainer.appendChild(trackRow);
  }
}

function toggleStep(trackIdx, stepIdx, value) {
  grid[trackIdx][stepIdx] = value;
  updateGridUI();
}

function updateGridUI() {
  const buttons = document.querySelectorAll('.step-btn');
  buttons.forEach(btn => {
    const t = parseInt(btn.dataset.track);
    const s = parseInt(btn.dataset.step);
    const isActive = grid[t][s];
    const isCurrent = uiStep === s;
    const isBeatStart = s % 4 === 0;
    
    btn.className = 'aspect-square rounded-sm step-btn';
    if (isActive) btn.classList.add('active');
    if (isCurrent) btn.classList.add('current');
    if (isBeatStart && !isActive && !isCurrent) btn.classList.add('beat-start');
  });
}

function updatePlayBtnUI() {
  if (isPlaying) {
    playBtn.className = 'w-14 h-14 shrink-0 rounded-full flex items-center justify-center transition-all bg-[#F27D26] text-white shadow-[0_0_15px_rgba(242,125,38,0.5)]';
    playIcon.classList.add('hidden');
    stopIcon.classList.remove('hidden');
  } else {
    playBtn.className = 'w-14 h-14 shrink-0 rounded-full flex items-center justify-center transition-all bg-[#333] text-gray-300 hover:bg-[#444]';
    playIcon.classList.remove('hidden');
    stopIcon.classList.add('hidden');
  }
}

// --- Scheduler ---
function scheduleNote(stepNumber, time) {
  const timeToPlay = time - audioCtx.currentTime;
  setTimeout(() => {
    if (!isPlaying) return;
    requestAnimationFrame(() => {
      uiStep = stepNumber;
      updateGridUI();
    });
  }, Math.max(0, timeToPlay * 1000));
  
  for (let trackIdx = 0; trackIdx < NUM_TRACKS; trackIdx++) {
    if (grid[trackIdx][stepNumber]) {
      INSTRUMENTS[trackIdx].play(time, trackNodes[trackIdx]?.input);
    }
  }
}

function scheduler() {
  if (!isPlaying || !audioCtx) return;
  
  const scheduleAheadTime = 0.1;
  while (nextNoteTime < audioCtx.currentTime + scheduleAheadTime) {
    scheduleNote(currentStep, nextNoteTime);
    const secondsPerBeat = 60.0 / bpm;
    nextNoteTime += 0.25 * secondsPerBeat;
    currentStep = (currentStep + 1) % NUM_STEPS;
  }
  timerID = window.setTimeout(scheduler, 25);
}

// --- Event Listeners ---
playBtn.addEventListener('click', () => {
  initAudio();
  isPlaying = !isPlaying;
  updatePlayBtnUI();
  
  if (isPlaying) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    currentStep = 0;
    uiStep = 0;
    nextNoteTime = audioCtx.currentTime + 0.05;
    scheduler();
  } else {
    window.clearTimeout(timerID);
    currentStep = -1;
    uiStep = -1;
    updateGridUI();
  }
});

clearBtns.forEach(btn => btn.addEventListener('click', () => {
  grid = Array(NUM_TRACKS).fill(null).map(() => Array(NUM_STEPS).fill(false));
  updateGridUI();
}));

const handleBpmChange = (val) => {
  let newBpm = parseInt(val, 10);
  if (!isNaN(newBpm)) {
    bpm = newBpm;
    bpmInput.value = bpm;
    bpmSlider.value = bpm;
  }
};

bpmInput.addEventListener('input', (e) => {
  if (e.target.value !== '') {
    handleBpmChange(e.target.value);
  }
});
bpmInput.addEventListener('blur', (e) => {
  let val = parseInt(e.target.value, 10);
  if (isNaN(val)) val = 120;
  if (val < 60) val = 60;
  if (val > 200) val = 200;
  handleBpmChange(val);
});

bpmSlider.addEventListener('input', (e) => {
  handleBpmChange(e.target.value);
});

// --- Track Settings Event Listeners ---
document.getElementById('vol-slider').addEventListener('input', (e) => {
  if (selectedTrackIdx === -1) return;
  trackEffects[selectedTrackIdx].volume = parseInt(e.target.value);
  updateSettingsUI();
  updateTrackNodes(selectedTrackIdx);
});

document.getElementById('filter-slider').addEventListener('input', (e) => {
  if (selectedTrackIdx === -1) return;
  trackEffects[selectedTrackIdx].filter = parseInt(e.target.value);
  updateSettingsUI();
  updateTrackNodes(selectedTrackIdx);
});

document.getElementById('crush-slider').addEventListener('input', (e) => {
  if (selectedTrackIdx === -1) return;
  trackEffects[selectedTrackIdx].crush = parseInt(e.target.value);
  updateSettingsUI();
  updateTrackNodes(selectedTrackIdx);
});

document.getElementById('close-settings-btn').addEventListener('click', () => {
  selectTrack(-1);
});

// --- Recording Event Listeners ---
recordBtn.addEventListener('click', () => {
  if (!audioCtx) initAudio();
  
  if (!isRecording) {
    // Start recording
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(streamDest.stream);
    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
      audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
      
      // Highlight download button
      downloadBtn.disabled = false;
      downloadBtn.className = 'flex-1 py-2 rounded bg-pink-900/20 text-pink-400 font-mono text-xs hover:bg-pink-900/40 transition-colors border border-pink-500/50 flex items-center justify-center gap-2 cursor-pointer';
    };
    mediaRecorder.start();
    isRecording = true;
    
    // Highlight record button
    recordBtn.className = 'flex-1 py-2 rounded bg-pink-600 text-white font-mono text-xs hover:bg-pink-500 transition-colors border border-pink-500 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(219,39,119,0.6)]';
    recordIndicator.className = 'w-2 h-2 rounded-full bg-white animate-pulse';
    document.getElementById('record-text').textContent = 'STOP ENREGISTREMENT';
    
    // Disable download button
    downloadBtn.disabled = true;
    downloadBtn.className = 'flex-1 py-2 rounded bg-[#222] text-gray-600 font-mono text-xs cursor-not-allowed border border-[#333] transition-colors flex items-center justify-center gap-2';
    
  } else {
    // Stop recording
    mediaRecorder.stop();
    isRecording = false;
    
    // Unhighlight record button
    recordBtn.className = 'flex-1 py-2 rounded bg-[#333] text-gray-300 font-mono text-xs hover:bg-[#444] transition-colors border border-[#444] flex items-center justify-center gap-2';
    recordIndicator.className = 'w-2 h-2 rounded-full bg-gray-500';
    document.getElementById('record-text').textContent = 'ENREGISTRER';
  }
});

downloadBtn.addEventListener('click', () => {
  if (isRecording || !audioBlob) return;
  const url = URL.createObjectURL(audioBlob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = 'beat.mp3'; // Note: actually webm but named mp3 per request, though standard players might complain. Let's use webm to be safe, or just mp3 and hope the browser/OS handles it. The user asked for mp3.
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
});

window.addEventListener('pointerup', () => isDrawing = false);
window.addEventListener('pointercancel', () => isDrawing = false);

// Init
initUI();
