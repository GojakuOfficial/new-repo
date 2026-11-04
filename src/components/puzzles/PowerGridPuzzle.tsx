import React, { useState, useEffect } from 'react';
import { soundFx } from '../../utils/audio';
import { Zap, RotateCw, CheckCircle, X, Sparkles, HelpCircle } from 'lucide-react';

interface PowerGridPuzzleProps {
  onSolve: () => void;
  onClose: () => void;
}

type PipeType = 'I' | 'L' | 'T' | '+';

interface Tile {
  id: number;
  r: number;
  c: number;
  type: PipeType;
  rotation: number; // 0, 90, 180, 270
  isPowered: boolean;
  isKeyNode?: boolean;
}

// Direction offsets: 0: Up, 1: Right, 2: Down, 3: Left
const DIR_OFFSETS: [number, number][] = [
  [-1, 0], // Up
  [0, 1],  // Right
  [1, 0],  // Down
  [0, -1], // Left
];

// Openings for each tile type at rotation = 0
const BASE_OPENINGS: Record<PipeType, number[]> = {
  'I': [0, 2],       // Up & Down
  'L': [0, 1],       // Up & Right
  'T': [0, 1, 3],    // Up, Right, Left
  '+': [0, 1, 2, 3], // All 4 directions
};

export const PowerGridPuzzle: React.FC<PowerGridPuzzleProps> = ({ onSolve, onClose }) => {
  const rows = 3;
  const cols = 4;

  // Initialize a streamlined puzzle where only 2 junction nodes need a quick 90° rotation
  const [tiles, setTiles] = useState<Tile[]>(() => {
    const initialTypes: PipeType[][] = [
      ['L', 'T', 'L', 'I'],
      ['I', 'I', '+', 'I'], // Main power line on row 1
      ['L', 'I', 'T', 'L'],
    ];

    // Main line at row 1:
    // (1,0) 'I' at 90 deg -> opens Right (1) & Left (3). Power enters from left! (ALREADY ALIGNED)
    // (1,1) 'I' at 0 deg -> opens Up & Down. (NEEDS 1 CLICK to 90 deg to align!)
    // (1,2) '+' at 0 deg -> opens all 4 directions! (ALREADY ALIGNED)
    // (1,3) 'I' at 0 deg -> opens Up & Down. (NEEDS 1 CLICK to 90 deg to connect to exit bus!)
    const initialRotations: number[][] = [
      [90, 0, 0, 90],
      [90, 0, 0, 0], // Only (1,1) and (1,3) need a quick click!
      [180, 90, 270, 0],
    ];

    const result: Tile[] = [];
    let id = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isKey = r === 1 && (c === 1 || c === 3);
        result.push({
          id: id++,
          r,
          c,
          type: initialTypes[r][c],
          rotation: initialRotations[r][c],
          isPowered: false,
          isKeyNode: isKey,
        });
      }
    }
    return result;
  });

  const [isSolved, setIsSolved] = useState(false);
  const [loadPercentage, setLoadPercentage] = useState(50);
  const [showHint, setShowHint] = useState(true);

  const getTileOpenings = (tile: Tile): number[] => {
    const base = BASE_OPENINGS[tile.type];
    const steps = (tile.rotation / 90) % 4;
    return base.map(dir => (dir + steps) % 4);
  };

  // Run Breadth-First-Search from Power Inlet at (1, 0)
  useEffect(() => {
    const grid: (Tile | undefined)[][] = Array.from({ length: rows }, () => Array(cols).fill(undefined));
    tiles.forEach(t => {
      grid[t.r][t.c] = t;
    });

    const poweredSet = new Set<number>();
    const queue: [number, number][] = [];

    // Power Source enters at (1, 0) from the Left (direction 3)
    const startTile = grid[1][0];
    if (startTile) {
      const openings = getTileOpenings(startTile);
      if (openings.includes(3)) {
        poweredSet.add(startTile.id);
        queue.push([1, 0]);
      }
    }

    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      const current = grid[r][c]!;
      const currentOpenings = getTileOpenings(current);

      currentOpenings.forEach(dir => {
        const [dr, dc] = DIR_OFFSETS[dir];
        const nr = r + dr;
        const nc = c + dc;

        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          const neighbor = grid[nr][nc];
          if (neighbor && !poweredSet.has(neighbor.id)) {
            const neighborOpenings = getTileOpenings(neighbor);
            const oppositeDir = (dir + 2) % 4;
            if (neighborOpenings.includes(oppositeDir)) {
              poweredSet.add(neighbor.id);
              queue.push([nr, nc]);
            }
          }
        }
      });
    }

    // Check if Exit at (1, cols - 1) is powered and connects to the Right (direction 1)
    const exitTile = grid[1][cols - 1];
    const exitConnected = exitTile && poweredSet.has(exitTile.id) && getTileOpenings(exitTile).includes(1);

    // Update powered states on tiles
    setTiles(prev =>
      prev.map(t => ({
        ...t,
        isPowered: poweredSet.has(t.id),
      }))
    );

    const activeCount = poweredSet.size;
    const load = exitConnected ? 100 : Math.max(50, Math.round((activeCount / 4) * 100));
    setLoadPercentage(load);

    if (exitConnected && !isSolved) {
      setIsSolved(true);
      soundFx.playPuzzleSuccess();
      setTimeout(() => {
        onSolve();
      }, 1200);
    }
  }, [tiles, isSolved, onSolve]);

  const handleTileClick = (tileId: number) => {
    if (isSolved) return;
    soundFx.playPuzzleRotate();
    setTiles(prev =>
      prev.map(t => {
        if (t.id === tileId) {
          return {
            ...t,
            rotation: (t.rotation + 90) % 360,
          };
        }
        return t;
      })
    );
  };

  const handleQuickAlign = () => {
    soundFx.playClick();
    // Auto align the two key nodes (1,1) and (1,3) to horizontal (90 deg)
    setTiles(prev =>
      prev.map(t => {
        if (t.r === 1 && (t.c === 1 || t.c === 3)) {
          return { ...t, rotation: 90 };
        }
        return t;
      })
    );
  };

  const handleReset = () => {
    soundFx.playClick();
    setTiles(prev =>
      prev.map(t => {
        if (t.r === 1 && (t.c === 1 || t.c === 3)) {
          return { ...t, rotation: 0 };
        }
        return t;
      })
    );
  };

  return (
    <div className="puzzle-modal-backdrop" onClick={onClose}>
      <div className="puzzle-modal-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="puzzle-header">
          <div className="puzzle-title-group">
            <span className="puzzle-eyebrow">SECTOR 01 // CLEAN GRID SUBSTATION</span>
            <h3 className="puzzle-title">High-Voltage Circuit Conduit Alignment</h3>
          </div>
          <button className="puzzle-close-btn" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Objective Briefing */}
        <p className="puzzle-desc">
          Click the marked conduit nodes to rotate them into alignment. Connect the left <strong>Solar BESS Feed</strong> straight across the arterial line to the right <strong>Substation Transformer Bus</strong>.
        </p>

        {/* Status Indicators */}
        <div className="puzzle-status-bar">
          <div className="puzzle-status-item">
            <span className="puzzle-status-label">Grid Load Capacity</span>
            <span className={`puzzle-status-value ${isSolved ? 'color-good' : 'color-cyan'}`}>
              {loadPercentage}% {isSolved ? 'Synchronized' : 'Stabilizing'}
            </span>
          </div>
          <div className="puzzle-status-item">
            <span className="puzzle-status-label">Transformer Bus</span>
            <span className={`puzzle-status-value ${isSolved ? 'color-good' : 'color-amber'}`}>
              {isSolved ? 'ONLINE (120 MWh Active)' : 'ALIGNMENT NEEDED (2 Clicks)'}
            </span>
          </div>
        </div>

        {/* Quick Hint Card */}
        {showHint && !isSolved && (
          <div style={{
            background: 'rgba(168, 85, 247, 0.12)',
            border: '1px solid rgba(168, 85, 247, 0.35)',
            borderRadius: '8px',
            padding: '0.6rem 0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginBottom: '0.75rem',
            fontSize: '0.8rem',
            color: '#fff',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={16} color="#ec4899" />
              <span>Rotate the highlighted center conduits horizontally to complete the power circuit!</span>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleQuickAlign}
              style={{
                background: 'linear-gradient(135deg, #a855f7, #ec4899)',
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

        {/* Interactive Circuit Grid */}
        <div className="circuit-grid-wrapper">
          {/* Power In Indicator */}
          <div className="grid-port-label port-left connected">
            <Zap size={20} className="color-cyan" style={{ filter: 'drop-shadow(0 0 6px #28d9ec)' }} />
            <span>SOLAR BESS IN</span>
          </div>

          <div
            className="circuit-board"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: '8px',
            }}
          >
            {tiles.map(tile => {
              const isHighlight = tile.isKeyNode && !tile.isPowered;
              return (
                <button
                  key={tile.id}
                  type="button"
                  className={`circuit-tile ${tile.isPowered ? 'powered' : ''}`}
                  onClick={() => handleTileClick(tile.id)}
                  style={{
                    position: 'relative',
                    borderColor: isHighlight ? 'rgba(236, 72, 153, 0.8)' : undefined,
                    boxShadow: isHighlight ? '0 0 12px rgba(236, 72, 153, 0.4)' : undefined,
                  }}
                  title={`Click to rotate conduit (${tile.r}, ${tile.c})`}
                >
                  {isHighlight && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '2px',
                        right: '4px',
                        fontSize: '0.55rem',
                        color: '#ec4899',
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      ROTATE
                    </span>
                  )}
                  <div
                    className="tile-wire-graphic"
                    style={{
                      transform: `rotate(${tile.rotation}deg)`,
                      transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    <CircuitGraphic type={tile.type} isPowered={tile.isPowered} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Power Out Indicator */}
          <div className={`grid-port-label port-right ${isSolved ? 'connected' : ''}`}>
            <span>SUBSTATION BUS</span>
            <Zap size={20} className={isSolved ? 'color-good' : 'color-muted'} style={{ filter: isSolved ? 'drop-shadow(0 0 8px #35d399)' : undefined }} />
          </div>
        </div>

        {/* Victory Notification Banner */}
        {isSolved && (
          <div className="puzzle-success-banner">
            <CheckCircle size={20} className="color-good" />
            <span>SUBSTATION RESTORED! Solid-state transformers synchronized across the metropolitan grid.</span>
          </div>
        )}

        {/* Actions Footer */}
        <div className="puzzle-footer">
          <button className="btn btn-ghost btn-sm" onClick={handleReset} type="button">
            <RotateCw size={14} style={{ marginRight: '6px' }} />
            Reset Conduits
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onClose} type="button">
            Exit Terminal
          </button>
        </div>
      </div>
    </div>
  );
};

// SVG Renderer for Circuit Node Geometry
const CircuitGraphic: React.FC<{ type: PipeType; isPowered: boolean }> = ({ type, isPowered }) => {
  const color = isPowered ? '#38bdf8' : '#64748b';
  const glow = isPowered ? 'drop-shadow(0 0 8px #38bdf8)' : 'none';

  return (
    <svg viewBox="0 0 60 60" width="100%" height="100%" style={{ filter: glow }}>
      {/* Node Center Junction */}
      <circle cx="30" cy="30" r="7" fill={isPowered ? '#a855f7' : color} />

      {/* Up Line */}
      {(type === 'I' || type === 'L' || type === 'T' || type === '+') && (
        <rect x="26" y="0" width="8" height="30" fill={color} rx="3" />
      )}

      {/* Right Line */}
      {(type === 'L' || type === 'T' || type === '+') && (
        <rect x="30" y="26" width="30" height="8" fill={color} rx="3" />
      )}

      {/* Down Line */}
      {(type === 'I' || type === '+') && (
        <rect x="26" y="30" width="8" height="30" fill={color} rx="3" />
      )}

      {/* Left Line */}
      {(type === 'T' || type === '+') && (
        <rect x="0" y="26" width="30" height="8" fill={color} rx="3" />
      )}
    </svg>
  );
};
