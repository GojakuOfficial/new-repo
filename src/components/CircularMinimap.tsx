import React, { useRef, useEffect } from 'react';
import { SectorStation } from '../utils/cityBuilder3D';

interface CircularMinimapProps {
  playerX: number;
  playerZ: number;
  cameraYaw: number;
  stations: SectorStation[];
  sectorObjectives: Record<string, boolean>;
  activeStationId?: string | null;
  onSelectStation?: (station: SectorStation) => void;
}

export const Minimap: React.FC<CircularMinimapProps> = ({
  playerX,
  playerZ,
  cameraYaw,
  stations,
  sectorObjectives,
  activeStationId,
  onSelectStation,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 8; // radar radius inside bezel
    const worldScale = 1.35; // world units to minimap pixels

    ctx.clearRect(0, 0, size, size);

    // Save outer state before clipping
    ctx.save();

    // 1. Circular Radar Clipping Area
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.clip();

    // Radar Background (Deep Cyberpunk Navy)
    ctx.fillStyle = '#050c18';
    ctx.fillRect(0, 0, size, size);

    // Subtle radar concentric range rings
    ctx.strokeStyle = 'rgba(40, 217, 236, 0.12)';
    ctx.lineWidth = 1;
    [0.35, 0.7, 1.0].forEach(factor => {
      ctx.beginPath();
      ctx.arc(center, center, radius * factor, 0, Math.PI * 2);
      ctx.stroke();
    });

    // 2. World Coordinate Transform (Rotates with Player Camera Heading)
    ctx.save();
    ctx.translate(center, center);
    // Rotate world so player forward (+Z in camera space) faces UP (-Y on canvas)
    ctx.rotate(-cameraYaw);

    // Road definitions matching cityBuilder3D:
    // Vertical roads at X = -45, 0, 45 (width ~9)
    // Horizontal roads at Z = -30, 30 (width ~9)
    const drawWorldRoad = (x: number, z: number, w: number, h: number) => {
      const rx = (x - playerX) * worldScale;
      const rz = (z - playerZ) * worldScale;
      const rw = w * worldScale;
      const rh = h * worldScale;
      ctx.fillStyle = 'rgba(26, 38, 57, 0.85)';
      ctx.fillRect(rx - rw / 2, rz - rh / 2, rw, rh);

      // Road edge border
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx - rw / 2, rz - rh / 2, rw, rh);
    };

    // Draw main roads
    [-45, 0, 45].forEach(rx => {
      drawWorldRoad(rx, 0, 11, 200);
    });
    [-30, 30].forEach(rz => {
      drawWorldRoad(0, rz, 220, 11);
    });

    // Draw Yamuna Eco-Reservoir water basin (at X = -68, Z = 60, size 24x24)
    const waterRelX = (-68 - playerX) * worldScale;
    const waterRelZ = (60 - playerZ) * worldScale;
    ctx.fillStyle = 'rgba(6, 182, 212, 0.45)';
    ctx.fillRect(waterRelX - 12 * worldScale, waterRelZ - 12 * worldScale, 24 * worldScale, 24 * worldScale);
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.8)';
    ctx.strokeRect(waterRelX - 12 * worldScale, waterRelZ - 12 * worldScale, 24 * worldScale, 24 * worldScale);

    // Draw Park Grass at X = 68, Z = 60, size 24x24
    const parkRelX = (68 - playerX) * worldScale;
    const parkRelZ = (60 - playerZ) * worldScale;
    ctx.fillStyle = 'rgba(20, 83, 45, 0.45)';
    ctx.fillRect(parkRelX - 12 * worldScale, parkRelZ - 12 * worldScale, 24 * worldScale, 24 * worldScale);

    // Draw CBD Towers footprint at X = -20, Z = -60
    const cbdRelX = (-20 - playerX) * worldScale;
    const cbdRelZ = (-60 - playerZ) * worldScale;
    ctx.fillStyle = 'rgba(168, 85, 247, 0.25)';
    ctx.fillRect(cbdRelX - 16 * worldScale, cbdRelZ - 16 * worldScale, 32 * worldScale, 32 * worldScale);

    // Draw Hospital footprint at X = -68, Z = 0
    const hospRelX = (-68 - playerX) * worldScale;
    const hospRelZ = (0 - playerZ) * worldScale;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.fillRect(hospRelX - 12 * worldScale, hospRelZ - 12 * worldScale, 24 * worldScale, 24 * worldScale);

    // Restore un-rotated radar canvas context for blips & player drawing
    ctx.restore();

    // 3. Draw Station Blips with Clamping to Radar Rim (Vice City Style)
    stations.forEach(st => {
      // Station relative to player in world coordinates
      const dx = st.terminalCoords[0] - playerX;
      const dz = st.terminalCoords[2] - playerZ;

      // Rotate vector by -cameraYaw so it matches radar screen orientation
      const rotAngle = -cameraYaw;
      const cosA = Math.cos(rotAngle);
      const sinA = Math.sin(rotAngle);
      const screenDx = (dx * cosA - dz * sinA) * worldScale;
      const screenDz = (dx * sinA + dz * cosA) * worldScale;

      const dist = Math.hypot(screenDx, screenDz);
      const isSolved = !!sectorObjectives[st.id];
      const isTarget = activeStationId === st.id;

      // Color scheme for blip
      let blipColor = isSolved ? '#34d399' : isTarget ? '#f59e0b' : '#38bdf8';
      if (st.id === 'emergency') blipColor = isSolved ? '#34d399' : '#ef4444';
      if (st.id === 'environment') blipColor = isSolved ? '#34d399' : '#10b981';
      if (st.id === 'core') blipColor = isSolved ? '#34d399' : '#a855f7';

      let blipX: number;
      let blipY: number;

      if (dist <= radius - 10) {
        // Inside radar
        blipX = center + screenDx;
        blipY = center + screenDz;
      } else {
        // Clamped to radar rim
        const clampRadius = radius - 12;
        const angle = Math.atan2(screenDz, screenDx);
        blipX = center + Math.cos(angle) * clampRadius;
        blipY = center + Math.sin(angle) * clampRadius;

        // Draw small direction arrow tick on rim for distant targets
        ctx.save();
        ctx.translate(blipX, blipY);
        ctx.rotate(angle);
        ctx.fillStyle = blipColor;
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-4, -4);
        ctx.lineTo(-4, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Draw blip marker
      ctx.beginPath();
      ctx.arc(blipX, blipY, isTarget ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = blipColor;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Pulsing beacon ring for targeted objective
      if (isTarget && !isSolved) {
        const pulse = (Date.now() % 1200) / 1200;
        ctx.beginPath();
        ctx.arc(blipX, blipY, 6 + pulse * 8, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(245, 158, 11, ${1 - pulse})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // 4. Center Player Marker (GTA Style: Triangle arrow pointing up)
    ctx.save();
    ctx.translate(center, center);
    // Draw subtle field of view cone in front of player
    ctx.fillStyle = 'rgba(40, 217, 236, 0.15)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 36, -Math.PI / 2 - Math.PI / 6, -Math.PI / 2 + Math.PI / 6);
    ctx.closePath();
    ctx.fill();

    // Player arrow (Pointing UP because world rotates around player)
    ctx.fillStyle = '#28d9ec';
    ctx.beginPath();
    ctx.moveTo(0, -9); // nose
    ctx.lineTo(6, 6);  // bottom right
    ctx.lineTo(0, 2);  // inner notch
    ctx.lineTo(-6, 6); // bottom left
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();

    // End clipping
    ctx.restore();

    // 5. GTA: Vice City Style Bezel & Chrome Trim Ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(center, center, radius + 2, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.7)'; // Cyberpunk Magenta/Purple Rim
    ctx.stroke();

    // Cardinal tick marks on the bezel
    const cardinalLabels = [
      { text: 'N', angle: -cameraYaw - Math.PI / 2 },
      { text: 'E', angle: -cameraYaw },
      { text: 'S', angle: -cameraYaw + Math.PI / 2 },
      { text: 'W', angle: -cameraYaw + Math.PI },
    ];

    cardinalLabels.forEach(({ text, angle }) => {
      const tx = center + Math.cos(angle) * (radius - 1);
      const ty = center + Math.sin(angle) * (radius - 1);
      ctx.fillStyle = text === 'N' ? '#ff5d5d' : 'rgba(255, 255, 255, 0.75)';
      ctx.font = 'bold 9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, tx, ty);
    });

    ctx.restore();
  }, [playerX, playerZ, cameraYaw, stations, sectorObjectives, activeStationId]);

  return (
    <div className="gta-minimap-container" aria-label="GTA-style Circular Metropolitan Radar">
      <div className="gta-minimap-header">
        <span className="gta-radar-dot"></span>
        <span className="gta-radar-title">LUMINA RADAR // VC-40</span>
      </div>
      <div className="gta-minimap-frame">
        <canvas ref={canvasRef} width={160} height={160} className="gta-minimap-canvas" />
      </div>
      <div className="gta-minimap-footer">
        <span className="gta-coords-text">
          X: {Math.round(playerX)} · Z: {Math.round(playerZ)}
        </span>
      </div>
    </div>
  );
};
