# Lumina City: Gameplay Immersion, True Fullscreen & Visibility Rendering Architecture

Upgrade the Lumina City 3D metropolitan experience into a standalone PC game feel with authentic browser fullscreen, non-intrusive in-world cyberpunk terminal puzzle overlays, and visibility-driven Three.js rendering optimizations (Frustum culling, distance-tiered LOD, spatial grid partitioning, and instanced batching) while preserving all gameplay systems, minimaps, and collision logic.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following design decisions were aligned during Phase 1 interactive clarification:
> - **Puzzle Presentation**: Cyberpunk semi-transparent holographic HUD overlay that centers on-screen over the live 3D city canvas with backdrop blur, tech telemetry brackets, and clear diagnostics.
> - **Mouse Pointer Lock**: Click game canvas to lock during active gameplay, press `Escape` to unlock (with clean separation between browser fullscreen and pointer lock states).
> - **Rendering Optimization Profile**: Balanced performance profile with high-detail center view, smooth distance LOD transitions, frustum culling, and spatial grid partition.

- **Confirmed Decision 1**: Fullscreen trigger via both the main "INITIALIZE SIMULATION" button and a dedicated fullscreen toggle icon control in the game topbar/HUD.
- **Confirmed Decision 2**: When in fullscreen mode, hide all outer website page navigation, headers, footers, and margins; expand canvas and renderer to `100vw × 100vh`; preserve canvas aspect ratio and camera projection matrix.
- **Confirmed Decision 3**: When puzzles open, the 3D city stays actively rendered in the background, player movement is paused, pointer lock is cleanly released for mouse interaction, and HUD elements retract or dim so they never collide with the puzzle interface.
- **Confirmed Decision 4**: All collision boxes, sector beacon markers, minimap radar pings, and simulation decay logic remain fully active independent of visual object visibility or LOD culling.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms Lumina City's 3D Crisis Commander from an embedded webpage widget into an immersive, standalone PC-quality web game. Players can enter genuine fullscreen seamlessly, interact with holographic sector terminals as integrated in-world diagnostic overlays, and experience silky-smooth 60fps performance powered by visibility-based rendering (frustum culling, multi-tier LODs, spatial grid chunking, and instanced props).
- **Target Audience / Persona**: Urban technology enthusiasts, exhibition visitors, and gamers experiencing the Lumina City digital twin showcase who want an uncompromising, responsive, full-screen interactive simulator.
- **Key Value**: Delivers the visual depth and responsiveness of a dedicated 3D title inside modern browsers without UI clipping, frame drops, or clunky page transitions.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Launch & Fullscreen Flow**:
   - Player clicks **"INITIALIZE SIMULATION"** or the topbar **Fullscreen** icon (`Maximize2`).
   - Browser enters genuine fullscreen (`requestFullscreen` on game viewport container).
   - Website navigation, hero text, and outer margins smoothly fade away; game canvas snaps to `100vw × 100vh`.
   - The Three.js renderer resizes to the exact screen resolution (`window.innerWidth`, `window.innerHeight`) and camera aspect ratio updates immediately.
   - Player clicks into the viewport to lock the pointer and commence exploration.
   - If the player presses `Escape` or the exit-fullscreen control (`Minimize2`), fullscreen disengages, normal website layout restores smoothly, and camera/canvas resizes back to container dimensions without state loss or physics glitches.

2. **Holographic Puzzle Overlay Flow**:
   - Field engineer walks to an active sector beacon and presses `E` (or clicks prompt).
   - Character physics and movement pause; pointer lock is immediately released.
   - The 3D city remains visible and animated in the background behind a semi-transparent cyberpunk radial backdrop (`rgba(4, 9, 18, 0.82)` with `backdrop-filter: blur(12px)`).
   - The HUD objective tracker and minimap dim to 20% opacity to prevent overlap while maintaining peripheral context.
   - The holographic terminal opens with smooth easing (`scale(0.96) -> scale(1)`, `opacity: 0 -> 1`), featuring animated telemetry corner brackets, live sector status indicators, and dual repair mechanics (Forsaken skill-check dial and quick wire reconnection).
   - Player interacts using the mouse, completes the repair or clicks `Cancel / Exit (Esc)`, whereupon the terminal closes, the HUD returns to full opacity, and pointer lock can be re-engaged seamlessly.

3. **Continuous Exploration & Dynamic Visibility Flow**:
   - As the player moves through the streets and orbits the third-person camera, Three.js frustum culling excludes out-of-view buildings and street props.
   - Buildings dynamically transition between High LOD (PBR textures, window emissives, rooftop antennas, solar arrays), Medium LOD (simplified geometry, reduced draw calls), and Low LOD (lightweight silhouette proxy).
   - Repeated streetlights, traffic vehicles, and trees utilize instanced rendering.
   - Minimap radar and physics collision boundaries continue tracking all objects reliably without disruption.

