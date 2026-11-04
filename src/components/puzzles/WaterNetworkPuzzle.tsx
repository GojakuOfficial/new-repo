import React, { useState, useEffect } from 'react';
import { soundFx } from '../../utils/audio';
import { Droplets, CheckCircle, RotateCcw, X, Sparkles } from 'lucide-react';

interface WaterNetworkPuzzleProps {
  onSolve: () => void;
  onClose: () => void;
}

interface Valve {
  id: string;
  name: string;
  stage: string;
  angle: number; // 0: Closed / Misaligned, 90: Open / Aligned
  targetAngle: number;
}

export const WaterNetworkPuzzle: React.FC<WaterNetworkPuzzleProps> = ({ onSolve, onClose }) => {
  // 2 valves start already perfectly aligned, leaving only 2 quick 1-click alignments!
  const [valves, setValves] = useState<Valve[]>([
    { id: 'v1', name: 'Monsoon Sluice Gate A', stage: 'Stormwater Intake', angle: 90, targetAngle: 90 },
    { id: 'v2', name: 'Sediment Siphon B', stage: 'Coarse Grit Separation', angle: 0, targetAngle: 90 },
    { id: 'v3', name: 'Bio-Sponge Aquifer Intake', stage: 'Subterranean Absorption', angle: 90, targetAngle: 90 },
    { id: 'v4', name: 'UV Purification Polishing Sluice', stage: 'Clean Potable Reserve', angle: 0, targetAngle: 90 },
  ]);

  const [waterLevel, setWaterLevel] = useState(65);
  const [pressure, setPressure] = useState(2.6);
  const [isSolved, setIsSolved] = useState(false);

  // Evaluate alignment
  useEffect(() => {
    const alignedCount = valves.filter(v => v.angle % 360 === v.targetAngle).length;
    const progress = Math.round((alignedCount / valves.length) * 100);

    setWaterLevel(65 + Math.round((progress / 100) * 35));
    setPressure(Number((2.6 - (progress / 100) * 1.2).toFixed(1)));

    if (alignedCount === valves.length && !isSolved) {
      setIsSolved(true);
      soundFx.playPuzzleSuccess();
      setTimeout(() => {
        onSolve();
      }, 1200);
    }
  }, [valves, isSolved, onSolve]);

  const handleTurnValve = (id: string) => {
    if (isSolved) return;
    soundFx.playPuzzleRotate();
    setValves(prev =>
      prev.map(v => (v.id === id ? { ...v, angle: (v.angle + 90) % 360 } : v))
    );
  };

  const handleAutoAlign = () => {
    soundFx.playClick();
    setValves(prev =>
      prev.map(v => ({ ...v, angle: 90 }))
    );
  };

  const handleReset = () => {
    soundFx.playClick();
    setValves([
      { id: 'v1', name: 'Monsoon Sluice Gate A', stage: 'Stormwater Intake', angle: 90, targetAngle: 90 },
      { id: 'v2', name: 'Sediment Siphon B', stage: 'Coarse Grit Separation', angle: 0, targetAngle: 90 },
      { id: 'v3', name: 'Bio-Sponge Aquifer Intake', stage: 'Subterranean Absorption', angle: 90, targetAngle: 90 },
      { id: 'v4', name: 'UV Purification Polishing Sluice', stage: 'Clean Potable Reserve', angle: 0, targetAngle: 90 },
    ]);
  };

  return (
    <div className="puzzle-modal-backdrop" onClick={onClose}>
      <div className="puzzle-modal-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="puzzle-header">
          <div className="puzzle-title-group">
            <span className="puzzle-eyebrow">SECTOR 02 // YAMUNA ECO-RESERVOIR</span>
            <h3 className="puzzle-title">Closed-Loop Sponge Hydrology &amp; Sluice Routing</h3>
          </div>
          <button className="puzzle-close-btn" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Description */}
        <p className="puzzle-desc">
          Click the misaligned sluice valves once to rotate them into the open horizontal flow position (90°). Stages 1 and 3 are already locked in!
        </p>

        {/* Telemetry Bar */}
        <div className="puzzle-status-bar">
          <div className="puzzle-status-item">
            <span className="puzzle-status-label">Aquifer Reserve</span>
            <span className="puzzle-status-value color-cyan">{waterLevel}% (4.5M Litres Captured)</span>
          </div>
          <div className="puzzle-status-item">
            <span className="puzzle-status-label">Drainage System Pressure</span>
            <span className={`puzzle-status-value ${pressure <= 1.8 ? 'color-good' : 'color-amber'}`}>
              {pressure} Bar {pressure <= 1.8 ? '(Nominal Flow)' : '(Slight Siphon Resistance)'}
            </span>
          </div>
        </div>

        {/* Quick Hint & Auto-Align Card */}
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
              <span>Tap Stage 02 and Stage 04 once each to open the sponge waterway!</span>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleAutoAlign}
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
              Auto-Align (1-Click)
            </button>
          </div>
        )}

        {/* Interactive Hydraulic Manifold */}
        <div className="water-valves-grid">
          {valves.map((valve, idx) => {
            const isAligned = valve.angle % 360 === valve.targetAngle;
            return (
              <div
                key={valve.id}
                className={`valve-card ${isAligned ? 'aligned' : ''}`}
                style={{
                  border: isAligned ? '1.5px solid rgba(53, 211, 153, 0.6)' : '1.5px solid rgba(236, 72, 153, 0.5)',
                  boxShadow: !isAligned ? '0 0 10px rgba(236, 72, 153, 0.2)' : undefined,
                }}
              >
                <div className="valve-card-header">
                  <span className="valve-stage-tag" style={{ color: isAligned ? '#35d399' : '#ec4899' }}>
                    Stage 0{idx + 1}
                  </span>
                  <span className="valve-stage-name">{valve.stage}</span>
                </div>

                <div className="valve-graphic-wrap">
                  <button
                    type="button"
                    className="valve-wheel-btn"
                    onClick={() => handleTurnValve(valve.id)}
                    style={{
                      transform: `rotate(${valve.angle}deg)`,
                      transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    title={`Click to turn ${valve.name}`}
                  >
                    <svg viewBox="0 0 80 80" width="80" height="80">
                      <circle cx="40" cy="40" r="32" fill="#1e293b" stroke={isAligned ? '#35d399' : '#ec4899'} strokeWidth="4" />
                      {/* Valve Spokes */}
                      <line x1="40" y1="8" x2="40" y2="72" stroke={isAligned ? '#35d399' : '#94a3b8'} strokeWidth="5" strokeLinecap="round" />
                      <line x1="8" y1="40" x2="72" y2="40" stroke={isAligned ? '#35d399' : '#94a3b8'} strokeWidth="5" strokeLinecap="round" />
                      {/* Center Hub */}
                      <circle cx="40" cy="40" r="10" fill={isAligned ? '#35d399' : '#64748b'} />
                      {/* Flow directional arrow */}
                      <polygon points="40,12 36,22 44,22" fill={isAligned ? '#ffffff' : '#ec4899'} />
                    </svg>
                  </button>
                </div>

                <div className="valve-meta">
                  <span className="valve-title">{valve.name}</span>
                  <span className={`valve-status ${isAligned ? 'color-good' : 'color-amber'}`}>
                    {isAligned ? '✓ Sluice Open (100% Flow)' : '⚡ Needs 1 Click to Open'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Success Banner */}
        {isSolved && (
          <div className="puzzle-success-banner">
            <CheckCircle size={20} className="color-good" />
            <span>AQUIFER RECHARGED! Monsoon storm volume safely captured in subterranean sponge cells.</span>
          </div>
        )}

        {/* Footer */}
        <div className="puzzle-footer">
          <button className="btn btn-ghost btn-sm" onClick={handleReset} type="button">
            <RotateCcw size={14} style={{ marginRight: '6px' }} />
            Reset Valves
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onClose} type="button">
            Exit Terminal
          </button>
        </div>
      </div>
    </div>
  );
};
