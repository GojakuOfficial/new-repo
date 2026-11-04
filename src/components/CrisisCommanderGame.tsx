import React, { useRef, useEffect, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import * as THREE from 'three';
import { GameMode, GameMetrics, ProtocolType, GameStats, PlayerControls, PlayerState } from '../types/game';
import { buildProceduralCity, City3DScene, SectorStation } from '../utils/cityBuilder3D';
import { createCharacterController, CharacterControllerInstance } from '../utils/characterController';
import { createThirdPersonCamera, ThirdPersonCameraInstance } from '../utils/thirdPersonCamera';
import { SpatialCollisionIndex } from '../utils/spatialCollisionIndex';
import { soundFx } from '../utils/audio';

// Forsaken-Style Generator Repair System
import { ForsakenGeneratorPuzzle, SectorType } from './puzzles/ForsakenGeneratorPuzzle';
import { Minimap } from './CircularMinimap';
import { ObjectiveTracker } from './ObjectiveTracker';

import {
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ShieldAlert,
  Zap,
  Droplets,
  Car,
  Wind,
  LifeBuoy,
  Award,
  CheckCircle2,
  Info,
  X,
  Compass,
  Crosshair,
  Lock,
  Timer,
  AlertTriangle,
} from 'lucide-react';

interface CrisisCommanderGameProps {
  onExploreCity?: () => void;
  isEmbedded?: boolean;
}

export const CrisisCommanderGame: React.FC<CrisisCommanderGameProps> = ({
  onExploreCity,
  isEmbedded = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const city3dRef = useRef<City3DScene | null>(null);
  const characterRef = useRef<CharacterControllerInstance | null>(null);
  const cameraControllerRef = useRef<ThirdPersonCameraInstance | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const requestSceneFrameRef = useRef<() => void>(() => {});
  const frameMetricsRef = useRef({ fps: 0, frameMs: 0 });

  // Game Lifecycle State
  const [gameMode, setGameMode] = useState<GameMode>('menu');
  const [timeLeft, setTimeLeft] = useState<number>(180);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isPointerLocked, setIsPointerLocked] = useState<boolean>(false);
  const [invertY, setInvertY] = useState<boolean>(false);
  const [invertX, setInvertX] = useState<boolean>(false);
  const [mouseSensitivity, setMouseSensitivity] = useState<number>(1.0);
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  const [performanceSnapshot, setPerformanceSnapshot] = useState({
    fps: 0, frameMs: 0, drawCalls: 0, triangles: 0, geometries: 0, textures: 0, heapMb: null as number | null,
  });

  // Active Puzzle Modal
  const [activePuzzle, setActivePuzzle] = useState<string | null>(null);
  const activePuzzleRef = useRef<string | null>(null);
  activePuzzleRef.current = activePuzzle;

  const gameModeRef = useRef<GameMode>(gameMode);
  gameModeRef.current = gameMode;

  // Fullscreen state listener and camera/canvas resolution sync
  useEffect(() => {
    const handleFsChange = () => {
      const active = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(active);

      // Multi-tick resolution sync ensures Three.js renderer and camera immediately adapt
      const syncResolution = () => {
        if (mountRef.current && city3dRef.current) {
          const w = active ? window.innerWidth : (mountRef.current.clientWidth || 800);
          const h = active ? window.innerHeight : (mountRef.current.clientHeight || 500);
          city3dRef.current.camera.aspect = w / h;
          city3dRef.current.camera.updateProjectionMatrix();
          city3dRef.current.renderer.setSize(w, h);
        }
      };

      syncResolution();
      setTimeout(syncResolution, 60);
      setTimeout(syncResolution, 180);
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  // Player State for HUD
  const [playerHudState, setPlayerHudState] = useState<PlayerState>({
    x: 0,
    y: 0,
    z: 14,
    yaw: 0,
    isGrounded: true,
    isSprinting: false,
    isMoving: false,
    actionState: 'idle',
  });
  const lastHudUpdateRef = useRef(0);

  // Camera Yaw for Compass
  const [cameraHeading, setCameraHeading] = useState<number>(0);

  // Sector Objectives
  const [sectorObjectives, setSectorObjectives] = useState<Record<string, boolean>>({
    substation: false,
    reservoir: false,
    traffic: false,
    environment: false,
    emergency: false,
  });

  // Nearby Station Prompt
  const [nearbyStation, setNearbyStation] = useState<SectorStation | null>(null);
  const nearbyStationRef = useRef<SectorStation | null>(null);

  // Metrics
  const [metrics, setMetrics] = useState<GameMetrics>({
    stability: 85,
    energy: 55,
    water: 50,
    traffic: 65,
    pollution: 62,
    compute: 100,
  });

  // Stats & End Screen
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    crisesResolved: 0,
    protocolsTriggered: 0,
    maxStability: 85,
    minStability: 85,
    citizensSaved: 10000000,
    rank: 'A',
  });

  // Notification Banner
  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'warn' | 'success' } | null>({
    message: 'NEXUS 2040: Third-person crisis exploration matrix online.',
    type: 'info',
  });

  const showNotification = useCallback((message: string, type: 'info' | 'warn' | 'success' = 'info') => {
    setNotification({ message, type });
    const timer = setTimeout(() => {
      setNotification(prev => (prev?.message === message ? null : prev));
    }, 4500);
    return () => clearTimeout(timer);
  }, []);

  // Controls input ref
  const controlsRef = useRef<PlayerControls>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
    interact: false,
  });

  // 1. Initialize 3D Engine, Character, and Follow Camera
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Build the procedural 3D city
    const cityScene = buildProceduralCity(container, {
      interactiveRaycasting: false,
      enableShadows: true,
      performanceMode: true,
    });
    city3dRef.current = cityScene;
    const collisionIndex = new SpatialCollisionIndex(cityScene.collisionBoxes);

    // Create the articulated cybernetic field engineer
    const character = createCharacterController(collisionIndex);
    character.setPosition(0, 0, 14);
    cityScene.scene.add(character.group);
    characterRef.current = character;

    // Create third-person follow camera
    const thirdPersonCamera = createThirdPersonCamera(cityScene.camera, container, collisionIndex);
    thirdPersonCamera.setInvertY(invertY);
    thirdPersonCamera.setInvertX(invertX);
    thirdPersonCamera.setSensitivity(0.0024 * mouseSensitivity);
    cameraControllerRef.current = thirdPersonCamera;

    // Render continuously during play, but render only one frame in menus, pauses,
    // puzzles, hidden tabs, and end screens.
    let lastTime = performance.now();
    let qualityScale = 1;
    let slowFrameSeconds = 0;
    let smoothFrameSeconds = 0;
    const renderLoop = (time: number) => {
      animFrameIdRef.current = null;
      const dt = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;
      const activePlay = gameModeRef.current === 'playing' && !activePuzzleRef.current && !document.hidden;

      if (activePlay) {
        const char = characterRef.current;
        const camCtrl = cameraControllerRef.current;
        if (char && camCtrl) {
          char.update(dt, controlsRef.current, camCtrl.getYaw());
          camCtrl.update(dt, char.state);
          cityScene.update(dt);

          let foundStation: SectorStation | null = null;
          for (let i = 0; i < cityScene.sectorStations.length; i++) {
            const station = cityScene.sectorStations[i];
            if (Math.hypot(char.state.x - station.terminalCoords[0], char.state.z - station.terminalCoords[2]) <= 8.5) {
              foundStation = station;
              break;
            }
          }
          if (nearbyStationRef.current?.id !== foundStation?.id) {
            nearbyStationRef.current = foundStation;
            setNearbyStation(foundStation);
          }

          if (time - lastHudUpdateRef.current >= 50) {
            setPlayerHudState({ ...char.state });
            setCameraHeading(camCtrl.getYaw());
            lastHudUpdateRef.current = time;
          }
        }

        if (dt > 1 / 43) {
          slowFrameSeconds += dt;
          smoothFrameSeconds = 0;
        } else if (dt < 1 / 58) {
          smoothFrameSeconds += dt;
          slowFrameSeconds = 0;
        } else {
          slowFrameSeconds = Math.max(0, slowFrameSeconds - dt * 0.5);
          smoothFrameSeconds = Math.max(0, smoothFrameSeconds - dt * 0.5);
        }
        if (slowFrameSeconds >= 2.5 && qualityScale > 0.65) {
          qualityScale = Math.max(0.65, qualityScale - 0.15);
          cityScene.setRenderScale(qualityScale);
          slowFrameSeconds = 0;
          smoothFrameSeconds = 0;
        } else if (smoothFrameSeconds >= 8 && qualityScale < 1) {
          qualityScale = Math.min(1, qualityScale + 0.1);
          cityScene.setRenderScale(qualityScale);
          smoothFrameSeconds = 0;
        }
      }

      cityScene.renderer.render(cityScene.scene, cityScene.camera);
      const instantFps = dt > 0 ? 1 / dt : 0;
      const previousMetrics = frameMetricsRef.current;
      frameMetricsRef.current = previousMetrics.fps > 0
        ? { fps: previousMetrics.fps * 0.75 + instantFps * 0.25, frameMs: previousMetrics.frameMs * 0.75 + dt * 1000 * 0.25 }
        : { fps: instantFps, frameMs: dt * 1000 };
      if (activePlay) animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    const requestSceneFrame = () => {
      if (animFrameIdRef.current === null && !document.hidden) {
        animFrameIdRef.current = requestAnimationFrame(renderLoop);
      }
    };
    requestSceneFrameRef.current = requestSceneFrame;
    const handleVisibilityChange = () => {
      if (document.hidden && animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      } else {
        requestSceneFrame();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    requestSceneFrame();

    // Resize Handler with Fullscreen detection
    const handleResize = () => {
      if (!container || !cityScene) return;
      const isFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      const w = isFs ? window.innerWidth : (container.clientWidth || 800);
      const h = isFs ? window.innerHeight : (container.clientHeight || 500);
      cityScene.camera.aspect = w / h;
      cityScene.camera.updateProjectionMatrix();
      cityScene.renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      requestSceneFrameRef.current = () => {};
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      animFrameIdRef.current = null;
      character.dispose();
      thirdPersonCamera.dispose();
      cityScene.dispose();
      city3dRef.current = null;
      characterRef.current = null;
      cameraControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    requestSceneFrameRef.current();
  }, [gameMode, activePuzzle]);

  useEffect(() => {
    if (!showPerformanceMonitor) return;
    const sample = () => {
      const renderer = city3dRef.current?.renderer;
      if (!renderer) return;
      const performanceWithMemory = performance as Performance & { memory?: { usedJSHeapSize: number } };
      setPerformanceSnapshot({
        ...frameMetricsRef.current,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        heapMb: performanceWithMemory.memory ? performanceWithMemory.memory.usedJSHeapSize / 1048576 : null,
      });
    };
    sample();
    const interval = window.setInterval(sample, 500);
    return () => window.clearInterval(interval);
  }, [showPerformanceMonitor]);

  // 2. Keyboard & Mouse Input Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'F3') {
        setShowPerformanceMonitor(value => !value);
        e.preventDefault();
        return;
      }
      if (activePuzzleRef.current) {
        if (e.key === 'Escape') {
          handleClosePuzzle();
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') controlsRef.current.forward = true;
      if (key === 's' || key === 'arrowdown') controlsRef.current.backward = true;
      if (key === 'a' || key === 'arrowleft') controlsRef.current.left = true;
      if (key === 'd' || key === 'arrowright') controlsRef.current.right = true;
      if (e.shiftKey) controlsRef.current.sprint = true;
      if (e.code === 'Space') {
        controlsRef.current.jump = true;
        e.preventDefault();
      }

      // Interact trigger
      if (key === 'e') {
        if (nearbyStation) {
          handleOpenStation(nearbyStation);
        }
      }

      // Pause menu
      if (e.key === 'Escape') {
        if (gameMode === 'playing') {
          setGameMode('paused');
          document.exitPointerLock?.();
        } else if (gameMode === 'paused') {
          setGameMode('playing');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') controlsRef.current.forward = false;
      if (key === 's' || key === 'arrowdown') controlsRef.current.backward = false;
      if (key === 'a' || key === 'arrowleft') controlsRef.current.left = false;
      if (key === 'd' || key === 'arrowright') controlsRef.current.right = false;
      if (!e.shiftKey) controlsRef.current.sprint = false;
      if (e.code === 'Space') controlsRef.current.jump = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === mountRef.current && cameraControllerRef.current) {
        cameraControllerRef.current.handleMouseMove(e.movementX, e.movementY);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (cameraControllerRef.current) {
        cameraControllerRef.current.handleWheel(e.deltaY);
      }
    };

    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement === mountRef.current;
      setIsPointerLocked(locked);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('wheel', handleWheel, { passive: true });
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('wheel', handleWheel);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, [gameMode, activePuzzle, nearbyStation]);

  // Request pointer lock on viewport click
  const handleViewportClick = () => {
    if (gameMode === 'playing' && !activePuzzle && mountRef.current) {
      mountRef.current.requestPointerLock?.();
    }
  };

  // Open interactive station terminal
  const handleOpenStation = (st: SectorStation) => {
    document.exitPointerLock?.();
    controlsRef.current = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      jump: false,
      interact: false,
    };
    soundFx.playInteract();

    if (st.id === 'core') {
      const solvedCount = Object.values(sectorObjectives).filter(Boolean).length;
      if (solvedCount >= 5) {
        // Trigger Victory
        handleVictory();
      } else {
        showNotification(
          `Central Arcology Core requires all 5 municipal sectors online. (${solvedCount}/5 secured)`,
          'warn'
        );
      }
      return;
    }

    setActivePuzzle(st.id);
  };

  const handleClosePuzzle = () => {
    setActivePuzzle(null);
    controlsRef.current = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      jump: false,
      interact: false,
    };
  };

  // Handle Puzzle Solve Callback
  const handlePuzzleSolved = (stationId: string) => {
    handleClosePuzzle();
    setSectorObjectives(prev => ({ ...prev, [stationId]: true }));

    if (city3dRef.current) {
      city3dRef.current.setSectorSolved(stationId, true);
    }

    // Boost metrics and add bonus crisis time
    setTimeLeft(prev => Math.min(180, prev + 20));
    setMetrics(prev => ({
      ...prev,
      stability: Math.min(100, prev.stability + 20),
      energy: stationId === 'substation' ? 95 : prev.energy,
      water: stationId === 'reservoir' ? 92 : prev.water,
      traffic: stationId === 'traffic' ? 24 : prev.traffic,
      pollution: stationId === 'environment' ? 38 : prev.pollution,
      compute: Math.min(100, prev.compute + 30),
    }));

    setStats(prev => ({
      ...prev,
      score: prev.score + 2500,
      crisesResolved: prev.crisesResolved + 1,
    }));

    showNotification(`SECTOR RESTORED: ${stationId.toUpperCase()} online! (+20s bonus time)`, 'success');

    // Check if all 5 are solved
    const nextSolved = { ...sectorObjectives, [stationId]: true };
    const allDone = Object.values(nextSolved).filter(Boolean).length >= 5;
    if (allDone) {
      showNotification('ALL 5 SECTORS SECURED! Proceed to the Central Arcology Core to harmonize.', 'success');
    }
  };

  // 120-Second Simulation Countdown & Stability Decay
  useEffect(() => {
    if (gameMode !== 'playing' || activePuzzle) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleDefeat('Crisis timer expired before full harmonization.');
          return 0;
        }
        return prev - 1;
      });

      // Passive stability decay if sectors remain unresolved
      const unresolvedCount = 5 - Object.values(sectorObjectives).filter(Boolean).length;
      if (unresolvedCount > 0) {
        setMetrics(prev => {
          const decay = unresolvedCount * 0.25;
          const newStability = Math.max(0, prev.stability - decay);
          if (newStability <= 0) {
            handleDefeat('Metropolitan stability collapsed to 0%.');
          }
          return {
            ...prev,
            stability: Math.round(newStability * 10) / 10,
          };
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [gameMode, activePuzzle, sectorObjectives]);

  // Victory Handler
  const handleVictory = () => {
    setGameMode('victory');
    document.exitPointerLock?.();
    soundFx.playVictory();

    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#28d9ec', '#35d399', '#f2a93b'],
    });
  };

  // Defeat Handler
  const handleDefeat = (reason: string) => {
    setGameMode('defeat');
    document.exitPointerLock?.();
    soundFx.playDefeat();
    showNotification(`MISSION FAILED: ${reason}`, 'warn');
  };

  // Start Simulation
  const handleStartGame = () => {
    soundFx.playClick();
    setGameMode('playing');
    setTimeLeft(180);
    setSectorObjectives({
      substation: false,
      reservoir: false,
      traffic: false,
      environment: false,
      emergency: false,
    });
    setMetrics({
      stability: 85,
      energy: 55,
      water: 50,
      traffic: 65,
      pollution: 62,
      compute: 100,
    });
    if (characterRef.current) {
      characterRef.current.setPosition(0, 0, 14);
    }

    // Launch game in genuine HTML5 fullscreen automatically where browser permissions allow
    const elem = containerRef.current;
    if (!document.fullscreenElement && !(document as any).webkitFullscreenElement && elem) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if ((elem as any).webkitRequestFullscreen) {
        (elem as any).webkitRequestFullscreen();
      }
    }

    try {
      mountRef.current?.requestPointerLock?.();
    } catch (_) {}
  };

  const handleRestart = () => {
    handleStartGame();
  };

  const handleExitGame = () => {
    setGameMode('menu');
    document.exitPointerLock?.();
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundFx.setMuted(!next);
  };

  const toggleFullscreen = () => {
    const elem = containerRef.current;
    const isCurrentlyFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
    if (!isCurrentlyFs) {
      if (elem?.requestFullscreen) {
        elem.requestFullscreen().catch(() => {
          setIsFullscreen(true);
        });
      } else if ((elem as any)?.webkitRequestFullscreen) {
        (elem as any).webkitRequestFullscreen();
      } else {
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any)?.webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  const toggleInvertY = () => {
    setInvertY(prev => {
      const next = !prev;
      cameraControllerRef.current?.setInvertY(next);
      return next;
    });
  };

  const toggleInvertX = () => {
    setInvertX(prev => {
      const next = !prev;
      cameraControllerRef.current?.setInvertX(next);
      return next;
    });
  };

  const changeSensitivity = (val: number) => {
    setMouseSensitivity(val);
    cameraControllerRef.current?.setSensitivity(0.0024 * val);
  };

  // Compass formatting
  const getCompassHeadingDegrees = () => {
    const deg = ((cameraHeading * 180) / Math.PI) % 360;
    return (deg + 360) % 360;
  };

  const solvedCount = Object.values(sectorObjectives).filter(Boolean).length;

  // Real-Time Countdown Timer formatting & visual states (180s total)
  const countdownMinutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const countdownSeconds = (timeLeft % 60).toString().padStart(2, '0');
  const countdownDisplay = `${countdownMinutes}:${countdownSeconds}`;
  const isEmergencyTime = timeLeft <= 30;
  const isWarningTime = timeLeft > 30 && timeLeft <= 60;
  const timerRingRadius = 20;
  const timerRingCircumference = 2 * Math.PI * timerRingRadius;
  const timerProgressFraction = Math.max(0, Math.min(1, timeLeft / 180));
  const timerRingDashoffset = timerRingCircumference * (1 - timerProgressFraction);

  return (
    <section id="game-section" className="page-section game-rebuild-section" style={{ paddingTop: '2.5rem' }}>
      <div className="container">
        {/* Section Lead */}
        <div className="section-eyebrow">THIRD-PERSON METROPOLITAN DEFENSE ADVENTURE</div>
        <h2 className="section-heading-lg">NEXUS 2040: Crisis Commander.</h2>
        <p className="section-subtext">
          Control India&rsquo;s autonomous cybernetic field engineer in real-time 3D. Explore the living city streets, navigate to active crisis beacons, and solve five critical engineering puzzles to restore stability before the 180-second crisis timer expires.
        </p>

        {/* Game Master Container */}
        <div ref={containerRef} className={`commander-viewport-frame ${isFullscreen ? 'is-fullscreen' : ''}`}>
          {/* Top Bar */}
          <div className="commander-topbar">
            <div className="topbar-left">
              <span className="commander-badge">NEXUS 2040 // CRISIS EXPLORER</span>
              <span className="live-pill">THIRD-PERSON 3D</span>
            </div>

            <div className="topbar-actions">
              <button
                className="btn btn-ghost btn-sm"
                onClick={toggleSound}
                type="button"
                title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
              >
                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                <span className="btn-label-text">{soundEnabled ? 'Audio ON' : 'Audio OFF'}</span>
              </button>

              <button
                className={`btn btn-ghost btn-sm ${isFullscreen ? 'btn-active' : ''}`}
                onClick={toggleFullscreen}
                type="button"
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen Mode'}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                <span className="btn-label-text">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
              </button>

              {gameMode === 'playing' && (
                <>
                  <button
                    className={`btn btn-ghost btn-sm ${invertY ? 'btn-active' : ''}`}
                    onClick={toggleInvertY}
                    type="button"
                    title="Toggle Inverted Mouse Look (Y-axis)"
                  >
                    <span>Invert Y: {invertY ? 'ON' : 'OFF'}</span>
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setGameMode('paused');
                      document.exitPointerLock?.();
                    }}
                    type="button"
                  >
                    Pause
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={handleExitGame}
                    type="button"
                  >
                    Exit
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 3D Scene Viewport Canvas */}
          <div
            ref={mountRef}
            className={`commander-canvas-stage ${isPointerLocked ? 'is-locked' : ''}`}
            onClick={handleViewportClick}
            aria-label="Interactive 3D Third-Person City Experience"
          >
            {/* Cinematic Film Vignette & Warm Golden Hour Grade Overlay */}
            <div
              className="cinematic-vignette-overlay"
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                boxShadow: 'inset 0 0 100px rgba(0, 0, 0, 0.5)',
                background: 'radial-gradient(ellipse at 50% 45%, rgba(255, 184, 122, 0.02) 0%, rgba(12, 20, 36, 0.12) 70%, rgba(4, 8, 16, 0.48) 100%)',
                zIndex: 2,
              }}
              aria-hidden="true"
            />

            {showPerformanceMonitor && gameMode === 'playing' && (
              <aside className="game-performance-monitor" aria-live="off" aria-label="Developer performance monitor">
                <strong>PERFORMANCE · F3</strong>
                <span>{performanceSnapshot.fps.toFixed(0)} FPS · {performanceSnapshot.frameMs.toFixed(1)} ms</span>
                <span>{performanceSnapshot.drawCalls} draw calls · {performanceSnapshot.triangles.toLocaleString()} triangles</span>
                <span>{performanceSnapshot.geometries} geometries · {performanceSnapshot.textures} textures</span>
                <span>Pixel ratio {city3dRef.current?.renderer.getPixelRatio().toFixed(2) ?? '—'}
                  {performanceSnapshot.heapMb === null ? '' : ` · JS heap ${performanceSnapshot.heapMb.toFixed(0)} MB`}
                </span>
              </aside>
            )}

            {/* Reticle / Crosshair */}
            {gameMode === 'playing' && !activePuzzle && isPointerLocked && (
              <div className="third-person-reticle" aria-hidden="true">
                <Crosshair size={18} />
              </div>
            )}

            {/* Click to Lock Mouse Prompt */}
            {gameMode === 'playing' && !activePuzzle && !isPointerLocked && (
              <div className="pointer-lock-overlay-prompt">
                <Lock size={16} style={{ marginRight: '6px' }} />
                <span>Click viewport to lock mouse cursor for 3D camera look (Esc to unlock)</span>
              </div>
            )}

            {/* Floating Interaction Prompt */}
            {gameMode === 'playing' && !activePuzzle && nearbyStation && (
              <div className="floating-interaction-prompt">
                <button
                  className="prompt-pill-btn"
                  onClick={() => handleOpenStation(nearbyStation)}
                  type="button"
                >
                  <span className="key-badge">E</span>
                  <span>{nearbyStation.promptLabel}</span>
                </button>
              </div>
            )}

            {/* GTA Vice City-Style Circular Minimap (Bottom-Left) */}
            {gameMode === 'playing' && (
              <div className={`hud-minimap-shell ${activePuzzle ? 'puzzle-open-dimmed' : ''}`}>
                <Minimap
                  playerX={playerHudState.x}
                  playerZ={playerHudState.z}
                  cameraYaw={cameraHeading}
                  stations={city3dRef.current?.sectorStations || []}
                  sectorObjectives={sectorObjectives}
                  activeStationId={
                    ['substation', 'reservoir', 'traffic', 'environment', 'emergency', 'core'].find(
                      id => !sectorObjectives[id]
                    ) || 'core'
                  }
                  onSelectStation={handleOpenStation}
                />
              </div>
            )}

            {/* Roblox-Inspired Objective Panel (Middle-Right) */}
            {gameMode === 'playing' && (
              <div className={`hud-objective-shell ${activePuzzle ? 'puzzle-open-dimmed' : ''}`}>
                <ObjectiveTracker
                  playerX={playerHudState.x}
                  playerZ={playerHudState.z}
                  cameraYaw={cameraHeading}
                  stations={city3dRef.current?.sectorStations || []}
                  sectorObjectives={sectorObjectives}
                  onSelectStation={handleOpenStation}
                  onOpenStation={handleOpenStation}
                />
              </div>
            )}

            {/* Top-Center Real-Time Countdown HUD & Compass Cluster */}
            {gameMode === 'playing' && (
              <div className="hud-top-center-cluster">
                {/* Prominent Real-Time Countdown Timer */}
                <div
                  className={`hud-countdown-timer ${
                    isEmergencyTime
                      ? 'timer-emergency'
                      : isWarningTime
                      ? 'timer-warning'
                      : 'timer-nominal'
                  }`}
                  role="timer"
                  aria-label={`Crisis countdown: ${countdownDisplay} remaining`}
                >
                  <div className="countdown-ring-wrapper">
                    <svg
                      className="countdown-svg-ring"
                      width="54"
                      height="54"
                      viewBox="0 0 54 54"
                      aria-hidden="true"
                    >
                      <circle
                        className="countdown-ring-track"
                        cx="27"
                        cy="27"
                        r={timerRingRadius}
                      />
                      <circle
                        className="countdown-ring-progress"
                        cx="27"
                        cy="27"
                        r={timerRingRadius}
                        style={{
                          strokeDasharray: timerRingCircumference,
                          strokeDashoffset: timerRingDashoffset,
                        }}
                      />
                    </svg>
                    <div className="countdown-icon-center" aria-hidden="true">
                      {isEmergencyTime ? (
                        <AlertTriangle size={18} className="urgent-warning-icon" />
                      ) : (
                        <Timer size={18} />
                      )}
                    </div>
                  </div>

                  <div className="countdown-content">
                    <div className="countdown-header-row">
                      <span className="countdown-title">CRISIS COUNTDOWN</span>
                      <span className="countdown-status-badge">
                        {isEmergencyTime
                          ? 'GRID COLLAPSE IMMINENT'
                          : isWarningTime
                          ? 'CRITICAL CASCADE'
                          : 'STABILIZATION WINDOW'}
                      </span>
                    </div>
                    <div className="countdown-digits-row">
                      <span className="countdown-digits">{countdownDisplay}</span>
                      <span className="countdown-unit">REMAINING</span>
                      <div className="countdown-pulse-beacon" aria-hidden="true" />
                    </div>
                  </div>
                </div>

                {/* 360° Compass Navigation Bar */}
                <div className="hud-compass-bar">
                  <div className="compass-cardinals">
                    <span>N</span>
                    <span>NE</span>
                    <span>E</span>
                    <span>SE</span>
                    <span>S</span>
                    <span>SW</span>
                    <span>W</span>
                    <span>NW</span>
                  </div>
                  <div className="compass-center-marker">
                    <Compass size={13} />
                    <span>{Math.round(getCompassHeadingDegrees())}°</span>
                  </div>
                </div>
              </div>
            )}

            {/* Stability & Time Gauges Top Left */}
            {gameMode === 'playing' && (
              <div className="hud-vitals-card">
                <div className="vital-row">
                  <span className="vital-label">CITY STABILITY</span>
                  <span
                    className={`vital-val ${
                      metrics.stability > 60 ? 'color-good' : metrics.stability > 30 ? 'color-amber' : 'color-critical'
                    }`}
                  >
                    {Math.round(metrics.stability)}%
                  </span>
                </div>
                <div className="vital-bar-track">
                  <div
                    className="vital-bar-fill"
                    style={{
                      width: `${metrics.stability}%`,
                      backgroundColor:
                        metrics.stability > 60
                          ? 'var(--green)'
                          : metrics.stability > 30
                          ? 'var(--amber)'
                          : 'var(--red)',
                    }}
                  />
                </div>

                <div className="vital-row" style={{ marginTop: '0.4rem' }}>
                  <span className="vital-label">CRISIS TIMER</span>
                  <span className={`vital-val ${timeLeft < 30 ? 'color-critical' : 'color-cyan'}`}>
                    {countdownDisplay}
                  </span>
                </div>
              </div>
            )}

            {/* Bottom Controls Legend Strip */}
            {gameMode === 'playing' && (
              <div className="hud-controls-helper">
                <span>[W][A][S][D] Move</span>
                <span>·</span>
                <span>[Mouse] Look</span>
                <span>·</span>
                <span>[Shift] Sprint</span>
                <span>·</span>
                <span>[Space] Jet Jump</span>
                <span>·</span>
                <span>[E] Interact</span>
                <span>·</span>
                <span>[Esc] Pause &amp; Settings</span>
              </div>
            )}
          </div>

          {/* MAIN MENU OVERLAY */}
          {gameMode === 'menu' && (
            <div className="commander-menu-overlay">
              <div className="menu-center-card">
                <span className="menu-kicker">AUTHENTICATED // CHIEF AI FIELD ENGINEER</span>
                <h1 className="menu-game-title">NEXUS 2040</h1>
                <h2 className="menu-game-subtitle">CRISIS COMMANDER: 3D ADVENTURE</h2>

                <p className="menu-brief">
                  You are deployed into the living streets of Nexus City. Ten million citizens depend on your field actions to restore five failing municipal sectors: power grid, sponge aquifers, traffic arteries, air quality, and trauma microgrids.
                </p>

                <div className="menu-specs-row">
                  <div className="menu-spec-box">
                    <span className="spec-big">180s</span>
                    <span className="spec-sub">Crisis Duration</span>
                  </div>
                  <div className="menu-spec-box">
                    <span className="spec-big">5 Puzzles</span>
                    <span className="spec-sub">Accessible Challenges</span>
                  </div>
                  <div className="menu-spec-box">
                    <span className="spec-big">Third-Person</span>
                    <span className="spec-sub">Controllable 3D Hero</span>
                  </div>
                </div>

                <div className="menu-buttons-group">
                  <button className="btn btn-primary btn-lg" onClick={handleStartGame} type="button">
                    <Play size={16} style={{ marginRight: '8px' }} />
                    INITIALIZE SIMULATION (PLAY FULLSCREEN)
                  </button>
                  <button className="btn btn-ghost btn-lg" onClick={() => setGameMode('instructions')} type="button">
                    <Info size={16} style={{ marginRight: '8px' }} />
                    Mission Briefing &amp; Controls
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* HOW TO PLAY MODAL */}
          {gameMode === 'instructions' && (
            <div className="commander-menu-overlay">
              <div className="modal-instructions-card">
                <div className="cc-modal-header">
                  <h3>Mission Briefing &amp; Operative Controls</h3>
                  <button className="btn-close" onClick={() => setGameMode('menu')} type="button">
                    <X size={18} />
                  </button>
                </div>

                <div className="instructions-body">
                  <div className="inst-section">
                    <h4>🕹️ Operative Controls</h4>
                    <p>
                      <strong>WASD / Arrow Keys</strong>: Move field engineer forward, backward, left, and right.
                      <br />
                      <strong>Mouse Look</strong>: Pointer-lock orbital third-person camera. Follows your character naturally with building collision avoidance.
                      <br />
                      <strong>Shift</strong>: Jetpack thruster sprint across metropolitan boulevards.
                      <br />
                      <strong>Space</strong>: Jet booster jump to hop over curbs and barriers.
                      <br />
                      <strong>E</strong>: Interact with infrastructure terminals when in proximity.
                    </p>
                  </div>

                  <div className="inst-section">
                    <h4>⚡ Forsaken-Style Sector Generators (Piss Easy &amp; Snappy)</h4>
                    <p>
                      Each sector terminal houses a high-power generator core inspired by Roblox <em>Forsaken</em>:
                      <br />
                      <strong>Mode 1 (Forsaken Skill Check)</strong>: Tap <code>[SPACE]</code> or click the button when the needle enters the large green zone. Only 2 quick hits needed!
                      <br />
                      <strong>Mode 2 (3-Wire Quick Snap)</strong>: Click each colored wire (Red, Blue, Yellow) to immediately snap electrical feeds in 3 quick clicks.
                      <br />
                      <strong>Instant Bypass</strong>: Need zero friction? Click <code>AUTO-FIX</code> to immediately synchronize the sector.
                    </p>
                  </div>
                </div>

                <div className="modal-footer">
                  <button className="btn btn-primary btn-md" onClick={handleStartGame} type="button">
                    Start Mission Now
                  </button>
                  <button className="btn btn-ghost btn-md" onClick={() => setGameMode('menu')} type="button">
                    Return to Menu
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PAUSE MENU */}
          {gameMode === 'paused' && (
            <div className="commander-menu-overlay">
              <div className="menu-center-card">
                <h3>SIMULATION PAUSED</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.2rem' }}>
                  City systems held in frozen state. Time remaining: {timeLeft}s.
                </p>

                {/* Control Preferences Card */}
                <div style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  padding: '1rem',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  textAlign: 'left'
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    🎮 Camera &amp; Mouse Control Preferences
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Invert Pitch (Y-Axis):</span>
                    <button
                      type="button"
                      className={`btn btn-sm ${invertY ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={toggleInvertY}
                    >
                      {invertY ? 'INVERTED' : 'NORMAL (Standard)'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Invert Yaw (X-Axis):</span>
                    <button
                      type="button"
                      className={`btn btn-sm ${invertX ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={toggleInvertX}
                    >
                      {invertX ? 'INVERTED' : 'NORMAL (Standard)'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Mouse Look Sensitivity:</span>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      {[0.6, 1.0, 1.5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={`btn btn-sm ${mouseSensitivity === s ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => changeSensitivity(s)}
                          style={{ minWidth: '42px', padding: '0.2rem 0.5rem' }}
                        >
                          {s === 0.6 ? 'Low' : s === 1.0 ? 'Med' : 'High'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Display Mode:</span>
                    <button
                      type="button"
                      className={`btn btn-sm ${isFullscreen ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={toggleFullscreen}
                    >
                      {isFullscreen ? 'FULLSCREEN ACTIVE (Toggle)' : 'WINDOWED (Go Fullscreen)'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  <button
                    className="btn btn-primary btn-md"
                    onClick={() => {
                      setGameMode('playing');
                      setTimeout(() => {
                        mountRef.current?.requestPointerLock?.();
                      }, 200);
                    }}
                    type="button"
                  >
                    Resume Exploration
                  </button>
                  <button className="btn btn-ghost btn-md" onClick={handleRestart} type="button">
                    Restart Simulation
                  </button>
                  <button className="btn btn-danger btn-md" onClick={handleExitGame} type="button">
                    Exit to Website
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VICTORY SCREEN */}
          {gameMode === 'victory' && (
            <div className="commander-menu-overlay">
              <div className="menu-center-card">
                <span className="menu-kicker color-good">METROPOLITAN HARMONIZATION ACHIEVED</span>
                <h1 className="menu-game-title" style={{ color: 'var(--green)' }}>
                  VICTORY
                </h1>
                <p className="menu-brief">
                  You successfully resolved all five municipal crises and harmonized the Central Arcology Core! All 10,000,000 citizens are secure, clean energy is balanced, and closed-loop sponge aquifers are full.
                </p>

                <div className="menu-specs-row">
                  <div className="menu-spec-box">
                    <span className="spec-big color-good">10,000,000</span>
                    <span className="spec-sub">Citizens Protected</span>
                  </div>
                  <div className="menu-spec-box">
                    <span className="spec-big color-cyan">{stats.score}</span>
                    <span className="spec-sub">Triage Score</span>
                  </div>
                  <div className="menu-spec-box">
                    <span className="spec-big color-good">RANK S+</span>
                    <span className="spec-sub">Command Rating</span>
                  </div>
                </div>

                <div className="menu-buttons-group">
                  <button className="btn btn-primary btn-lg" onClick={handleRestart} type="button">
                    <RotateCcw size={16} style={{ marginRight: '8px' }} />
                    PLAY AGAIN
                  </button>
                  {onExploreCity && (
                    <button className="btn btn-ghost btn-lg" onClick={onExploreCity} type="button">
                      Inspect 3D Twin
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* DEFEAT SCREEN */}
          {gameMode === 'defeat' && (
            <div className="commander-menu-overlay">
              <div className="menu-center-card">
                <span className="menu-kicker color-critical">METROPOLITAN INFRASTRUCTURE FAILURE</span>
                <h1 className="menu-game-title" style={{ color: 'var(--red)' }}>
                  DEFEAT
                </h1>
                <p className="menu-brief">
                  Metropolitan stability collapsed before all municipal crises could be resolved. Electrical brownouts and flash-floods overwhelmed city safety buffers.
                </p>

                <div className="menu-buttons-group">
                  <button className="btn btn-primary btn-lg" onClick={handleRestart} type="button">
                    <RotateCcw size={16} style={{ marginRight: '8px' }} />
                    RETRY SIMULATION
                  </button>
                  <button className="btn btn-ghost btn-lg" onClick={() => setGameMode('menu')} type="button">
                    Return to Main Menu
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ACTIVE PUZZLE MODALS (FORSAKEN-STYLE GENERATOR SYSTEM) */}
          {activePuzzle && activePuzzle !== 'core' && (
            <ForsakenGeneratorPuzzle
              sector={activePuzzle as SectorType}
              onSolve={() => handlePuzzleSolved(activePuzzle)}
              onClose={handleClosePuzzle}
              crisisTimeLeft={timeLeft}
              cityStability={metrics.stability}
            />
          )}
        </div>
      </div>
    </section>
  );
};