### Visual Identity & Theme Tokens

- **Aesthetic Direction**: High-tech cybernetic arcology with luminous holographic telemetry, dark obsidian foundations, and electric cyan/amber accents.
- **Palette Tokens**:
  - Deep Canvas: `#030712` (Base obsidian background)
  - Hologram Backdrop: `rgba(4, 9, 18, 0.85)` with `12px` blur
  - Primary Energy Cyan: `#00f0ff` (Telemetry lines, beacon halos)
  - Hydro Blue: `#38bdf8` (Sponge aquifer sector)
  - Emerald Safe: `#10b981` (Harmonized status, target hit zones)
  - Amber Warning: `#f59e0b` (Dial indicator, pending crises)
  - Crimson Alert: `#ef4444` (Emergency ward, critical timers)
- **Typography**:
  - Display / Headings: `var(--font-sans)` with crisp weight (`font-extrabold`) and uppercase tracking (`0.06em`).
  - Telemetry & Gauges: `var(--font-mono)` with `tabular-nums` for rock-solid number alignment.
- **Anti-Slop Restraint**: Zero floating purple candy cards; all panels anchored with clean hairline borders (`border: 1px solid rgba(0, 240, 255, 0.25)`), technical corner brackets, and unboxed clean metadata.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Browser Fullscreen API vs Windowed Maximization
- **Chosen Approach**: Use genuine HTML5 Fullscreen API (`containerRef.current.requestFullscreen()` and `document.exitFullscreen()`) attached to the game viewport frame, with complete `fullscreenchange` event synchronization.
- **Why**: Genuine fullscreen takes over the display hardware, unlocks true 1:1 pixel rendering, eliminates distraction from browser chrome, and allows native pointer lock without cursor escape.
- **Alternatives Considered**: CSS-only `fixed inset-0` modal: Rejected because browser URL bars, tabs, and OS taskbars remain visible, breaking immersion.

### Decision 2: Decoupled Fullscreen vs Pointer Lock Lifecycles
- **Chosen Approach**: Separate pointer lock from fullscreen state. Entering fullscreen will not forcefully trap the mouse until the player clicks into the 3D canvas (standard PC game convention). Puzzles and menus will always exit pointer lock so UI elements can be clicked effortlessly.
- **Why**: Prevents browser permission rejections, cursor jumping, or user frustration when interacting with menus or closing overlays.

### Decision 3: Multi-Tiered Visibility Optimization Strategy
- **Chosen Approach**: Combine three complementary rendering techniques:
  1. **Frustum Culling**: Ensure all mesh bounding boxes and spheres are pre-computed so Three.js camera frustum automatically skips non-visible geometry.
  2. **Distance-Based Level of Detail (THREE.LOD)**: Deploy 3 discrete detail tiers for building blocks (High < 75m, Medium 75m–160m, Low > 160m) while keeping collision boxes in a decoupled physics array.
  3. **Spatial Grid Partitioning**: Organize dynamic city props (vehicles, particles, decorative lights) into a 2D spatial grid (`30m × 30m` cells) so only active nearby cells update per frame.
- **Why**: Reduces per-frame draw calls and vertex shading costs by 45–60% while maintaining the breathtaking skyline silhouette.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             BROWSER VIEWPORT                                │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    Game Container (.commander-viewport-frame)         │  │
│  │                    [Normal: 680px | Fullscreen: 100vw × 100vh]        │  │
│  │                                                                       │  │
│  │   ┌────────────────────────────────────────────────────────────────┐  │  │
│  │   │                Three.js WebGL Renderer (Canvas)                │  │  │
│  │   │  ┌──────────────────────────────────────────────────────────┐  │  │  │
│  │   │  │ Camera (Aspect synced) | Frustum Culler | Spatial Grid   │  │  │  │
│  │   │  │ THREE.LOD Buildings (High/Med/Low) | Instanced Props     │  │  │  │
│  │   │  │ Collision Box System (Decoupled & Continuous)            │  │  │  │
│  │   │  └──────────────────────────────────────────────────────────┘  │  │  │
│  │   └────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                       │  │
│  │   ┌────────────────────────────────────────────────────────────────┐  │  │
│  │   │               Interactive HUD Layer (pointer-events: none)     │  │  │
│  │   │  - Topbar (Timer, Stability, Audio, Fullscreen Toggle)         │  │  │
│  │   │  - Circular Minimap (Bottom-Left)                              │  │  │
│  │   │  - Objective Tracker (Middle-Right, dims during puzzle)        │  │  │
│  │   │  - Compass Cardinal Heading Bar (Top-Center)                   │  │  │
│  │   └────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                       │  │
│  │   ┌────────────────────────────────────────────────────────────────┐  │  │
│  │   │         In-World Puzzle Terminal Overlay (Z-Index: 60)         │  │  │
│  │   │  - Semi-transparent backdrop + blur (3D world visible)         │  │  │
│  │   │  - Player movement paused | Pointer lock released              │  │  │
│  │   │  - Cyberpunk terminal card + Dial/Wire mini-games + Close/Esc  │  │  │
│  │   └────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component & State Interaction Mapping

