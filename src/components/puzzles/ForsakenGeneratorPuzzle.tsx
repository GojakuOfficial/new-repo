import React, { useState, useEffect, useRef, useCallback } from 'react';
import { soundFx } from '../../utils/audio';
import {
  Zap,
  Droplets,
  Car,
  Wind,
  ShieldAlert,
  CheckCircle2,
  X,
  Sparkles,
  Flame,
  Activity,
  Wrench,
  Gauge,
  Cable,
  FastForward,
} from 'lucide-react';

export type SectorType = 'substation' | 'reservoir' | 'traffic' | 'environment' | 'emergency';

interface ForsakenGeneratorPuzzleProps {
  sector: SectorType;
  onSolve: () => void;
  onClose: () => void;
  crisisTimeLeft?: number;
  cityStability?: number;
}

interface SectorConfig {
  name: string;
  code: string;
  subtitle: string;
  color: string;
  accentBg: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  flavorText: string;
}

const SECTOR_CONFIGS: Record<SectorType, SectorConfig> = {
  substation: {
    name: 'SECTOR 1: POWER GRID GENERATOR',
    code: 'GEN-ALPHA-01',
    subtitle: 'Primary Solar & BESS Dynamo Core',
    color: '#00f0ff',
    accentBg: 'rgba(0, 240, 255, 0.12)',
    icon: Zap,
    flavorText: 'Align dynamo magnetic timing or snap phase conduits to ignite the city power bus.',
  },
  reservoir: {
    name: 'SECTOR 2: HYDRO PRESSURE GENERATOR',
    code: 'GEN-HYDRO-02',
    subtitle: 'Sponge Aquifer Subterranean Pump',
    color: '#38bdf8',
    accentBg: 'rgba(56, 189, 248, 0.12)',
    icon: Droplets,
    flavorText: 'Rebalance hydraulic turbine timing to drain flash-flood runoff into sponge retention beds.',
  },
  traffic: {
    name: 'SECTOR 3: TRAFFIC RELAY GENERATOR',
    code: 'GEN-RELAY-03',
    subtitle: 'CBD Transit Synchronization Hub',
    color: '#34d399',
    accentBg: 'rgba(52, 211, 153, 0.12)',
    icon: Car,
    flavorText: 'Synchronize fiber arterial frequencies to restore uninterrupted green-wave transit.',
  },
  environment: {
    name: 'SECTOR 4: BIO-SCRUBBER GENERATOR',
    code: 'GEN-SCRUB-04',
    subtitle: 'Atmospheric PM2.5 Ultrasonic Scrubber',
    color: '#f59e0b',
    accentBg: 'rgba(245, 158, 11, 0.12)',
    icon: Wind,
    flavorText: 'Restart harmonic acoustic transducers to dissolve toxic particulate plumes.',
  },
  emergency: {
    name: 'SECTOR 5: TRAUMA BACKUP GENERATOR',
    code: 'GEN-TRAUMA-05',
    subtitle: 'Hospital Emergency Microgrid Lifeline',
    color: '#ef4444',
    accentBg: 'rgba(239, 68, 68, 0.12)',
    icon: ShieldAlert,
    flavorText: 'Prime diesel-solid fuel backup starter to guarantee uninterrupted surgical ward power.',
  },
};

