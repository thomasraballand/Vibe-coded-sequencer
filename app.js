// --- Audio Engine ---
let audioCtx = null;
let masterGain = null;

const initAudio = () => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    masterGain.gain.value = 0.8;
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

const playKick = (time) => {
  if (!audioCtx || !masterGain) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(masterGain);
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(0.001, time + 0.5);
  gain.gain.setValueAtTime(1, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
  osc.start(time);
  osc.stop(time + 0.5);
};

const playSnare = (time) => {
  if (!audioCtx || !masterGain) return;
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
  noiseGain.connect(masterGain);
  osc.type = 'triangle';
  osc.connect(gain);
  gain.connect(masterGain);
  osc.frequency.setValueAtTime(100, time);
  gain.gain.setValueAtTime(0.7, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
  noiseGain.gain.setValueAtTime(1, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
  osc.start(time);
  osc.stop(time + 0.2);
  noise.start(time);
};

const playHiHat = (time, open = false) => {
  if (!audioCtx || !masterGain) return;
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
  gain.connect(masterGain);
  gain.gain.setValueAtTime(0.5, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
  noise.start(time);
};

const playTom = (time) => {
  if (!audioCtx || !masterGain) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(masterGain);
  osc.frequency.setValueAtTime(120, time);
  osc.frequency.exponentialRampToValueAtTime(50, time + 0.2);
  gain.gain.setValueAtTime(0.8, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
  osc.start(time);
  osc.stop(time + 0.2);
};

const playClap = (time) => {
  if (!audioCtx || !masterGain) return;
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
  gain.connect(masterGain);
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
  { name: 'KICK', play: playKick },
  { name: 'SNARE', play: playSnare },
  { name: 'CLAP', play: playClap },
  { name: 'HI-HAT (C)', play: (t) => playHiHat(t, false) },
  { name: 'HI-HAT (O)', play: (t) => playHiHat(t, true) },
  { name: 'TOM', play: playTom },
];

const NUM_STEPS = 16;
const NUM_TRACKS = INSTRUMENTS.length;

// --- State ---
let grid = Array(NUM_TRACKS).fill(null).map(() => Array(NUM_STEPS).fill(false));
let isPlaying = false;
let bpm = 120;
let currentStep = -1;
let uiStep = -1;
let nextNoteTime = 0;
let timerID = null;

let isDrawing = false;
let drawMode = false;

// --- DOM Elements ---
const playBtn = document.getElementById('play-btn');
const playIcon = document.getElementById('play-icon');
const stopIcon = document.getElementById('stop-icon');
const bpmInput = document.getElementById('bpm-input');
const bpmSlider = document.getElementById('bpm-slider');
const clearBtn = document.getElementById('clear-btn');
const gridContainer = document.getElementById('grid-container');

// --- Initialization ---
function initUI() {
  gridContainer.innerHTML = '';
  
  const emptyCell = document.createElement('div');
  emptyCell.className = 'grid-cell-empty';
  gridContainer.appendChild(emptyCell);
  
  for (let i = 0; i < NUM_STEPS; i++) {
    const num = document.createElement('div');
    num.className = 'grid-cell-step-num text-[10px] font-mono text-gray-600';
    num.style.setProperty('--step', i);
    num.textContent = (i % 4 === 0) ? (i / 4) + 1 : '';
    gridContainer.appendChild(num);
  }

  for (let trackIdx = 0; trackIdx < NUM_TRACKS; trackIdx++) {
    const label = document.createElement('div');
    label.className = 'grid-cell-track-label text-xs font-mono font-bold text-gray-400 tracking-wider';
    label.style.setProperty('--track', trackIdx);
    label.textContent = INSTRUMENTS[trackIdx].name;
    gridContainer.appendChild(label);
  }
  
  for (let trackIdx = 0; trackIdx < NUM_TRACKS; trackIdx++) {
    for (let stepIdx = 0; stepIdx < NUM_STEPS; stepIdx++) {
      const btn = document.createElement('div');
      btn.className = `aspect-square rounded-sm step-btn ${stepIdx % 4 === 0 ? 'beat-start' : ''} grid-cell-btn`;
      btn.style.setProperty('--track', trackIdx);
      btn.style.setProperty('--step', stepIdx);
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
      
      gridContainer.appendChild(btn);
    }
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
    
    btn.className = `aspect-square rounded-sm step-btn grid-cell-btn`;
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
      INSTRUMENTS[trackIdx].play(time);
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

clearBtn.addEventListener('click', () => {
  grid = Array(NUM_TRACKS).fill(null).map(() => Array(NUM_STEPS).fill(false));
  updateGridUI();
});

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

window.addEventListener('pointerup', () => isDrawing = false);
window.addEventListener('pointercancel', () => isDrawing = false);

// Init
initUI();