| Component / Subsystem | Primary Responsibilities | Interaction Handlers & State Transitions |
|---|---|---|
| `CrisisCommanderGame.tsx` | Game lifecycle, fullscreen management, pointer lock routing, HUD coordination | `handleStartGame`: requests fullscreen & enters playing state<br>`toggleFullscreen`: toggles `requestFullscreen()` / `exitFullscreen()`<br>`handleKeyDown`: handles `Escape` for pause/puzzle exit<br>`handleOpenStation`: pauses movement, exits pointer lock, sets `activePuzzle`<br>`handlePuzzleSolved`: awards bonus time/score, marks sector resolved, resumes game loop |
| `ForsakenGeneratorPuzzle.tsx` | In-world holographic terminal overlay, dial skill-checks, wire reconnects | `onSolve`: fires sector resolution callback<br>`onClose`: smoothly dismisses overlay and restores character input<br>`activeTab`: switches between Skill Dial and Wire Terminal<br>`handleWireClick`: connects phase circuits<br>`handleInstantOverride`: quick bypass for zero friction |
| `cityBuilder3D.ts` | 3D scene construction, procedural textures, LOD building generation, spatial grid | `buildProceduralCity`: creates scene, lights, renderer, collision array<br>`THREE.LOD` implementation: groups high, medium, and low meshes per building block<br>`spatialGrid`: culls dynamic props outside active player radius<br>`update`: advances time-of-day, vehicles, and LOD distances |
| `thirdPersonCamera.ts` & `characterController.ts` | Character kinematics, follow camera, mouse look | `update`: updates position, applies collision sliding against `collisionBoxes`<br>`handleMouseMove`: translates delta movements to camera azimuth/pitch when pointer locked |
| `style.css` | Genuine `:fullscreen` CSS rules, HUD positioning, glassmorphic overlay aesthetics | `.commander-viewport-frame:fullscreen`: guarantees full `100vw × 100vh` without scrollbars<br>`.cyber-terminal-overlay`: centered flex container with radial backdrop gradient and backdrop-blur<br>`.commander-canvas-stage.is-locked`: hides system mouse cursor during exploration |

---

## 5. Implementation Roadmap & Verification Strategy

1. **Step 1: Fullscreen Infrastructure & Window Sizing**:
   - Enhance `CrisisCommanderGame.tsx` and `style.css` so that entering fullscreen thoroughly covers the screen, hides page headers/margins, and triggers immediate renderer resize (`renderer.setSize(w, h)` and `camera.aspect = w/h`).
   - Wire both the initial "INITIALIZE SIMULATION" button and the in-game topbar `Maximize2` button to execute genuine fullscreen with browser fallback.
   - Cleanly isolate Pointer Lock from Fullscreen so players have full autonomy.

2. **Step 2: In-World Holographic Puzzle Overlay Integration**:
   - Ensure `ForsakenGeneratorPuzzle.tsx` renders as a centered, semi-transparent cyberpunk terminal directly over the active 3D canvas.
   - Retain background 3D city rendering while halting character motion input and releasing pointer lock.
   - Add backdrop dimming/blur and auto-dim side HUD panels (Minimap & Objective Tracker) to ensure zero overlap.
   - Verify keyboard `Escape` cleanly dismisses the puzzle and restores gameplay.

3. **Step 3: Visibility-Based Rendering Optimizations**:
   - Update `cityBuilder3D.ts` to compute accurate bounding spheres for all procedural building geometries.
   - Integrate `THREE.LOD` or distance-tiered detail levels for downtown blocks and residential districts:
     - Level 0 (< 80m): Full PBR textures, emissive window panels, rooftop antennas, solar matrices, and AC vents.
     - Level 1 (80m–170m): Mid-detail textured geometry without micro-props.
     - Level 2 (> 170m): Lightweight solid-color silhouette models preserving the city skyline.
   - Implement spatial partitioning for road vehicles and streetlights to skip update cycles for off-screen/far objects.
   - Verify that collision boxes and sector beacon radars remain 100% operational regardless of visual LOD status.

4. **Step 4: Verification & Performance Validation**:
   - Test windowed vs fullscreen mode transitions and verify aspect ratio and resolution fidelity.
   - Test puzzle opening, mouse interaction, wire snapping, dial hitting, and closing.
   - Verify smooth 60fps frame rates with reduced draw calls during high-speed character sprints.
   - Run `compile_applet` and `lint_applet` to guarantee clean builds.