export const ForsakenGeneratorPuzzle: React.FC<ForsakenGeneratorPuzzleProps> = ({
  sector,
  onSolve,
  onClose,
  crisisTimeLeft = 180,
  cityStability = 85,
}) => {
  const config = SECTOR_CONFIGS[sector] || SECTOR_CONFIGS.substation;
  const SectorIcon = config.icon;

  // Active repair mode: 'dial' (Forsaken skill check) or 'wires' (3-wire snap)
  const [activeTab, setActiveTab] = useState<'dial' | 'wires'>('dial');

  // Generator overall repair progress: 0% to 100%
  const [progress, setProgress] = useState<number>(0);
  const [isSolved, setIsSolved] = useState<boolean>(false);
  const [hitsNeeded, setHitsNeeded] = useState<number>(2); // Only 2 hits to complete!
  const [hitsCompleted, setHitsCompleted] = useState<number>(0);

  // Real-time telemetry formatting
  const crisisMin = Math.floor(crisisTimeLeft / 60).toString().padStart(2, '0');
  const crisisSec = (crisisTimeLeft % 60).toString().padStart(2, '0');
  const crisisTimerFormatted = `${crisisMin}:${crisisSec}`;
  const isUrgent = crisisTimeLeft <= 35;

  // Skill Check Dial State
  // Needle angle in degrees: 0 to 360
  const [needleAngle, setNeedleAngle] = useState<number>(0);
  // Target success zone in degrees: large 80° window! (e.g., from 140° to 220°)
  const zoneStart = 140;
  const zoneEnd = 220;
  const greatStart = 170;
  const greatEnd = 190;

  // Audio ding played indicator to avoid multiple dings in one revolution
  const dingPlayedRef = useRef<boolean>(false);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; color: string } | null>(null);

  // Wire Game State (3 wires: Red, Blue, Yellow)
  const [wires, setWires] = useState<
    Array<{ id: string; name: string; color: string; hex: string; connected: boolean }>
  >([
    { id: 'w1', name: 'Phase Alpha (Red)', color: 'red', hex: '#ef4444', connected: false },
    { id: 'w2', name: 'Phase Beta (Blue)', color: 'blue', hex: '#38bdf8', connected: false },
    { id: 'w3', name: 'Phase Gamma (Yellow)', color: 'yellow', hex: '#fbbf24', connected: false },
  ]);
  const [selectedWire, setSelectedWire] = useState<string | null>(null);

  // Clear feedback message after a delay
  const triggerFeedback = (text: string, color: string) => {
    setFeedbackMsg({ text, color });
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 1200);
  };

  // Complete generator repair
  const finishRepair = useCallback(() => {
    if (isSolved) return;
    setIsSolved(true);
    setProgress(100);
    soundFx.playGeneratorFixed();
    triggerFeedback('GENERATOR ONLINE // 100%', '#10b981');

    setTimeout(() => {
      onSolve();
    }, 850);
  }, [isSolved, onSolve]);

  // Skill check dial animation loop
  useEffect(() => {
    if (isSolved) return;

    const loop = (now: number) => {
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      setNeedleAngle((prev) => {
        // Rotating at ~120 degrees per second (takes ~3s per loop, very easy to time)
        const next = (prev + 130 * dt) % 360;

        // Play warning ding ~25° before entering zone
        if (next >= zoneStart - 30 && next <= zoneStart - 10) {
          if (!dingPlayedRef.current) {
            soundFx.playSkillCheckDing();
            dingPlayedRef.current = true;
          }
        } else if (next > zoneEnd || next < zoneStart - 40) {
          dingPlayedRef.current = false;
        }

        return next;
      });

      animFrameRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isSolved, zoneStart, zoneEnd]);

  // Handle skill check trigger (Spacebar or on-screen tap)
  const handleSkillCheck = useCallback(() => {
    if (isSolved) return;

    const angle = needleAngle;
    const isGreat = angle >= greatStart && angle <= greatEnd;
    const isGood = angle >= zoneStart && angle <= zoneEnd;

    if (isGreat || isGood) {
      soundFx.playSkillCheckHit(isGreat);
      const newHits = hitsCompleted + 1;
      setHitsCompleted(newHits);

      const nextProg = Math.min(100, Math.round((newHits / hitsNeeded) * 100));
      setProgress(nextProg);

      if (isGreat) {
        triggerFeedback('CRITICAL HIT! GREAT! (+50%)', '#fbbf24');
      } else {
        triggerFeedback('SUCCESS! GOOD! (+50%)', '#10b981');
      }

      if (newHits >= hitsNeeded || nextProg >= 100) {
        finishRepair();
      }
    } else {
      // Missed: gentle puff, no harsh penalty, just an instant second try
      soundFx.playSkillCheckMiss();
      triggerFeedback('MISSED! (TRY AGAIN)', '#f87171');
    }
  }, [isSolved, needleAngle, greatStart, greatEnd, zoneStart, zoneEnd, hitsCompleted, hitsNeeded, finishRepair]);

  // Spacebar hotkey listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleSkillCheck();
      } else if (e.code === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSkillCheck, onClose]);

  // Handle 3-Wire Connect
  const handleWireClick = (wireId: string) => {
    if (isSolved) return;
    soundFx.playWireSnap();

    setWires((prev) => {
      const updated = prev.map((w) => (w.id === wireId ? { ...w, connected: true } : w));
      const connectedCount = updated.filter((w) => w.connected).length;
      const wireProg = Math.round((connectedCount / 3) * 100);
      setProgress(wireProg);

      triggerFeedback(`WIRE CONNECTED (${connectedCount}/3)`, '#38bdf8');

      if (connectedCount === 3) {
        finishRepair();
      }
      return updated;
    });
  };

  // Instant 1-click bypass
  const handleInstantOverride = () => {
    soundFx.playSkillCheckHit(true);
    setWires((prev) => prev.map((w) => ({ ...w, connected: true })));
    setHitsCompleted(hitsNeeded);
    finishRepair();
  };

  // SVG parameters for the circular skill check dial
  const dialRadius = 110;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * dialRadius;

  // Convert angles to SVG dashoffset
  // Arc length for zone: (80 / 360) * circumference
  const zoneArcLength = ((zoneEnd - zoneStart) / 360) * circumference;
  const greatArcLength = ((greatEnd - greatStart) / 360) * circumference;

  return (
    <div
      className="cyber-terminal-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        background: 'radial-gradient(ellipse at 50% 50%, rgba(5, 12, 24, 0.76) 0%, rgba(2, 6, 14, 0.88) 100%)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
      }}
    >
      <div
        className="cyber-terminal-card"
        style={{
          width: '100%',
          maxWidth: '580px',
          background: 'linear-gradient(180deg, rgba(11, 20, 36, 0.94) 0%, rgba(4, 9, 18, 0.98) 100%)',
          border: `1.5px solid ${config.color}88`,
          boxShadow: `0 0 45px ${config.color}25, 0 25px 60px rgba(0,0,0,0.85)`,
          borderRadius: '14px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          color: '#fff',
        }}
      >
        {/* Animated Cyber Telemetry Corner Brackets */}
        <div className="cyber-bracket cyber-bracket-tl" style={{ borderColor: config.color }} />
        <div className="cyber-bracket cyber-bracket-tr" style={{ borderColor: config.color }} />
        <div className="cyber-bracket cyber-bracket-bl" style={{ borderColor: config.color }} />
        <div className="cyber-bracket cyber-bracket-br" style={{ borderColor: config.color }} />

        {/* TOP LIVE TELEMETRY STRIP (Crisis Countdown & City Stability) */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.45)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '0.45rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.72rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <span style={{ color: config.color, fontWeight: 700, letterSpacing: '0.08em' }}>
              NEXUS-OS // IMMERSIVE FIELD LINK
            </span>
            <span
              style={{
                background: isUrgent ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0, 240, 255, 0.15)',
                color: isUrgent ? '#ef4444' : '#00f0ff',
                border: `1px solid ${isUrgent ? 'rgba(239, 68, 68, 0.4)' : 'rgba(0, 240, 255, 0.3)'}`,
                padding: '0.1rem 0.5rem',
                borderRadius: '4px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: isUrgent ? '#ef4444' : '#00f0ff',
                  boxShadow: `0 0 6px ${isUrgent ? '#ef4444' : '#00f0ff'}`,
                  animation: 'pulse 1s infinite alternate',
                }}
              />
              CRISIS TIME: {crisisTimerFormatted}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.55)', fontSize: '0.68rem' }}>
              STABILITY:
            </span>
            <span
              style={{
                color: cityStability > 60 ? '#10b981' : cityStability > 30 ? '#f59e0b' : '#ef4444',
                fontWeight: 800,
              }}
            >
              {Math.round(cityStability)}%
            </span>
          </div>
        </div>

        {/* MODAL HEADER */}
        <div
          style={{
            padding: '0.9rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: config.accentBg,
                border: `1px solid ${config.color}88`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: config.color,
                boxShadow: `0 0 15px ${config.color}33`,
              }}
            >
              <SectorIcon size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: config.color,
                    textTransform: 'uppercase',
                  }}
                >
                  {config.code}
                </span>
                <span
                  style={{
                    fontSize: '0.65rem',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    fontWeight: 600,
                  }}
                >
                  ONLINE OVERLAY
                </span>
              </div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  color: '#f9fafb',
                  letterSpacing: '0.02em',
                }}
              >
                {config.name}
              </h3>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Quick 1-Click Instant Bypass for zero friction */}
            <button
              type="button"
              onClick={handleInstantOverride}
              title="Skip puzzle and solve instantly"
              style={{
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                color: '#fbbf24',
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <FastForward size={13} />
              AUTO-FIX
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Exit terminal (Esc)"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: 'rgba(255, 255, 255, 0.75)',
                cursor: 'pointer',
                padding: '0.3rem 0.6rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 700,
              }}
            >
              <span style={{ fontSize: '0.62rem', opacity: 0.6 }}>ESC</span>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* GENERATOR PROGRESS METER */}
        <div
          style={{
            padding: '0.85rem 1.25rem 0.5rem 1.25rem',
            background: 'rgba(0, 0, 0, 0.3)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.4rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={14} color={progress === 100 ? '#10b981' : config.color} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: '#9ca3af' }}>
                GENERATOR REPAIR PROGRESS
              </span>
            </div>
            <span
              style={{
                fontSize: '0.95rem',
                fontWeight: 800,
                color: progress === 100 ? '#10b981' : config.color,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {progress}%
            </span>
          </div>

          {/* Glowing segmented progress bar */}
          <div
            style={{
              height: '10px',
              width: '100%',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '5px',
              overflow: 'hidden',
              position: 'relative',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background:
                  progress === 100
                    ? 'linear-gradient(90deg, #10b981, #34d399)'
                    : `linear-gradient(90deg, ${config.color}, #38bdf8)`,
                boxShadow: `0 0 12px ${progress === 100 ? '#10b981' : config.color}`,
                transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </div>

          {/* Quick instructions subtitle */}
          <p
            style={{
              margin: '0.45rem 0 0.1rem 0',
              fontSize: '0.78rem',
              color: '#94a3b8',
              lineHeight: 1.35,
            }}
          >
            {config.flavorText}
          </p>
        </div>

        {/* REPAIR MODE TABS */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '0.5rem 1.25rem 0 1.25rem',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('dial')}
            style={{
              flex: 1,
              padding: '0.45rem',
              borderRadius: '8px 8px 0 0',
              border: 'none',
              background: activeTab === 'dial' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              borderBottom: activeTab === 'dial' ? `2px solid ${config.color}` : '2px solid transparent',
              color: activeTab === 'dial' ? '#fff' : '#6b7280',
              fontSize: '0.78rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
            }}
          >
            <Gauge size={14} color={activeTab === 'dial' ? config.color : '#6b7280'} />
            FORSAKEN SKILL CHECK (SPACE)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('wires')}
            style={{
              flex: 1,
              padding: '0.45rem',
              borderRadius: '8px 8px 0 0',
              border: 'none',
              background: activeTab === 'wires' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              borderBottom: activeTab === 'wires' ? `2px solid ${config.color}` : '2px solid transparent',
              color: activeTab === 'wires' ? '#fff' : '#6b7280',
              fontSize: '0.78rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
            }}
          >
            <Cable size={14} color={activeTab === 'wires' ? config.color : '#6b7280'} />
            3-WIRE QUICK SNAP
          </button>
        </div>

        {/* PUZZLE INTERACTIVE BODY */}
        <div
          style={{
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '270px',
            position: 'relative',
          }}
        >
          {/* FLOATING SUCCESS/MISS BANNER */}
          {feedbackMsg && (
            <div
              style={{
                position: 'absolute',
                top: '12px',
                zIndex: 20,
                padding: '0.35rem 1rem',
                borderRadius: '8px',
                background: 'rgba(3, 7, 18, 0.95)',
                border: `1.5px solid ${feedbackMsg.color}`,
                boxShadow: `0 0 16px ${feedbackMsg.color}66`,
                color: feedbackMsg.color,
                fontWeight: 800,
                fontSize: '0.85rem',
                letterSpacing: '0.06em',
                pointerEvents: 'none',
                animation: 'pulse 0.2s ease',
              }}
            >
              {feedbackMsg.text}
            </div>
          )}

          {/* TAB 1: FORSAKEN SKILL CHECK CIRCULAR DIAL */}
          {activeTab === 'dial' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
              }}
            >
              {/* CIRCULAR SKILL CHECK SVG GAUGE */}
              <div
                style={{
                  position: 'relative',
                  width: '260px',
                  height: '260px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="260"
                  height="260"
                  viewBox="0 0 260 260"
                  style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}
                >
                  {/* Outer track */}
                  <circle
                    cx="130"
                    cy="130"
                    r={dialRadius}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeWidth={strokeWidth}
                  />

                  {/* GREEN SUCCESS ZONE (Huge 80° window, ultra easy to hit!) */}
                  <circle
                    cx="130"
                    cy="130"
                    r={dialRadius}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${zoneArcLength} ${circumference}`}
                    strokeDashoffset={-((zoneStart / 360) * circumference)}
                    strokeLinecap="round"
                    style={{
                      filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.6))',
                    }}
                  />

                  {/* GOLD GREAT ZONE (In the middle) */}
                  <circle
                    cx="130"
                    cy="130"
                    r={dialRadius}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth={strokeWidth + 2}
                    strokeDasharray={`${greatArcLength} ${circumference}`}
                    strokeDashoffset={-((greatStart / 360) * circumference)}
                    style={{
                      filter: 'drop-shadow(0 0 10px rgba(251, 191, 36, 0.8))',
                    }}
                  />
                </svg>

                {/* ROTATING NEEDLE */}
                <div
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    transform: `rotate(${needleAngle}deg)`,
                    transition: 'none',
                  }}
                >
                  {/* Needle arm */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '20px',
                      left: 'calc(50% - 2.5px)',
                      width: '5px',
                      height: '110px',
                      background: 'linear-gradient(to top, #ffffff, #ef4444)',
                      borderRadius: '3px',
                      boxShadow: '0 0 12px #ef4444, 0 0 4px #ffffff',
                    }}
                  />
                  {/* Needle tip indicator diamond */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      left: 'calc(50% - 6px)',
                      width: '12px',
                      height: '12px',
                      background: '#ef4444',
                      transform: 'rotate(45deg)',
                      boxShadow: '0 0 10px #ef4444',
                    }}
                  />
                </div>

                {/* CENTER HUB */}
                <div
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, #1f2937 0%, #111827 100%)',
                    border: '3px solid rgba(255, 255, 255, 0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 20px rgba(0,0,0,0.8), inset 0 0 10px rgba(0,0,0,0.5)',
                    zIndex: 5,
                  }}
                >
                  <Wrench size={22} color={config.color} />
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#e5e7eb', marginTop: '2px' }}>
                    {hitsCompleted}/{hitsNeeded} HITS
                  </span>
                </div>
              </div>

              {/* ACTION TRIGGER BUTTON (Big, tactile, supports both Spacebar and Touch/Click) */}
              <div style={{ marginTop: '0.85rem', width: '100%', maxWidth: '340px' }}>
                <button
                  type="button"
                  onClick={handleSkillCheck}
                  disabled={isSolved}
                  style={{
                    width: '100%',
                    padding: '0.85rem 1.25rem',
                    borderRadius: '12px',
                    background: isSolved
                      ? 'rgba(16, 185, 129, 0.2)'
                      : `linear-gradient(135deg, ${config.color} 0%, #2563eb 100%)`,
                    border: isSolved ? '1px solid #10b981' : 'none',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '1rem',
                    letterSpacing: '0.05em',
                    boxShadow: isSolved ? 'none' : `0 0 20px ${config.color}55`,
                    cursor: isSolved ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.6rem',
                    transition: 'transform 0.08s ease, filter 0.15s ease',
                  }}
                  onMouseDown={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)';
                  }}
                  onMouseUp={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                  }}
                >
                  {isSolved ? (
                    <>
                      <CheckCircle2 size={20} color="#10b981" />
                      GENERATOR SYNCHRONIZED
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      TAP / PRESS [SPACE] IN ZONE
                    </>
                  )}
                </button>
                <div
                  style={{
                    textAlign: 'center',
                    marginTop: '0.4rem',
                    fontSize: '0.72rem',
                    color: '#6b7280',
                  }}
                >
                  Target the huge green zone · 2 quick hits repairs the entire sector!
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 3-WIRE QUICK SNAP (Literal 3 clicks = 100% Solved!) */}
          {activeTab === 'wires' && (
            <div
              style={{
                width: '100%',
                maxWidth: '420px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
              }}
            >
              <div
                style={{
                  fontSize: '0.78rem',
                  color: '#9ca3af',
                  textAlign: 'center',
                  marginBottom: '0.2rem',
                }}
              >
                Click each color-coded wire terminal to reconnect electrical feeds:
              </div>

              {wires.map((wire) => (
                <div
                  key={wire.id}
                  onClick={() => !wire.connected && handleWireClick(wire.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    background: wire.connected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                    border: `1.5px solid ${wire.connected ? '#10b981' : wire.hex}`,
                    cursor: wire.connected ? 'default' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        background: wire.hex,
                        boxShadow: `0 0 8px ${wire.hex}`,
                      }}
                    />
                    <span
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: wire.connected ? '#e5e7eb' : '#fff',
                      }}
                    >
                      {wire.name}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {wire.connected ? (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#10b981',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <CheckCircle2 size={15} /> CONNECTED
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: wire.hex,
                          background: 'rgba(255,255,255,0.06)',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '6px',
                        }}
                      >
                        CLICK TO SNAP
                      </span>
                    )}
                  </div>
                </div>
              ))}

              <div
                style={{
                  textAlign: 'center',
                  fontSize: '0.72rem',
                  color: '#6b7280',
                  marginTop: '0.2rem',
                }}
              >
                Connect all 3 wires to immediately ignite generator output (+100%).
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: progress === 100 ? '#10b981' : '#f59e0b',
                boxShadow: `0 0 6px ${progress === 100 ? '#10b981' : '#f59e0b'}`,
              }}
            />
            <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
              {progress === 100 ? 'Status: SYNCHRONIZED' : 'Status: REPAIR IN PROGRESS'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
            >
              Cancel / Exit
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleInstantOverride}
              style={{
                fontSize: '0.78rem',
                padding: '0.35rem 0.85rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
              }}
            >
              Complete Sector
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
