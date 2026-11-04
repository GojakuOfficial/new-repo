import React, { useState } from 'react';
import { SectorStation } from '../utils/cityBuilder3D';
import { Zap, Droplets, Car, Wind, ShieldAlert, Cpu, CheckCircle2, ChevronRight, ChevronDown, Navigation2, Compass } from 'lucide-react';

interface ObjectiveTrackerProps {
  playerX: number;
  playerZ: number;
  cameraYaw: number;
  stations: SectorStation[];
  sectorObjectives: Record<string, boolean>;
  onSelectStation: (station: SectorStation) => void;
  onOpenStation: (station: SectorStation) => void;
}

export const ObjectiveTracker: React.FC<ObjectiveTrackerProps> = ({
  playerX,
  playerZ,
  cameraYaw,
  stations,
  sectorObjectives,
  onSelectStation,
  onOpenStation,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Ordered progression of 5 sector missions followed by Core
  const priorityOrder = ['substation', 'reservoir', 'traffic', 'environment', 'emergency', 'core'];

  // Find next active objective
  const nextActiveId = priorityOrder.find(id => !sectorObjectives[id]) || 'core';
  const targetStation = stations.find(s => s.id === nextActiveId);

  // Calculate distance & directional angle to target
  let distanceMeters = 0;
  let relativeAngleDeg = 0;

  if (targetStation) {
    const dx = targetStation.terminalCoords[0] - playerX;
    const dz = targetStation.terminalCoords[2] - playerZ;
    distanceMeters = Math.round(Math.hypot(dx, dz));

    // World angle to target
    const worldAngle = Math.atan2(dx, -dz);
    // Relative to camera yaw
    const relAngle = worldAngle - cameraYaw;
    relativeAngleDeg = ((relAngle * 180) / Math.PI + 360) % 360;
  }

  const solvedCount = Object.keys(sectorObjectives).filter(k => sectorObjectives[k] && k !== 'core').length;
  const allSectorsDone = solvedCount >= 5;

  const getStationIcon = (id: string, isDone: boolean) => {
    const className = isDone ? 'text-emerald-400' : 'text-cyan-400';
    switch (id) {
      case 'substation':
        return <Zap size={14} className={className} />;
      case 'reservoir':
        return <Droplets size={14} className={className} />;
      case 'traffic':
        return <Car size={14} className={className} />;
      case 'environment':
        return <Wind size={14} className={className} />;
      case 'emergency':
        return <ShieldAlert size={14} className={className} />;
      case 'core':
      default:
        return <Cpu size={14} className={className} />;
    }
  };

  const getMissionInstruction = (id: string) => {
    switch (id) {
      case 'substation':
        return 'Repair Sector 1 Power Generator (Hit 2 skill checks or snap 3 wires).';
      case 'reservoir':
        return 'Repair Sector 2 Hydro Generator (Hit 2 skill checks or snap 3 wires).';
      case 'traffic':
        return 'Repair Sector 3 Traffic Relay Generator (Hit 2 skill checks or snap 3 wires).';
      case 'environment':
        return 'Repair Sector 4 Bio-Scrubber Generator (Hit 2 skill checks or snap 3 wires).';
      case 'emergency':
        return 'Repair Sector 5 Trauma Backup Generator (Hit 2 skill checks or snap 3 wires).';
      case 'core':
      default:
        return 'All 5 generators online! Harmonize the Arcology Core to achieve victory.';
    }
  };

  return (
    <aside className="roblox-objective-panel" aria-label="Current Mission Objectives">
      {/* Top Header Card */}
      <div className="rop-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <div className="rop-header-left">
          <span className="rop-badge">ACTIVE MISSION</span>
          <span className="rop-count-badge">
            {allSectorsDone ? '5/5 SECURED' : `${solvedCount}/5 SECTORS`}
          </span>
        </div>
        <button
          className="rop-collapse-btn"
          type="button"
          aria-label={isCollapsed ? 'Expand Objective Tracker' : 'Collapse Objective Tracker'}
        >
          {isCollapsed ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="rop-body">
          {/* Main Primary Target Highlight Box */}
          {targetStation && (
            <div className="rop-primary-card">
              <div className="rop-primary-meta">
                <span className="rop-sector-tag">{targetStation.sector.toUpperCase()} PROTOCOL</span>
                <div className="rop-dist-badge">
                  <Navigation2
                    size={13}
                    style={{
                      transform: `rotate(${relativeAngleDeg}deg)`,
                      transition: 'transform 0.15s ease-out',
                      color: 'var(--cyan)',
                    }}
                  />
                  <span>{distanceMeters}m</span>
                </div>
              </div>

              <h4 className="rop-primary-title">{targetStation.name}</h4>
              <p className="rop-primary-instruction">
                {allSectorsDone && targetStation.id === 'core'
                  ? 'All 5 sectors stabilized! Proceed to the Arcology Core to finalize harmonization.'
                  : getMissionInstruction(targetStation.id)}
              </p>

              <button
                className="btn btn-sm btn-primary rop-direct-action"
                type="button"
                onClick={() => onOpenStation(targetStation)}
              >
                <span>🚀</span> Access Terminal ({distanceMeters}m)
              </button>
            </div>
          )}

          {/* Sub-objectives Checklist */}
          <div className="rop-checklist">
            <span className="rop-checklist-title">METROPOLITAN INFRASTRUCTURE</span>
            <div className="rop-items-container">
              {stations
                .filter(s => s.id !== 'core')
                .map(st => {
                  const isDone = !!sectorObjectives[st.id];
                  const isCurrent = targetStation?.id === st.id;

                  return (
                    <div
                      key={st.id}
                      className={`rop-item ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
                      onClick={() => onOpenStation(st)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="rop-item-left">
                        {isDone ? (
                          <CheckCircle2 size={14} className="rop-check-icon text-emerald-400" />
                        ) : (
                          getStationIcon(st.id, false)
                        )}
                        <span className="rop-item-name">{st.name}</span>
                      </div>
                      <span className="rop-item-status">
                        {isDone ? 'ONLINE' : isCurrent ? 'TARGET' : 'PENDING'}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
