import React, { useState, useEffect } from 'react';
import { soundFx } from '../../utils/audio';
import { CheckCircle, RotateCcw, X, Activity, Sparkles } from 'lucide-react';

interface TrafficPuzzleProps {
  onSolve: () => void;
  onClose: () => void;
}

interface ArterialSignal {
  id: string;
  name: string;
  intersection: string;
  currentPhase: number; // 0 - 100
  targetPhase: number;  // Target alignment range +/- 16
  congestion: number;    // %
}

export const TrafficPuzzle: React.FC<TrafficPuzzleProps> = ({ onSolve, onClose }) => {
  // Generous +/- 16% tolerance window makes this smooth and accessible
  const TOLERANCE = 16;

  const [signals, setSignals] = useState<ArterialSignal[]>([
    { id: 'sig1', name: 'North Boulevard Corridors', intersection: 'Int. C-1 CBD North', currentPhase: 38, targetPhase: 40, congestion: 45 },
    { id: 'sig2', name: 'Central Ring Express', intersection: 'Int. C-2 Metro Hub', currentPhase: 84, targetPhase: 65, congestion: 78 },
    { id: 'sig3', name: 'South Arterial Bypass', intersection: 'Int. C-3 Arcology Spine', currentPhase: 34, targetPhase: 50, congestion: 72 },
  ]);

  const [avgCongestion, setAvgCongestion] = useState(65);
  const [syncAccuracy, setSyncAccuracy] = useState(72);
  const [isSolved, setIsSolved] = useState(false);

  useEffect(() => {
    let totalError = 0;
    signals.forEach(s => {
      totalError += Math.abs(s.currentPhase - s.targetPhase);
    });

    const maxError = 100;
    const accuracy = Math.max(0, Math.min(100, Math.round((1 - totalError / maxError) * 100)));
    const congestion = Math.max(15, Math.round(75 - (accuracy / 100) * 60));

    setSyncAccuracy(accuracy);
    setAvgCongestion(congestion);

    const allAligned = signals.every(s => Math.abs(s.currentPhase - s.targetPhase) <= TOLERANCE);

    if (allAligned && !isSolved) {
      setIsSolved(true);
      soundFx.playPuzzleSuccess();
      setTimeout(() => {
        onSolve();
      }, 1200);
    }
  }, [signals, isSolved, onSolve]);

  const handlePhaseChange = (id: string, val: number) => {
    if (isSolved) return;
    setSignals(prev =>
      prev.map(s => (s.id === id ? { ...s, currentPhase: val } : s))
    );
  };

  const handleSnapTarget = (id: string, target: number) => {
    if (isSolved) return;
    soundFx.playClick();
    setSignals(prev =>
      prev.map(s => (s.id === id ? { ...s, currentPhase: target } : s))
    );
  };

  const handleAutoSyncAll = () => {
    soundFx.playClick();
    setSignals(prev =>
      prev.map(s => ({ ...s, currentPhase: s.targetPhase }))
    );
  };

  const handleReset = () => {
    soundFx.playClick();
    setSignals([
      { ...signals[0], currentPhase: 38 },
      { ...signals[1], currentPhase: 84 },
      { ...signals[2], currentPhase: 34 },
    ]);
  };

  return (
    <div className="puzzle-modal-backdrop" onClick={onClose}>
      <div className="puzzle-modal-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="puzzle-header">
          <div className="puzzle-title-group">
            <span className="puzzle-eyebrow">SECTOR 03 // CBD TRAFFIC INTELLIGENCE</span>
            <h3 className="puzzle-title">Adaptive Wave Signal Optimization</h3>
          </div>
          <button className="puzzle-close-btn" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Description */}
        <p className="puzzle-desc">
          Slide the arterial signal timers into the broad green target zones. Avenue 01 is already harmonized—simply slide Avenues 02 &amp; 03 into their marked windows to clear citywide gridlock!
        </p>

        {/* Telemetry Bar */}
        <div className="puzzle-status-bar">
          <div className="puzzle-status-item">
            <span className="puzzle-status-label">Green Wave Synchronization</span>
            <span className={`puzzle-status-value ${syncAccuracy >= 80 ? 'color-good' : 'color-cyan'}`}>
              {syncAccuracy}% {syncAccuracy >= 80 ? '(Phase Locked)' : '(Harmonizing)'}
            </span>
          </div>
          <div className="puzzle-status-item">
            <span className="puzzle-status-label">Arterial Congestion</span>
            <span className={`puzzle-status-value ${avgCongestion < 30 ? 'color-good' : 'color-amber'}`}>
              {avgCongestion}% {avgCongestion < 30 ? '(Free Flow)' : '(Clearing)'}
            </span>
          </div>
        </div>

        {/* Assist Banner */}
        {!isSolved && (
          <div style={{
            background: 'rgba(40, 217, 236, 0.1)',
            border: '1px solid rgba(40, 217, 236, 0.3)',
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
              <Sparkles size={16} color="#28d9ec" />
              <span>Nudge sliders into the green brackets or use instant snap buttons!</span>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleAutoSyncAll}
              style={{
                background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                color: '#fff',
                border: 'none',
                padding: '0.25rem 0.65rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Auto-Sync All (1-Click)
            </button>
          </div>
        )}

        {/* Waveform Visualization Canvas */}
        <div className="traffic-waveform-box">
          <div className="waveform-header">
            <Activity size={14} className="color-cyan" style={{ marginRight: '6px' }} />
            <span>METROPOLITAN TRAFFIC WAVE RESIDUAL</span>
          </div>
          <div className="waveform-visual-track">
            {signals.map((s, idx) => {
              const diff = Math.abs(s.currentPhase - s.targetPhase);
              const inSync = diff <= TOLERANCE;
              return (
                <div key={s.id} className="signal-wave-row">
                  <span className="signal-row-label">Avenue 0{idx + 1}</span>
                  <div className="wave-bar-bg" style={{ height: '16px' }}>
                    {/* Generous Target Window Zone */}
                    <div
                      className="target-window-zone"
                      style={{
                        left: `${Math.max(0, s.targetPhase - TOLERANCE)}%`,
                        width: `${TOLERANCE * 2}%`,
                        background: inSync ? 'rgba(53, 211, 153, 0.35)' : 'rgba(53, 211, 153, 0.2)',
                        border: '1.5px solid #35d399',
                      }}
                      title={`Target Zone: ${s.targetPhase}% (+/- ${TOLERANCE}%)`}
                    />
                    {/* Current Position Marker */}
                    <div
                      className={`current-phase-pin ${inSync ? 'in-sync' : ''}`}
                      style={{
                        left: `${s.currentPhase}%`,
                        width: '8px',
                      }}
                    />
                  </div>
                  <span className={`signal-sync-tag ${inSync ? 'color-good' : 'color-amber'}`}>
                    {inSync ? '✓ LOCKED' : `${Math.round(diff)}ms off`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Phase Adjusters */}
        <div className="traffic-sliders-container" style={{ marginTop: '1rem' }}>
          {signals.map(s => {
            const inSync = Math.abs(s.currentPhase - s.targetPhase) <= TOLERANCE;
            return (
              <div key={s.id} className="traffic-slider-group">
                <div className="slider-label-row">
                  <div>
                    <span className="slider-title">{s.name}</span>
                    <span className="slider-sub" style={{ marginLeft: '8px', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
                      {s.intersection}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`slider-value ${inSync ? 'color-good' : 'color-cyan'}`}>
                      {s.currentPhase}% (Target: {s.targetPhase}%)
                    </span>
                    {!inSync && (
                      <button
                        type="button"
                        onClick={() => handleSnapTarget(s.id, s.targetPhase)}
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
                        Snap
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={s.currentPhase}
                  onChange={e => handlePhaseChange(s.id, parseInt(e.target.value, 10))}
                  className="traffic-range-input"
                  disabled={isSolved}
                />
              </div>
            );
          })}
        </div>

        {/* Success Banner */}
        {isSolved && (
          <div className="puzzle-success-banner" style={{ marginTop: '1rem' }}>
            <CheckCircle size={20} className="color-good" />
            <span>GREEN WAVE SYNCHRONIZED! Arterial vehicle corridors flowing without delay.</span>
          </div>
        )}

        {/* Footer */}
        <div className="puzzle-footer">
          <button className="btn btn-ghost btn-sm" onClick={handleReset} type="button">
            <RotateCcw size={14} style={{ marginRight: '6px' }} />
            Reset Signals
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onClose} type="button">
            Exit Terminal
          </button>
        </div>
      </div>
    </div>
  );
};
