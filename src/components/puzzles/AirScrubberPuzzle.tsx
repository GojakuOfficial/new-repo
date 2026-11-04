import React, { useState, useEffect } from 'react';
import { soundFx } from '../../utils/audio';
import { CheckCircle, RotateCcw, X, Radio, Sparkles } from 'lucide-react';

interface AirScrubberPuzzleProps {
  onSolve: () => void;
  onClose: () => void;
}

export const AirScrubberPuzzle: React.FC<AirScrubberPuzzleProps> = ({ onSolve, onClose }) => {
  // Target values with generous tolerances
  const targetFreq = 42; // Hz (+/- 10 Hz tolerance: 32 - 52 Hz)
  const targetAmp = 75;  // dB (+/- 16 dB tolerance: 59 - 91 dB)
  const FREQ_TOLERANCE = 10;
  const AMP_TOLERANCE = 16;

  // Starting values start close to target for a fun, satisfying kick of challenge
  const [frequency, setFrequency] = useState(36);
  const [amplitude, setAmplitude] = useState(62);
  const [aqi, setAqi] = useState(120);
  const [cancellation, setCancellation] = useState(70);
  const [isSolved, setIsSolved] = useState(false);

  useEffect(() => {
    const fDiff = Math.abs(frequency - targetFreq);
    const aDiff = Math.abs(amplitude - targetAmp);

    // Score out of 100
    const fScore = Math.max(0, 1 - fDiff / 25);
    const aScore = Math.max(0, 1 - aDiff / 35);
    const score = Math.round(((fScore + aScore) / 2) * 100);

    setCancellation(score);
    setAqi(Math.max(28, Math.round(180 - (score / 100) * 145)));

    const inRange = fDiff <= FREQ_TOLERANCE && aDiff <= AMP_TOLERANCE;

    if (inRange && !isSolved) {
      setIsSolved(true);
      soundFx.playPuzzleSuccess();
      setTimeout(() => {
        onSolve();
      }, 1200);
    }
  }, [frequency, amplitude, isSolved, onSolve]);

  const handleSnap = (type: 'freq' | 'amp') => {
    soundFx.playClick();
    if (type === 'freq') setFrequency(targetFreq);
    if (type === 'amp') setAmplitude(targetAmp);
  };

  const handleAutoTuneAll = () => {
    soundFx.playClick();
    setFrequency(targetFreq);
    setAmplitude(targetAmp);
  };

  const handleReset = () => {
    soundFx.playClick();
    setFrequency(34);
    setAmplitude(58);
  };

  const freqLocked = Math.abs(frequency - targetFreq) <= FREQ_TOLERANCE;
  const ampLocked = Math.abs(amplitude - targetAmp) <= AMP_TOLERANCE;

  return (
    <div className="puzzle-modal-backdrop" onClick={onClose}>
      <div className="puzzle-modal-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="puzzle-header">
          <div className="puzzle-title-group">
            <span className="puzzle-eyebrow">SECTOR 04 // BIO-RESONANCE AIR HUB</span>
            <h3 className="puzzle-title">Harmonic Smog Scrubber Calibration</h3>
          </div>
          <button className="puzzle-close-btn" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Description */}
        <p className="puzzle-desc">
          Tune the acoustic frequency (target ~42 Hz) and ultrasonic amplitude (target ~75 dB) to generate destructive interference against the smog wave. The wave is already near resonance—just slide slightly into the green zones!
        </p>

        {/* Status */}
        <div className="puzzle-status-bar">
          <div className="puzzle-status-item">
            <span className="puzzle-status-label">Particulate Cancellation</span>
            <span className={`puzzle-status-value ${isSolved ? 'color-good' : 'color-cyan'}`}>
              {cancellation}% {isSolved ? '(Harmonic Lock)' : '(Harmonizing)'}
            </span>
          </div>
          <div className="puzzle-status-item">
            <span className="puzzle-status-label">Corridor Air Quality</span>
            <span className={`puzzle-status-value ${aqi <= 60 ? 'color-good' : 'color-amber'}`}>
              {aqi} AQI {aqi <= 60 ? '(Pure Mountain Clean)' : '(Moderate Haze)'}
            </span>
          </div>
        </div>

        {/* Assist Banner */}
        {!isSolved && (
          <div style={{
            background: 'rgba(53, 211, 153, 0.1)',
            border: '1px solid rgba(53, 211, 153, 0.3)',
            borderRadius: '8px',
            padding: '0.6rem 0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginBottom: '0.85rem',
            fontSize: '0.8rem',
            color: '#fff',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={16} color="#35d399" />
              <span>Slide towards ~42 Hz &amp; ~75 dB to trigger instant harmonic lock!</span>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleAutoTuneAll}
              style={{
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                color: '#fff',
                border: 'none',
                padding: '0.25rem 0.65rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Auto-Tune All (1-Click)
            </button>
          </div>
        )}

        {/* Oscilloscope Graphic */}
        <div className="oscilloscope-screen">
          <div className="oscilloscope-header">
            <Radio size={14} className="color-cyan" style={{ marginRight: '6px' }} />
            <span>BIO-RESONANCE OSCILLOSCOPE INTERFEROMETER</span>
          </div>
          <svg viewBox="0 0 400 120" width="100%" height="120" className="oscilloscope-svg">
            <defs>
              <pattern id="scope-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(40,217,236,0.12)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="400" height="120" fill="url(#scope-grid)" />

            {/* Target Smog Wave (Orange) */}
            <path
              d="M 0 60 Q 50 15, 100 60 T 200 60 T 300 60 T 400 60"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeDasharray="4 2"
              opacity="0.8"
            />

            {/* Player's Anti-Wave (Cyan/Green) */}
            <path
              d={`M 0 60 Q ${20 + frequency * 0.7} ${60 - amplitude * 0.55}, 100 60 T 200 60 T 300 60 T 400 60`}
              fill="none"
              stroke={isSolved ? '#34d399' : '#28d9ec'}
              strokeWidth="3.5"
            />
          </svg>
          <div className="oscilloscope-legend">
            <span style={{ color: '#f59e0b' }}>-- Atmospheric Smog Waveform</span>
            <span style={{ color: isSolved ? '#34d399' : '#28d9ec' }}>
              ━ Scrubber Harmonic Counter-Wave {isSolved ? '(LOCKED)' : ''}
            </span>
          </div>
        </div>

        {/* Sliders */}
        <div className="traffic-sliders-container" style={{ marginTop: '1rem' }}>
          <div className="traffic-slider-group">
            <div className="slider-label-row">
              <span className="slider-title">Acoustic Resonance Frequency</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`slider-value ${freqLocked ? 'color-good' : 'color-cyan'}`}>
                  {frequency} Hz (Target: 42 Hz ± 10)
                </span>
                {!freqLocked && (
                  <button
                    type="button"
                    onClick={() => handleSnap('freq')}
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '0.65rem',
                      cursor: 'pointer',
                    }}
                  >
                    Snap 42Hz
                  </button>
                )}
              </div>
            </div>
            <input
              type="range"
              min="10"
              max="60"
              value={frequency}
              onChange={e => setFrequency(parseInt(e.target.value, 10))}
              className="traffic-range-input"
              disabled={isSolved}
            />
          </div>

          <div className="traffic-slider-group">
            <div className="slider-label-row">
              <span className="slider-title">Ultrasonic Pulse Amplitude</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`slider-value ${ampLocked ? 'color-good' : 'color-cyan'}`}>
                  {amplitude} dB (Target: 75 dB ± 16)
                </span>
                {!ampLocked && (
                  <button
                    type="button"
                    onClick={() => handleSnap('amp')}
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '0.65rem',
                      cursor: 'pointer',
                    }}
                  >
                    Snap 75dB
                  </button>
                )}
              </div>
            </div>
            <input
              type="range"
              min="20"
              max="100"
              value={amplitude}
              onChange={e => setAmplitude(parseInt(e.target.value, 10))}
              className="traffic-range-input"
              disabled={isSolved}
            />
          </div>
        </div>

        {/* Success Banner */}
        {isSolved && (
          <div className="puzzle-success-banner" style={{ marginTop: '1rem' }}>
            <CheckCircle size={20} className="color-good" />
            <span>HARMONIC RESONANCE LOCKED! Atmospheric PM2.5 cloud disintegrating.</span>
          </div>
        )}

        {/* Footer */}
        <div className="puzzle-footer">
          <button className="btn btn-ghost btn-sm" onClick={handleReset} type="button">
            <RotateCcw size={14} style={{ marginRight: '6px' }} />
            Reset Frequencies
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onClose} type="button">
            Exit Terminal
          </button>
        </div>
      </div>
    </div>
  );
};
