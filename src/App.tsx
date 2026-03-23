/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, Trash2 } from 'lucide-react';

// --- Audio Engine ---
let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;

const initAudio = () => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    masterGain.gain.value = 0.8;
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

const playKick = (time: number) => {
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

const playSnare = (time: number) => {
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

const playHiHat = (time: number, open: boolean = false) => {
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

const playTom = (time: number) => {
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

const playClap = (time: number) => {
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
  { name: 'HI-HAT (C)', play: (t: number) => playHiHat(t, false) },
  { name: 'HI-HAT (O)', play: (t: number) => playHiHat(t, true) },
  { name: 'TOM', play: playTom },
];

const NUM_STEPS = 16;
const NUM_TRACKS = INSTRUMENTS.length;

const initialGrid = Array(NUM_TRACKS).fill(null).map(() => Array(NUM_STEPS).fill(false));

export default function App() {
  const [grid, setGrid] = useState<boolean[][]>(initialGrid);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState<number | ''>(120);
  const [currentStep, setCurrentStep] = useState(-1);
  
  const isPlayingRef = useRef(isPlaying);
  const bpmRef = useRef(bpm);
  const gridRef = useRef(grid);
  const currentStepRef = useRef(0);
  const nextNoteTimeRef = useRef(0);
  const timerIDRef = useRef<number | null>(null);

  const isDrawingRef = useRef(false);
  const drawModeRef = useRef(false);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    bpmRef.current = typeof bpm === 'number' ? bpm : 120;
    gridRef.current = grid;
  }, [isPlaying, bpm, grid]);

  const scheduleNote = useCallback((stepNumber: number, time: number) => {
    requestAnimationFrame(() => {
      setCurrentStep(stepNumber);
    });
    
    gridRef.current.forEach((track, trackIdx) => {
      if (track[stepNumber]) {
        INSTRUMENTS[trackIdx].play(time);
      }
    });
  }, []);

  const scheduler = useCallback(() => {
    if (!isPlayingRef.current || !audioCtx) return;
    
    const scheduleAheadTime = 0.1;
    while (nextNoteTimeRef.current < audioCtx.currentTime + scheduleAheadTime) {
      scheduleNote(currentStepRef.current, nextNoteTimeRef.current);
      
      const secondsPerBeat = 60.0 / bpmRef.current;
      nextNoteTimeRef.current += 0.25 * secondsPerBeat;
      currentStepRef.current = (currentStepRef.current + 1) % NUM_STEPS;
    }
    timerIDRef.current = window.setTimeout(scheduler, 25);
  }, [scheduleNote]);

  useEffect(() => {
    if (isPlaying) {
      initAudio();
      if (audioCtx) {
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        currentStepRef.current = 0;
        nextNoteTimeRef.current = audioCtx.currentTime + 0.05;
        scheduler();
      }
    } else {
      if (timerIDRef.current !== null) {
        window.clearTimeout(timerIDRef.current);
        timerIDRef.current = null;
      }
      setCurrentStep(-1);
    }
    return () => {
      if (timerIDRef.current !== null) {
        window.clearTimeout(timerIDRef.current);
      }
    };
  }, [isPlaying, scheduler]);

  const togglePlay = () => {
    initAudio();
    setIsPlaying(!isPlaying);
  };

  const clearGrid = () => {
    setGrid(initialGrid);
  };

  const updateGrid = (trackIdx: number, stepIdx: number, value: boolean) => {
    setGrid(prev => {
      const newGrid = [...prev];
      newGrid[trackIdx] = [...newGrid[trackIdx]];
      newGrid[trackIdx][stepIdx] = value;
      return newGrid;
    });
  };

  const handlePointerDown = (trackIdx: number, stepIdx: number, e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    initAudio();
    
    const newValue = !grid[trackIdx][stepIdx];
    isDrawingRef.current = true;
    drawModeRef.current = newValue;
    updateGrid(trackIdx, stepIdx, newValue);
  };

  const handlePointerEnter = (trackIdx: number, stepIdx: number) => {
    if (isDrawingRef.current) {
      updateGrid(trackIdx, stepIdx, drawModeRef.current);
    }
  };

  useEffect(() => {
    const handlePointerUp = () => {
      isDrawingRef.current = false;
    };
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-5xl hardware-panel p-6 md:p-8 flex flex-col gap-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-white/10">
          <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-start">
            <button 
              onClick={togglePlay}
              className={`w-14 h-14 shrink-0 rounded-full flex items-center justify-center transition-all ${
                isPlaying 
                  ? 'bg-[#F27D26] text-white shadow-[0_0_15px_rgba(242,125,38,0.5)]' 
                  : 'bg-[#333] text-gray-300 hover:bg-[#444]'
              }`}
            >
              {isPlaying ? <Square fill="currentColor" size={24} /> : <Play fill="currentColor" size={24} className="ml-1" />}
            </button>
            
            <div className="lcd-screen px-4 py-2 rounded flex flex-col items-center min-w-[100px]">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Tempo</span>
              <input 
                type="number" 
                min="60" 
                max="200" 
                value={bpm} 
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') setBpm('');
                  else {
                    const num = parseInt(val, 10);
                    if (!isNaN(num)) setBpm(num);
                  }
                }}
                onBlur={() => {
                  if (bpm === '') setBpm(120);
                  else if (bpm < 60) setBpm(60);
                  else if (bpm > 200) setBpm(200);
                }}
                className="text-2xl font-bold bg-transparent border-none text-center w-full outline-none text-[var(--accent)] p-0 m-0"
              />
            </div>
          </div>

          <div className="flex-1 w-full max-w-xs flex flex-col gap-2">
            <div className="flex justify-between text-xs font-mono text-gray-500">
              <span>60</span>
              <span>BPM</span>
              <span>200</span>
            </div>
            <input 
              type="range" 
              min="60" 
              max="200" 
              value={bpm === '' ? 120 : bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <button 
            onClick={clearGrid}
            className="flex items-center justify-center gap-2 px-4 py-3 md:py-2 w-full md:w-auto rounded bg-[#333] hover:bg-[#444] text-gray-300 transition-colors text-sm font-mono uppercase tracking-wider"
          >
            <Trash2 size={16} />
            Clear
          </button>
        </div>

        {/* Grid */}
        <div className="overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0">
          <div className="min-w-[768px] flex flex-col gap-2">
            
            <div className="flex mb-2">
              <div className="w-24 shrink-0"></div>
              <div className="flex-1 grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1 md:gap-2">
                {Array.from({ length: NUM_STEPS }).map((_, i) => (
                  <div key={i} className="text-center text-[10px] font-mono text-gray-600">
                    {(i % 4 === 0) ? (i / 4) + 1 : ''}
                  </div>
                ))}
              </div>
            </div>

            {grid.map((track, trackIdx) => (
              <div key={trackIdx} className="flex items-center gap-4">
                <div className="w-20 shrink-0 text-right text-xs font-mono font-bold text-gray-400 tracking-wider">
                  {INSTRUMENTS[trackIdx].name}
                </div>
                
                <div className="flex-1 grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1 md:gap-2">
                  {track.map((isActive, stepIdx) => {
                    const isCurrent = currentStep === stepIdx;
                    const isBeatStart = stepIdx % 4 === 0;
                    
                    return (
                      <div 
                        key={stepIdx}
                        className={`
                          aspect-square rounded-sm step-btn
                          ${isActive ? 'active' : ''}
                          ${isCurrent ? 'current' : ''}
                          ${isBeatStart && !isActive && !isCurrent ? 'beat-start' : ''}
                        `}
                        onPointerDown={(e) => handlePointerDown(trackIdx, stepIdx, e)}
                        onPointerEnter={() => handlePointerEnter(trackIdx, stepIdx)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
      
      <div className="mt-8 text-center max-w-md px-4">
        <p className="text-xs text-gray-500 font-mono leading-relaxed">
          Tap to toggle steps. Swipe to draw multiple steps.<br/>
          Built with Web Audio API & React.
        </p>
      </div>
    </div>
  );
}
