import React, { useState, useEffect } from 'react';
import { soundFx } from '../../utils/audio';
import { CheckCircle, RotateCcw, X, HeartPulse, Sparkles } from 'lucide-react';

interface HospitalMicrogridPuzzleProps {
  onSolve: () => void;
  onClose: () => void;
}

interface HospitalSystem {
  id: string;
  name: string;
  minKw: number;
  allocatedKw: number;
  status: 'critical' | 'stable';
}

export const HospitalMicrogridPuzzle: React.FC<HospitalMicrogridPuzzleProps> = ({ onSolve, onClose }) => {
  // Generous microgrid capacity of 120 kW gives plenty of safety margin
  const maxMicrogridCapacity = 120; // kW

  // 2 systems start already satisfied, requiring only 2 gentle slider nudges to secure the hospital!
  const [systems, setSystems] = useState<HospitalSystem[]>([
    { id: 'icu', name: 'Trauma ICU & Life Support', minKw: 25, allocatedKw: 30, status: 'stable' },
    { id: 'surgery', name: 'Emergency Surgical Suites', minKw: 20, allocatedKw: 25, status: 'stable' },
    { id: 'evac', name: 'High-Speed Evacuation Lifts', minKw: 10, allocatedKw: 5, status: 'critical' },
    { id: 'iso', name: 'Negative-Pressure Isolation Ward', minKw: 15, allocatedKw: 10, status: 'critical' },
  ]);

  const [totalAllocated, setTotalAllocated] = useState(70);
  const [isOverloaded, setIsOverloaded] = useState(false);
  const [isSolved, setIsSolved] = useState(false);

  useEffect(() => {
    const total = systems.reduce((sum, s) => sum + s.allocatedKw, 0);
    setTotalAllocated(total);
    const overload = total > maxMicrogridCapacity;
    setIsOverloaded(overload);

    const allSatisfied = systems.every(s => s.allocatedKw >= s.minKw);

    // Any distribution where all meet their minimum and we are under budget wins!
    if (allSatisfied && !overload && !isSolved) {
      setIsSolved(true);
      soundFx.playPuzzleSuccess();
      setTimeout(() => {
        onSolve();
      }, 1200);
    }
  }, [systems, isSolved, onSolve]);

  const handleSliderChange = (id: string, val: number) => {
    if (isSolved) return;
    setSystems(prev =>
      prev.map(s => {
        if (s.id === id) {
          const isStable = val >= s.minKw;
          return {
            ...s,
            allocatedKw: val,
            status: isStable ? 'stable' : 'critical',
          };
        }
        return s;
      })
    );
  };

  const handleAutoBalance = () => {
    soundFx.playClick();
    setSystems([
      { id: 'icu', name: 'Trauma ICU & Life Support', minKw: 25, allocatedKw: 35, status: 'stable' },
      { id: 'surgery', name: 'Emergency Surgical Suites', minKw: 20, allocatedKw: 28, status: 'stable' },
      { id: 'evac', name: 'High-Speed Evacuation Lifts', minKw: 10, allocatedKw: 15, status: 'stable' },
      { id: 'iso', name: 'Negative-Pressure Isolation Ward', minKw: 15, allocatedKw: 20, status: 'stable' },
    ]);
  };

  const handleReset = () => {
    soundFx.playClick();
    setSystems([
      { id: 'icu', name: 'Trauma ICU & Life Support', minKw: 25, allocatedKw: 30, status: 'stable' },
      { id: 'surgery', name: 'Emergency Surgical Suites', minKw: 20, allocatedKw: 25, status: 'stable' },
      { id: 'evac', name: 'High-Speed Evacuation Lifts', minKw: 10, allocatedKw: 5, status: 'critical' },
      { id: 'iso', name: 'Negative-Pressure Isolation Ward', minKw: 15, allocatedKw: 10, status: 'critical' },
    ]);
  };

  return (
    <div className="puzzle-modal-backdrop" onClick={onClose}>
      <div className="puzzle-modal-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="puzzle-header">
          <div className="puzzle-title-group">
            <span className="puzzle-eyebrow">SECTOR 05 // APEX TRAUMA HOSPITAL</span>
            <h3 className="puzzle-title">Emergency Microgrid Energy Triage</h3>
          </div>
          <button className="puzzle-close-btn" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Description */}
        <p className="puzzle-desc">
          Ensure all four hospital lifelines meet their minimum emergency power requirements from the 120 kW microgrid reserve. Trauma ICU and Surgical Suites are already secure—just nudge Lifts (≥10 kW) and Isolation (≥15 kW)!
        </p>

        {/* Status */}
        <div className="puzzle-status-bar">
          <div className="puzzle-status-item">
            <span className="puzzle-status-label">Total Microgrid Load</span>
            <span
              className={`puzzle-status-value ${
                isOverloaded ? 'color-critical' : isSolved ? 'color-good' : 'color-cyan'
              }`}
            >
              {totalAllocated} / {maxMicrogridCapacity} kW {isOverloaded ? '(OVERLOAD)' : '(Reserve Available)'}
            </span>
          </div>
          <div className="puzzle-status-item">
            <span className="puzzle-status-label">Clinical Triage State</span>
            <span className={`puzzle-status-value ${isSolved ? 'color-good' : 'color-amber'}`}>
              {isSolved ? 'ALL LIFELINES SECURED (100%)' : '2 LIFELINES PENDING POWER'}
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
              <span>Slide Lifts to ≥10 kW and Isolation to ≥15 kW to stabilize!</span>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleAutoBalance}
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
              Auto-Triage (1-Click)
            </button>
          </div>
        )}

        {/* Systems Sliders */}
        <div className="hospital-systems-list">
          {systems.map(sys => {
            const meetsMin = sys.allocatedKw >= sys.minKw;
            return (
              <div
                key={sys.id}
                className={`hospital-sys-card ${meetsMin ? 'satisfied' : 'deficit'}`}
                style={{
                  border: meetsMin ? '1.5px solid rgba(53, 211, 153, 0.5)' : '1.5px solid rgba(236, 72, 153, 0.5)',
                  boxShadow: !meetsMin ? '0 0 10px rgba(236, 72, 153, 0.2)' : undefined,
                }}
              >
                <div className="sys-header-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HeartPulse size={16} className={meetsMin ? 'color-good' : 'color-amber'} />
                    <span className="sys-name">{sys.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`sys-kw-badge ${meetsMin ? 'color-good' : 'color-amber'}`}>
                      {meetsMin ? `✓ ${sys.allocatedKw} kW (Safe)` : `⚡ ${sys.allocatedKw} kW (Min: ${sys.minKw} kW)`}
                    </span>
                    {!meetsMin && (
                      <button
                        type="button"
                        onClick={() => handleSliderChange(sys.id, sys.minKw + 5)}
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
                        Nudge Safe
                      </button>
                    )}
                  </div>
                </div>

                <input
                  type="range"
                  min="0"
                  max="50"
                  value={sys.allocatedKw}
                  onChange={e => handleSliderChange(sys.id, parseInt(e.target.value, 10))}
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
            <span>HOSPITAL MICROGRID RESTORED! Trauma ICU and surgical lifelines fully secured.</span>
          </div>
        )}

        {/* Footer */}
        <div className="puzzle-footer">
          <button className="btn btn-ghost btn-sm" onClick={handleReset} type="button">
            <RotateCcw size={14} style={{ marginRight: '6px' }} />
            Reset Power Channels
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onClose} type="button">
            Exit Terminal
          </button>
        </div>
      </div>
    </div>
  );
};
