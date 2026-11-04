import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  createRoadTexture,
  createRoadRoughnessTexture,
  createSidewalkTexture,
  createBuildingFacadeTexture,
  createSolarGridTexture,
  createRooftopTexture,
  createHelipadTexture,
  createNeonSignTexture,
} from './proceduralTextures';
import { CrisisInstance, ProtocolType } from '../types/game';

export interface SectorStation {
  id: string;
  name: string;
  sector: ProtocolType | 'emergency';
  coords: [number, number, number];
  terminalCoords: [number, number, number];
  promptLabel: string;
  description: string;
  solved: boolean;
  beaconColor: number;
}

export interface City3DScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  maxPixelRatio: number;
  ambientLight: THREE.AmbientLight;
  sunLight: THREE.DirectionalLight;
  selectableObjects: THREE.Object3D[];
  collisionBoxes: THREE.Box3[];
  sectorStations: SectorStation[];
  setSectorSolved: (stationId: string, solved: boolean) => void;
  update: (delta: number, state?: { timeOfDay?: number; stability?: number }) => void;
  triggerProtocolVisual: (type: ProtocolType) => void;
  setProtocol: (type: ProtocolType | null) => void;
  spawnCrisisVisual: (crisis: CrisisInstance) => void;
  removeCrisisVisual: (crisisId: string) => void;
  setRenderScale: (scale: number) => void;
  dispose: () => void;
}

export function buildProceduralCity(
  container: HTMLElement,
  options: {
    interactiveRaycasting?: boolean;
    onSelectZone?: (zoneId: string) => void;
    enableShadows?: boolean;
    performanceMode?: boolean;
  } = {}
): City3DScene {
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 500;

  const scene = new THREE.Scene();
  // Golden Hour Dusk: deep indigo/navy atmosphere and matching distance fog
  scene.background = new THREE.Color(0x0c1424);
  scene.fog = new THREE.FogExp2(0x0c1424, 0.0032);

  const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1200);
  camera.position.set(0, 95, 130);
  camera.lookAt(0, 0, 0);

  const hardware = navigator as Navigator & { deviceMemory?: number };
  const lowEndDevice = (hardware.deviceMemory !== undefined && hardware.deviceMemory <= 4) ||
    (hardware.hardwareConcurrency > 0 && hardware.hardwareConcurrency <= 4);
  const maxPixelRatio = options.performanceMode
    ? Math.min(window.devicePixelRatio || 1, lowEndDevice ? 1 : 1.5)
    : Math.min(window.devicePixelRatio || 1, 2);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setSize(width, height);
  renderer.setPixelRatio(maxPixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (options.enableShadows !== false) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const setRenderScale = (scale: number) => {
    const boundedScale = THREE.MathUtils.clamp(scale, 0.65, 1);
    const nextPixelRatio = Math.min(maxPixelRatio, Math.max(0.75, maxPixelRatio * boundedScale));
    if (Math.abs(renderer.getPixelRatio() - nextPixelRatio) > 0.02) renderer.setPixelRatio(nextPixelRatio);
  };

  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  // Studio PBR Environment Map for realistic metallic and glass specular reflections
  try {
    const pmremGen = new THREE.PMREMGenerator(renderer);
    pmremGen.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    scene.environment = pmremGen.fromScene(roomEnv, 0.04).texture;
    scene.environmentIntensity = 0.85;
    pmremGen.dispose();
    roomEnv.dispose();
  } catch (err) {
    console.warn('Could not initialize RoomEnvironment:', err);
  }

  const selectableObjects: THREE.Object3D[] = [];
  const collisionBoxes: THREE.Box3[] = [];
  const animatedVehicles: {
    mesh: THREE.Group;
    axis: 'x' | 'z';
    coord: number;
    min: number;
    max: number;
    speed: number;
    direction: number;
  }[] = [];

  const windTurbineBlades: THREE.Group[] = [];
  const crisisVisuals: Map<string, THREE.Group> = new Map();
  const sceneOwnedTextures = new Set<THREE.Texture>();
  const protocolPulseMeshes: THREE.Mesh[] = [];
  const protocolPulsePool: THREE.Mesh[] = [];
  const protocolPulseGeometry = new THREE.RingGeometry(2, 4, 32);
  const streetLightBulbs: { mesh: THREE.Mesh; onMat: THREE.Material; offMat: THREE.Material }[] = [];
  const buildingMaterials: THREE.MeshStandardMaterial[] = [];
  const aviationBeacons: { mesh: THREE.Mesh; color: number }[] = [];

  // Shared Geometries with accurate bounding volumes for frustum culling
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.computeBoundingBox();
  boxGeo.computeBoundingSphere();

  const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
  cylGeo.computeBoundingBox();
  cylGeo.computeBoundingSphere();

  // Visibility-based distance culling collection for fine-detail architectural/street props
  const distanceCullableObjects: {
    object: THREE.Object3D;
    center: THREE.Vector3;
    maxDistSq: number;
  }[] = [];

  // Multi-tier Level of Detail (LOD) objects registry
  const lodObjects: THREE.LOD[] = [];
  const _projScreenMatrix = new THREE.Matrix4();
  const _frustum = new THREE.Frustum();
  const _vehicleBox = new THREE.Box3();
  const _vehicleHalfExtents = new THREE.Vector3(3, 2, 4.5);

  const registerDistanceCullable = (obj: THREE.Object3D, center: THREE.Vector3, maxDist: number = 210) => {
    obj.frustumCulled = true;
    distanceCullableObjects.push({
      object: obj,
      center,
      maxDistSq: maxDist * maxDist,
    });
  };

  // Lighting Rig: Golden Hour Dusk key light + rich sky/ground ambient fill
  const ambientLight = new THREE.AmbientLight(0xffedd5, 0.28);
  scene.add(ambientLight);

  // Twilight sky cyan + obsidian dark ground bounce
  const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.7);
  hemiLight.position.set(0, 90, 0);
  scene.add(hemiLight);

  // Low-angled Golden Sun: warm amber, casting long dramatic architectural shadows
  const sunLight = new THREE.DirectionalLight(0xffb87a, 2.2);
  sunLight.position.set(85, 60, 65);
  sunLight.castShadow = true;
  const shadowResolution = options.performanceMode ? (lowEndDevice ? 768 : 1024) : 2048;
  sunLight.shadow.mapSize.set(shadowResolution, shadowResolution);
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 400;
  sunLight.shadow.camera.left = -130;
  sunLight.shadow.camera.right = 130;
  sunLight.shadow.camera.top = 130;
  sunLight.shadow.camera.bottom = -130;
  sunLight.shadow.bias = -0.0003;
  sunLight.shadow.normalBias = 0.025;
  sunLight.shadow.radius = 2.0;
  scene.add(sunLight);

  // Ground plane: dark obsidian foundation pavement
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x070c14,
    roughness: 0.9,
    metalness: 0.15,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 220), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // High-Fidelity Procedural Textures
  const roadTex = createRoadTexture(2, true);
  const roadRoughnessTex = createRoadRoughnessTexture();
  const sidewalkTex = createSidewalkTexture();
  const cbdFacadeTex = createBuildingFacadeTexture('cyber-cyan', 0.75);
  const corpFacadeTex = createBuildingFacadeTexture('corporate-blue', 0.65);
  const resFacadeTex = createBuildingFacadeTexture('residential', 0.55);
  const solarTex = createSolarGridTexture();
  const roofGravelTex = createRooftopTexture();
  const helipadTex = createHelipadTexture();

  // Helper add mesh with collision tracking
  const createBox = (
    grp: THREE.Group | THREE.Scene,
    x: number, y: number, z: number,
    w: number, h: number, d: number,
    mat: THREE.Material,
    castShadow = true,
    zoneId?: string,
    isSolid = true
  ) => {
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    if (zoneId) {
      mesh.userData.zoneId = zoneId;
      selectableObjects.push(mesh);
    }
    grp.add(mesh);
    if (isSolid && h >= 1.5 && (w >= 1.8 || d >= 1.8)) {
      const box = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(x, y + h / 2, z),
        new THREE.Vector3(w, h, d)
      );
      collisionBoxes.push(box);
    }
    return mesh;
  };

  const createCyl = (
    grp: THREE.Group | THREE.Scene,
    x: number, y: number, z: number,
    rad: number, h: number,
    mat: THREE.Material,
    castShadow = true,
    zoneId?: string,
    isSolid = false
  ) => {
    const mesh = new THREE.Mesh(cylGeo, mat);
    mesh.scale.set(rad * 2, h, rad * 2);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    if (zoneId) {
      mesh.userData.zoneId = zoneId;
      selectableObjects.push(mesh);
    }
    grp.add(mesh);
    if (isSolid && h >= 1.5 && rad >= 1) {
      const box = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(x, y + h / 2, z),
        new THREE.Vector3(rad * 2, h, rad * 2)
      );
      collisionBoxes.push(box);
    }
    return mesh;
  };

  // 1. ROADS AND SIDEWALKS (PBR Standards)
  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTex,
    roughnessMap: roadRoughnessTex,
    roughness: 0.45,
    metalness: 0.22,
    envMapIntensity: 0.85,
  });

  const sidewalkMat = new THREE.MeshStandardMaterial({
    map: sidewalkTex,
    roughness: 0.75,
    metalness: 0.12,
    envMapIntensity: 0.45,
  });

  const curbMat = new THREE.MeshStandardMaterial({
    color: 0x273444,
    roughness: 0.6,
    metalness: 0.25,
  });

  const roofGravelMat = new THREE.MeshStandardMaterial({
    map: roofGravelTex,
    roughness: 0.85,
    metalness: 0.15,
  });

  const hvacMetalMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.85,
    roughness: 0.25,
  });

  const darkPanelMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.9,
    roughness: 0.2,
  });

  // Vertical roads (x = -45, 0, 45)
  [-45, 0, 45].forEach(x => {
    createBox(scene, x, 0.05, 0, 9, 0.1, 180, roadMat, false, 'roads');
    // Curbs & Sidewalks with realistic height step
    createBox(scene, x - 5.5, 0.1, 0, 2, 0.2, 180, sidewalkMat, false);
    createBox(scene, x + 5.5, 0.1, 0, 2, 0.2, 180, sidewalkMat, false);
    createBox(scene, x - 4.6, 0.15, 0, 0.3, 0.25, 180, curbMat, false);
    createBox(scene, x + 4.6, 0.15, 0, 0.3, 0.25, 180, curbMat, false);
  });

  // Horizontal roads (z = -30, 30)
  [-30, 30].forEach(z => {
    const road = createBox(scene, 0, 0.06, z, 220, 0.1, 9, roadMat, false, 'roads');
    road.rotation.y = Math.PI / 2;
    createBox(scene, 0, 0.1, z - 5.5, 220, 0.2, 2, sidewalkMat, false);
    createBox(scene, 0, 0.1, z + 5.5, 220, 0.2, 2, sidewalkMat, false);
  });

  // Streetlights with Warm Pools of Light along Sidewalks
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.25 });
  const bulbOnMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, emissive: 0xffb84d, emissiveIntensity: 2.2 });
  const bulbOffMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });

  [-45, 0, 45].forEach((x, colIdx) => {
    for (let z = -75; z <= 75; z += 30) {
      // Light pole
      createCyl(scene, x + 6.2, 0, z, 0.18, 5.5, poleMat, true);
      createBox(scene, x + 5.2, 5.4, z, 2.2, 0.15, 0.15, poleMat, true);
      const bulb = createBox(scene, x + 4.3, 5.15, z, 0.45, 0.25, 0.35, bulbOnMat, false);
      streetLightBulbs.push({ mesh: bulb, onMat: bulbOnMat, offMat: bulbOffMat });

      // Local warm ground illumination pool at key intersections
      if (Math.abs(z) <= 30 || colIdx === 1) {
        const poolLight = new THREE.PointLight(0xffe29a, 1.2, 16, 2);
        poolLight.position.set(x + 4.3, 4.8, z);
        scene.add(poolLight);
      }
    }
  });

  // Sidewalk Planters with Lush Urban Greenery
  const planterMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8, metalness: 0.2 });
  const shrubMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.65, metalness: 0.1 });
  const foliageGeo = new THREE.DodecahedronGeometry(0.7, 1);

  if (options.performanceMode) {
    const instanceTransform = new THREE.Object3D();
    [-45, 0, 45].forEach(x => {
      const planters = new THREE.InstancedMesh(boxGeo, planterMat, 4);
      const shrubs = new THREE.InstancedMesh(foliageGeo, shrubMat, 8);
      let planterIndex = 0;
      let shrubIndex = 0;
      [-55, -10, 10, 55].forEach(z => {
        instanceTransform.position.set(x - 5.5, 0.4, z);
        instanceTransform.scale.set(1.2, 0.4, 2.4);
        instanceTransform.updateMatrix();
        planters.setMatrixAt(planterIndex++, instanceTransform.matrix);

        instanceTransform.position.set(x - 5.5, 0.65, z - 0.5);
        instanceTransform.scale.set(0.9, 0.8, 0.9);
        instanceTransform.updateMatrix();
        shrubs.setMatrixAt(shrubIndex++, instanceTransform.matrix);

        instanceTransform.position.set(x - 5.5, 0.7, z + 0.5);
        instanceTransform.scale.set(0.85, 0.95, 0.85);
        instanceTransform.updateMatrix();
        shrubs.setMatrixAt(shrubIndex++, instanceTransform.matrix);
      });
      planters.instanceMatrix.needsUpdate = true;
      shrubs.instanceMatrix.needsUpdate = true;
      planters.castShadow = true;
      shrubs.castShadow = true;
      scene.add(planters, shrubs);
    });
  } else {
    [-45, 0, 45].forEach(x => {
      [-55, -10, 10, 55].forEach(z => {
        createBox(scene, x - 5.5, 0.2, z, 1.2, 0.4, 2.4, planterMat, true);
        const shrub1 = new THREE.Mesh(foliageGeo, shrubMat);
        shrub1.scale.set(0.9, 0.8, 0.9);
        shrub1.position.set(x - 5.5, 0.65, z - 0.5);
        shrub1.castShadow = true;
        scene.add(shrub1);
        const shrub2 = new THREE.Mesh(foliageGeo, shrubMat);
        shrub2.scale.set(0.85, 0.95, 0.85);
        shrub2.position.set(x - 5.5, 0.7, z + 0.5);
        shrub2.castShadow = true;
        scene.add(shrub2);
      });
    });
  }

  // Futuristic Glass Transit Shelters
  const glassRoofMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.55,
    roughness: 0.08,
    metalness: 0.9,
  });
  const timetableMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

  [[-38, -4], [7, -4], [52, -4], [-38, 4], [7, 4], [52, 4]].forEach(([sx, sz]) => {
    const shelter = new THREE.Group();
    shelter.position.set(sx, 0, sz);
    // Vertical supports
    createCyl(shelter, -1.8, 0, 0, 0.08, 3.2, poleMat, true);
    createCyl(shelter, 1.8, 0, 0, 0.08, 3.2, poleMat, true);
    // Cantilevered glass canopy
    const roof = new THREE.Mesh(boxGeo, glassRoofMat);
    roof.scale.set(4.2, 0.08, 2.2);
    roof.position.set(0, 3.2, 0.6);
    roof.castShadow = true;
    shelter.add(roof);
    // Illuminated schedule kiosk
    const kiosk = new THREE.Mesh(boxGeo, darkPanelMat);
    kiosk.scale.set(0.9, 2.4, 0.15);
    kiosk.position.set(0, 1.2, 0);
    shelter.add(kiosk);
    const screen = new THREE.Mesh(boxGeo, timetableMat);
    screen.scale.set(0.75, 1.4, 0.04);
    screen.position.set(0, 1.4, 0.09);
    shelter.add(screen);
    scene.add(shelter);
  });

  // 2. CENTRAL BUSINESS DISTRICT (CBD) - Multi-Tier LOD Skyscrapers with Rooftop Mechanicals
  const buildSkyscraper = (
    cx: number, cz: number,
    baseW: number, baseD: number, totalH: number,
    facadeMat: THREE.Material,
    zoneId: string,
    hasSpire = true,
    hasNeon = true
  ) => {
    const lod = new THREE.LOD();
    lod.position.set(0, 0, 0);

    const podH = Math.min(10, totalH * 0.2);
    const towerH = totalH - podH - (hasSpire ? 8 : 2);
    const crownH = hasSpire ? 6 : 3;
    const roofY = podH + towerH + crownH;
    const roofW = baseW * 0.78;
    const roofD = baseD * 0.78;

    // --- LEVEL 0: HIGH DETAIL (< 80 units) ---
    const bldgHigh = new THREE.Group();
    bldgHigh.userData.zoneId = zoneId;

    createBox(bldgHigh, cx, 0, cz, baseW + 2.4, podH, baseD + 2.4, sidewalkMat, true, zoneId, false);
    createBox(bldgHigh, cx, podH, cz, baseW, towerH, baseD, facadeMat, true, zoneId, false);
    createBox(bldgHigh, cx, podH + towerH, cz, baseW * 0.78, crownH, baseD * 0.78, facadeMat, true, zoneId, false);

    // Rooftop gravel deck & parapet lip
    const roofDeck = new THREE.Mesh(new THREE.PlaneGeometry(roofW - 0.4, roofD - 0.4), roofGravelMat);
    roofDeck.rotation.x = -Math.PI / 2;
    roofDeck.position.set(cx, roofY + 0.02, cz);
    roofDeck.receiveShadow = true;
    roofDeck.frustumCulled = true;
    bldgHigh.add(roofDeck);

    // Rooftop HVAC Chiller Unit with Fan Grilles
    const hvac = new THREE.Mesh(boxGeo, hvacMetalMat);
    hvac.scale.set(roofW * 0.35, 1.6, roofD * 0.35);
    hvac.position.set(cx - roofW * 0.15, roofY + 0.8, cz - roofD * 0.15);
    hvac.castShadow = true;
    hvac.frustumCulled = true;
    bldgHigh.add(hvac);
    registerDistanceCullable(hvac, new THREE.Vector3(cx, roofY, cz), 210);

    // HVAC fan cowl
    const fanCowl = new THREE.Mesh(cylGeo, darkPanelMat);
    fanCowl.scale.set(roofW * 0.22, 0.3, roofD * 0.22);
    fanCowl.position.set(cx - roofW * 0.15, roofY + 1.7, cz - roofD * 0.15);
    fanCowl.frustumCulled = true;
    bldgHigh.add(fanCowl);
    registerDistanceCullable(fanCowl, new THREE.Vector3(cx, roofY, cz), 210);

    // Rooftop Satellite Communication Dish
    const dishGroup = new THREE.Group();
    dishGroup.position.set(cx + roofW * 0.2, roofY, cz + roofD * 0.2);
    const dishBase = new THREE.Mesh(cylGeo, poleMat);
    dishBase.scale.set(0.18, 1.2, 0.18);
    dishBase.position.y = 0.6;
    dishBase.frustumCulled = true;
    dishGroup.add(dishBase);

    const dishBowl = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.4),
      hvacMetalMat
    );
    dishBowl.rotation.x = 0.6;
    dishBowl.rotation.y = 0.3;
    dishBowl.position.set(0, 1.3, 0);
    dishBowl.frustumCulled = true;
    dishGroup.add(dishBowl);
    bldgHigh.add(dishGroup);
    registerDistanceCullable(dishGroup, new THREE.Vector3(cx, roofY, cz), 210);

    if (hasSpire) {
      createCyl(bldgHigh, cx, roofY, cz, 0.28, 9, poleMat, true, zoneId, false);
      const redBeaconMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xff0000,
        emissiveIntensity: 2.5,
      });
      const cyanBeaconMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x00f0ff,
        emissiveIntensity: 2.0,
      });

      const topBeacon = new THREE.Mesh(boxGeo, redBeaconMat);
      topBeacon.scale.set(0.5, 0.5, 0.5);
      topBeacon.position.set(cx, roofY + 9, cz);
      topBeacon.frustumCulled = true;
      bldgHigh.add(topBeacon);
      aviationBeacons.push({ mesh: topBeacon, color: 0xff0000 });

      const midBeacon = new THREE.Mesh(boxGeo, cyanBeaconMat);
      midBeacon.scale.set(0.35, 0.35, 0.35);
      midBeacon.position.set(cx, roofY + 5.5, cz);
      midBeacon.frustumCulled = true;
      bldgHigh.add(midBeacon);
      aviationBeacons.push({ mesh: midBeacon, color: 0x00f0ff });
    }

    if (hasNeon) {
      const neonTex = createNeonSignTexture('NEXUS METROPOLIS', '#f59e0b');
      sceneOwnedTextures.add(neonTex);
      const neonMat = new THREE.MeshBasicMaterial({ map: neonTex, transparent: true });
      const sign = new THREE.Mesh(boxGeo, neonMat);
      sign.scale.set(baseW * 0.85, 2.2, 0.2);
      sign.position.set(cx, podH + 6, cz + baseD / 2 + 0.15);
      sign.frustumCulled = true;
      bldgHigh.add(sign);
    }

    // --- LEVEL 1: MEDIUM DETAIL (80 to 175 units) ---
    // Retains textured stepped towers and spire; strips off micro HVAC and dishes
    const bldgMed = new THREE.Group();
    bldgMed.userData.zoneId = zoneId;
    createBox(bldgMed, cx, 0, cz, baseW + 2.4, podH, baseD + 2.4, sidewalkMat, true, undefined, false);
    createBox(bldgMed, cx, podH, cz, baseW, towerH, baseD, facadeMat, true, undefined, false);
    createBox(bldgMed, cx, podH + towerH, cz, baseW * 0.78, crownH, baseD * 0.78, facadeMat, true, undefined, false);
    if (hasSpire) {
      createCyl(bldgMed, cx, roofY, cz, 0.28, 9, poleMat, false, undefined, false);
    }

    // --- LEVEL 2: LOW DETAIL (> 175 units) ---
    // Ultra-lightweight single volume silhouette
    const bldgLow = new THREE.Group();
    bldgLow.userData.zoneId = zoneId;
    const lowMat = new THREE.MeshBasicMaterial({ color: 0x091424 });
    createBox(bldgLow, cx, 0, cz, baseW, totalH, baseD, lowMat, false, undefined, false);

    lod.addLevel(bldgHigh, 0);
    lod.addLevel(bldgMed, 80);
    lod.addLevel(bldgLow, 175);
    scene.add(lod);
    lodObjects.push(lod);

    // Guaranteed static collision volume independent of LOD
    const colBox = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(cx, totalH / 2, cz),
      new THREE.Vector3(baseW + 0.4, totalH, baseD + 0.4)
    );
    collisionBoxes.push(colBox);

    return lod;
  };

  const cbdMat1 = new THREE.MeshStandardMaterial({
    map: cbdFacadeTex,
    emissive: 0x071e2e,
    emissiveIntensity: 0.6,
    metalness: 0.45,
    roughness: 0.35,
  });
  buildingMaterials.push(cbdMat1);

  const cbdMat2 = new THREE.MeshStandardMaterial({
    map: corpFacadeTex,
    emissive: 0x092338,
    emissiveIntensity: 0.55,
    metalness: 0.5,
    roughness: 0.3,
  });
  buildingMaterials.push(cbdMat2);

  // CBD Cluster (-22, -60)
  buildSkyscraper(-25, -60, 9, 9, 44, cbdMat1, 'cbd', true, true);
  buildSkyscraper(-14, -58, 8, 8, 38, cbdMat2, 'cbd', true, false);
  buildSkyscraper(-25, -72, 8, 8, 32, cbdMat2, 'cbd', false, true);
  buildSkyscraper(-14, -72, 7, 7, 28, cbdMat1, 'cbd', true, false);

  // 3. RESIDENTIAL ARCOLOGIES (x = 22, z = -60) - Multi-Tier LOD
  const resMat = new THREE.MeshStandardMaterial({
    map: resFacadeTex,
    emissive: 0x14202c,
    emissiveIntensity: 0.45,
    metalness: 0.25,
    roughness: 0.6,
  });
  buildingMaterials.push(resMat);

  const buildArcology = (cx: number, cz: number, zId: string) => {
    const lod = new THREE.LOD();
    lod.position.set(0, 0, 0);

    const heights = [18, 24, 16, 22];

    // High detail (< 85 units)
    const arcHigh = new THREE.Group();
    [-6, 6].forEach((dx, i) => {
      [-6, 6].forEach((dz, j) => {
        const h = heights[(i * 2 + j) % heights.length];
        createBox(arcHigh, cx + dx, 0, cz + dz, 8, h, 8, resMat, true, zId, false);
        createBox(arcHigh, cx + dx, h, cz + dz, 8.4, 0.8, 8.4, curbMat, true, zId, false);
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.8 });
        createCyl(arcHigh, cx + dx, h + 0.8, cz + dz, 1.8, 1.5, leafMat, true, undefined, false);
      });
    });

    // Medium detail (85 to 175 units)
    const arcMed = new THREE.Group();
    [-6, 6].forEach((dx, i) => {
      [-6, 6].forEach((dz, j) => {
        const h = heights[(i * 2 + j) % heights.length];
        createBox(arcMed, cx + dx, 0, cz + dz, 8, h, 8, resMat, true, undefined, false);
        createBox(arcMed, cx + dx, h, cz + dz, 8.4, 0.8, 8.4, curbMat, false, undefined, false);
      });
    });

    // Low detail (> 175 units)
    const arcLow = new THREE.Group();
    const arcLowMat = new THREE.MeshBasicMaterial({ color: 0x0c1b2c });
    createBox(arcLow, cx, 0, cz, 22, 22, 22, arcLowMat, false, undefined, false);

    lod.addLevel(arcHigh, 0);
    lod.addLevel(arcMed, 85);
    lod.addLevel(arcLow, 175);
    scene.add(lod);
    lodObjects.push(lod);

    // Guaranteed static collision volume
    const colBox = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(cx, 11, cz),
      new THREE.Vector3(21, 22, 21)
    );
    collisionBoxes.push(colBox);
  };
  buildArcology(24, -60, 'res-a');
  buildArcology(68, -60, 'res-b');

  // 4. METROPOLITAN HOSPITAL (x = -68, z = 0)
  const hospMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4, metalness: 0.2 });
  const hospCrossMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.2 });
  const helipadMat = new THREE.MeshStandardMaterial({ map: helipadTex, roughness: 0.5 });

  const hospGrp = new THREE.Group();
  hospGrp.userData.zoneId = 'hospital';
  // Central Wing
  createBox(hospGrp, -68, 0, 0, 16, 12, 16, hospMat, true, 'hospital');
  // East-West Cross Wings
  createBox(hospGrp, -68, 0, 0, 24, 8, 10, hospMat, true, 'hospital');
  createBox(hospGrp, -68, 0, 0, 10, 8, 24, hospMat, true, 'hospital');
  // Emergency Helipad on Roof
  const helipadMesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), helipadMat);
  helipadMesh.rotation.x = -Math.PI / 2;
  helipadMesh.position.set(-68, 12.05, 0);
  helipadMesh.receiveShadow = true;
  hospGrp.add(helipadMesh);

  // Red Cross on facade
  createBox(hospGrp, -68, 8.5, 8.1, 1.4, 4.2, 0.2, hospCrossMat, false, 'hospital');
  createBox(hospGrp, -68, 9.9, 8.1, 4.2, 1.4, 0.2, hospCrossMat, false, 'hospital');
  scene.add(hospGrp);

  // 5. SOLID-STATE ENERGY SUBSTATION (x = 68, z = 0)
  const subMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.4 });
  const coilMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0284c7, emissiveIntensity: 0.6 });

  const subGrp = new THREE.Group();
  subGrp.userData.zoneId = 'substation';
  createBox(subGrp, 68, 0, 0, 16, 6, 16, subMat, true, 'substation');
  // Transformer coils
  [-5, 5].forEach(dx => {
    [-5, 5].forEach(dz => {
      createCyl(subGrp, 68 + dx, 6, dz, 1.4, 3.5, coilMat, true, 'substation');
      createCyl(subGrp, 68 + dx, 9.5, dz, 0.3, 3, poleMat, true);
    });
  });
  // High-voltage pylon
  createCyl(subGrp, 68, 6, 0, 0.5, 7, poleMat, true);
  scene.add(subGrp);

  // 6. SOLAR PHOTOVOLTAIC FARMS & WIND TURBINES (x = -22, z = 0)
  const solarMat = new THREE.MeshStandardMaterial({
    map: solarTex,
    emissive: 0x0c4a6e,
    emissiveIntensity: 0.4,
    metalness: 0.8,
    roughness: 0.25,
  });

  const solarGrp = new THREE.Group();
  solarGrp.userData.zoneId = 'solar-a';
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const px = -22 + c * 5;
      const pz = r * 5;
      createCyl(solarGrp, px, 0, pz, 0.25, 2.2, poleMat, true);
      const panel = new THREE.Mesh(boxGeo, solarMat);
      panel.scale.set(3.8, 0.15, 3.8);
      panel.position.set(px, 2.2, pz);
      panel.rotation.x = -0.38;
      panel.castShadow = true;
      solarGrp.add(panel);
    }
  }
  scene.add(solarGrp);

  // Wind Turbines (x = 22, z = 0)
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
  [-8, 8].forEach(dx => {
    const tx = 22 + dx;
    createCyl(scene, tx, 0, 0, 0.6, 18, poleMat, true, 'wind');
    createBox(scene, tx, 18, 0, 3, 1.8, 2, poleMat, true);

    const hub = new THREE.Group();
    hub.position.set(tx, 18, 1);
    const centerCap = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 12), bladeMat);
    hub.add(centerCap);

    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(boxGeo, bladeMat);
      blade.scale.set(0.4, 8, 0.8);
      blade.position.set(0, 4, 0);
      blade.rotation.z = (b * Math.PI * 2) / 3;
      hub.add(blade);
    }
    scene.add(hub);
    windTurbineBlades.push(hub);
  });

  // 7. YAMUNA ECO-RESERVOIR & SPONGE HYDROLOGY (x = -68, z = 60)
  const reserGrp = new THREE.Group();
  reserGrp.userData.zoneId = 'reservoir';
  const basinMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
  // Outer concrete retaining wall
  createBox(reserGrp, -68, 0, 60, 22, 5, 22, basinMat, true, 'reservoir');

  // Interior water basin
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x0891b2,
    emissiveIntensity: 0.45,
    roughness: 0.15,
    metalness: 0.85,
    transparent: true,
    opacity: 0.88,
  });
  const waterMesh = new THREE.Mesh(boxGeo, waterMat);
  waterMesh.scale.set(19, 4, 19);
  waterMesh.position.set(-68, 2, 60);
  reserGrp.add(waterMesh);
  scene.add(reserGrp);

  // 8. AUTONOMOUS TRANSIT CORRIDOR & METRO (Elevated Track z = 48)
  const transitMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x0369a1,
    emissiveIntensity: 0.5,
    metalness: 0.7,
    roughness: 0.3,
  });

  for (let x = -100; x <= 100; x += 30) {
    createCyl(scene, x, 0, 48, 0.7, 9, poleMat, true);
    createBox(scene, x, 9, 48, 30, 0.8, 3.2, transitMat, true, 'metro');
  }

  // Animated Maglev Train Pod
  const trainGrp = new THREE.Group();
  const trainMat = new THREE.MeshStandardMaterial({ color: 0x28d9ec, emissive: 0x28d9ec, emissiveIntensity: 0.5, metalness: 0.9, roughness: 0.2 });
  const trainBody = new THREE.Mesh(boxGeo, trainMat);
  trainBody.scale.set(18, 2.2, 2.4);
  trainBody.position.set(0, 10.4, 48);
  trainGrp.add(trainBody);
  scene.add(trainGrp);

  // 9. ECOLOGICAL PARK & VEGETATION (x = 68, z = 60)
  const parkGrass = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.9 }));
  parkGrass.rotation.x = -Math.PI / 2;
  parkGrass.position.set(68, 0.08, 60);
  parkGrass.receiveShadow = true;
  parkGrass.userData.zoneId = 'park-a';
  selectableObjects.push(parkGrass);
  scene.add(parkGrass);

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
  const leavesMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.7 });

  const treeCoords = [
    [-6, -6], [0, -6], [6, -6],
    [-6, 0], [6, 0],
    [-6, 6], [0, 6], [6, 6],
  ];
  if (options.performanceMode) {
    const instanceTransform = new THREE.Object3D();
    const trunks = new THREE.InstancedMesh(cylGeo, trunkMat, treeCoords.length);
    const canopies = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(2.2), leavesMat, treeCoords.length);
    treeCoords.forEach(([dx, dz], index) => {
      instanceTransform.position.set(68 + dx, 1.25, 60 + dz);
      instanceTransform.scale.set(0.6, 2.5, 0.6);
      instanceTransform.updateMatrix();
      trunks.setMatrixAt(index, instanceTransform.matrix);
      instanceTransform.position.set(68 + dx, 3.8, 60 + dz);
      instanceTransform.scale.set(1, 1, 1);
      instanceTransform.updateMatrix();
      canopies.setMatrixAt(index, instanceTransform.matrix);
    });
    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    trunks.castShadow = true;
    canopies.castShadow = true;
    scene.add(trunks, canopies);
  } else {
    const foliageGeometry = new THREE.DodecahedronGeometry(2.2);
    treeCoords.forEach(([dx, dz]) => {
      createCyl(scene, 68 + dx, 0, 60 + dz, 0.3, 2.5, trunkMat, true);
      const foliage = new THREE.Mesh(foliageGeometry, leavesMat);
      foliage.position.set(68 + dx, 3.8, 60 + dz);
      foliage.castShadow = true;
      scene.add(foliage);
    });
  }

  // 10. ANIMATED MULTI-LANE VEHICLES
  const vehicleColors = [0x28d9ec, 0xef4444, 0x3b82f6, 0xf59e0b, 0x10b981, 0xffffff];
  [-45, 0, 45].forEach((x, idx) => {
    for (let i = 0; i < 4; i++) {
      const vGrp = new THREE.Group();
      const col = vehicleColors[(idx * 4 + i) % vehicleColors.length];
      const carMat = new THREE.MeshStandardMaterial({ color: col, metalness: 0.8, roughness: 0.3 });

      const body = new THREE.Mesh(boxGeo, carMat);
      body.scale.set(1.9, 0.9, 3.8);
      body.position.y = 0.55;
      body.castShadow = true;
      vGrp.add(body);

      // Cabin roof
      const cabMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });
      const cab = new THREE.Mesh(boxGeo, cabMat);
      cab.scale.set(1.6, 0.7, 2.2);
      cab.position.set(0, 1.25, -0.2);
      vGrp.add(cab);

      // Headlights
      const hLight = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hLight.scale.set(1.4, 0.25, 0.1);
      hLight.position.set(0, 0.55, 1.95);
      vGrp.add(hLight);

      // Taillights
      const tLight = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xff0000 }));
      tLight.scale.set(1.4, 0.25, 0.1);
      tLight.position.set(0, 0.55, -1.95);
      vGrp.add(tLight);

      const laneOffset = i % 2 === 0 ? 2.2 : -2.2;
      const initialZ = -70 + i * 40;
      vGrp.position.set(x + laneOffset, 0, initialZ);
      scene.add(vGrp);

      animatedVehicles.push({
        mesh: vGrp,
        axis: 'z',
        coord: x + laneOffset,
        min: -85,
        max: 85,
        speed: 18 + Math.random() * 12,
        direction: i % 2 === 0 ? 1 : -1,
      });
    }
  });

  // Starfield
  const starGeo = new THREE.BufferGeometry();
  const starCount = 400;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 240 + Math.random() * 100;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.45;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = 45 + r * Math.cos(phi) * 0.5;
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: 0xa5f3fc, size: 0.8, transparent: true, opacity: 0.75 })
  );
  scene.add(stars);

  // 11. PHYSICAL INTERACTIVE SECTOR TERMINALS & WAYPOINTS
  const sectorStations: SectorStation[] = [
    {
      id: 'substation',
      name: 'Clean Grid Substation 01',
      sector: 'energy',
      coords: [68, 0, 0],
      terminalCoords: [56, 0, 0],
      promptLabel: 'ACCESS SUBSTATION CONDUIT MATRIX',
      description: 'Solid-state high-voltage transformer hub and BESS storage matrix.',
      solved: false,
      beaconColor: 0x38bdf8,
    },
    {
      id: 'reservoir',
      name: 'Yamuna Sponge Aquifer',
      sector: 'water',
      coords: [-68, 0, 60],
      terminalCoords: [-54, 0, 60],
      promptLabel: 'CONFIGURE HYDRAULIC SLUICE VALVES',
      description: 'Subterranean closed-loop stormwater filtration and retention aquifers.',
      solved: false,
      beaconColor: 0x06b6d4,
    },
    {
      id: 'traffic',
      name: 'CBD Traffic Intelligence Hub',
      sector: 'traffic',
      coords: [0, 0, -30],
      terminalCoords: [0, 0, -20],
      promptLabel: 'OVERRIDE TRAFFIC SIGNAL MATRIX',
      description: 'Autonomous arterial signal control and adaptive green-wave corridor.',
      solved: false,
      beaconColor: 0x22c55e,
    },
    {
      id: 'environment',
      name: 'Bio-Resonance Clean Air Hub',
      sector: 'environment',
      coords: [68, 0, 60],
      terminalCoords: [56, 0, 52],
      promptLabel: 'CALIBRATE BIO-RESONANCE SMOG SCRUBBER',
      description: 'Harmonic frequency particulate scrubbers maintaining zero PM2.5 corridors.',
      solved: false,
      beaconColor: 0x10b981,
    },
    {
      id: 'emergency',
      name: 'Apex Trauma Hospital Microgrid',
      sector: 'emergency',
      coords: [-68, 0, 0],
      terminalCoords: [-56, 0, 0],
      promptLabel: 'ENGAGE TRAUMA ICU BACKUP POWER',
      description: 'Critical municipal emergency life-support and disaster triage center.',
      solved: false,
      beaconColor: 0xef4444,
    },
    {
      id: 'core',
      name: 'Central Arcology Nexus Core',
      sector: 'emergency',
      coords: [0, 0, 0],
      terminalCoords: [0, 0, 6],
      promptLabel: 'HARMONIZE METROPOLITAN MATRIX',
      description: 'Autonomous metropolitan intelligence brain governing all 5 municipal sectors.',
      solved: false,
      beaconColor: 0xa855f7,
    },
  ];
  const stationById = new Map(sectorStations.map(station => [station.id, station]));

  const stationTerminals: Map<string, {
    group: THREE.Group;
    beaconRing: THREE.Mesh;
    holoScreen: THREE.Mesh;
    beaconLight: THREE.PointLight;
    hologramIcon: THREE.Mesh;
    holoRings: THREE.Mesh[];
  }> = new Map();

  const terminalKioskMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.25,
  });

  const kioskAccentMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.9,
    roughness: 0.2,
  });

  // 11. High-Fidelity Futuristic Sector Kiosks & Consoles
  sectorStations.forEach(st => {
    const tGrp = new THREE.Group();
    const [tx, ty, tz] = st.terminalCoords;
    tGrp.position.set(tx, ty, tz);

    // Multi-tier chamfered pedestal base
    const basePodium = new THREE.Mesh(boxGeo, kioskAccentMat);
    basePodium.scale.set(2.0, 0.2, 1.6);
    basePodium.position.set(0, 0.1, 0);
    basePodium.castShadow = true;
    basePodium.receiveShadow = true;
    tGrp.add(basePodium);

    const base = new THREE.Mesh(boxGeo, terminalKioskMat);
    base.scale.set(1.5, 1.1, 1.0);
    base.position.set(0, 0.65, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    tGrp.add(base);

    // Side power conduits
    [-0.8, 0.8].forEach(sx => {
      const conduit = new THREE.Mesh(cylGeo, new THREE.MeshStandardMaterial({ color: st.beaconColor, emissive: st.beaconColor, emissiveIntensity: 0.8 }));
      conduit.scale.set(0.12, 1.2, 0.12);
      conduit.position.set(sx, 0.65, 0);
      tGrp.add(conduit);
    });

    // Angled operator desk
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 });
    const desk = new THREE.Mesh(boxGeo, deskMat);
    desk.scale.set(1.4, 0.15, 0.6);
    desk.position.set(0, 1.15, 0.2);
    desk.rotation.x = -Math.PI / 8;
    desk.castShadow = true;
    tGrp.add(desk);

    // Glowing trim edge
    const trimMat = new THREE.MeshBasicMaterial({ color: st.beaconColor });
    const trim = new THREE.Mesh(boxGeo, trimMat);
    trim.scale.set(1.45, 0.06, 0.06);
    trim.position.set(0, 1.25, 0.45);
    tGrp.add(trim);

    // Holographic interactive screen
    const screenMat = new THREE.MeshBasicMaterial({
      color: st.beaconColor,
      transparent: true,
      opacity: 0.85,
    });
    const holoScreen = new THREE.Mesh(boxGeo, screenMat);
    holoScreen.scale.set(1.2, 0.75, 0.05);
    holoScreen.position.set(0, 1.65, 0.05);
    holoScreen.rotation.x = -Math.PI / 7;
    tGrp.add(holoScreen);

    // Volumetric holographic projection cone
    const coneMat = new THREE.MeshBasicMaterial({
      color: st.beaconColor,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beamCone = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.1, 1.6, 16, 1, true), coneMat);
    beamCone.position.set(0, 2.0, 0);
    tGrp.add(beamCone);

    // Ground beacon light ring
    const ringMat = new THREE.MeshBasicMaterial({
      color: st.beaconColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const beaconRing = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.3, 32), ringMat);
    beaconRing.rotation.x = -Math.PI / 2;
    beaconRing.position.set(0, 0.04, 0);
    tGrp.add(beaconRing);

    // Floating rotating hologram marker above terminal
    const iconMat = new THREE.MeshBasicMaterial({
      color: st.beaconColor,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
    });
    const hologramIcon = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), iconMat);
    hologramIcon.position.set(0, 2.7, 0);
    tGrp.add(hologramIcon);

    // Dual concentric holographic gyro rings around marker
    const holoRings: THREE.Mesh[] = [];
    const ringMat1 = new THREE.MeshBasicMaterial({ color: st.beaconColor, transparent: true, opacity: 0.65 });
    const gyroRing1 = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.025, 8, 24), ringMat1);
    gyroRing1.position.set(0, 2.7, 0);
    tGrp.add(gyroRing1);
    holoRings.push(gyroRing1);

    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    const gyroRing2 = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.02, 8, 24), ringMat2);
    gyroRing2.position.set(0, 2.7, 0);
    tGrp.add(gyroRing2);
    holoRings.push(gyroRing2);

    // Beacon point light
    const beaconLight = new THREE.PointLight(st.beaconColor, 1.2, 16);
    beaconLight.position.set(0, 2.4, 0);
    beaconLight.castShadow = true;
    tGrp.add(beaconLight);

    scene.add(tGrp);
    stationTerminals.set(st.id, { group: tGrp, beaconRing, holoScreen, beaconLight, hologramIcon, holoRings });

    // Add collision for terminal pedestal
    collisionBoxes.push(
      new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(tx, ty + 0.65, tz),
        new THREE.Vector3(2.0, 1.4, 1.6)
      )
    );
  });

  // 12. Futuristic Street Furniture & Props (Solar Benches, LED Bollards, Utility Cabinets)
  const benchWoodMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.8 });
  const benchGlowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const bollardMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 });
  const bollardGlowMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });

  // Place Cybernetic Solar Benches along main sidewalks
  const benchLocations: [number, number, number, number][] = [
    [-38, 0, -15, 0],
    [-38, 0, 15, 0],
    [38, 0, -15, Math.PI],
    [38, 0, 15, Math.PI],
    [-15, 0, -23, Math.PI / 2],
    [15, 0, -23, Math.PI / 2],
    [-15, 0, 23, -Math.PI / 2],
    [15, 0, 23, -Math.PI / 2],
  ];

  benchLocations.forEach(([bx, by, bz, rotY]) => {
    const benchGrp = new THREE.Group();
    benchGrp.position.set(bx, by, bz);
    benchGrp.rotation.y = rotY;

    // Legs
    [-1.2, 1.2].forEach(lx => {
      const leg = new THREE.Mesh(boxGeo, benchWoodMat);
      leg.scale.set(0.18, 0.55, 0.7);
      leg.position.set(lx, 0.275, 0);
      leg.castShadow = true;
      benchGrp.add(leg);
    });

    // Seat with solar slat lines
    const seat = new THREE.Mesh(boxGeo, benchWoodMat);
    seat.scale.set(2.8, 0.12, 0.75);
    seat.position.set(0, 0.55, 0);
    seat.castShadow = true;
    benchGrp.add(seat);

    // Cyan underglow LED strip
    const glowStrip = new THREE.Mesh(boxGeo, benchGlowMat);
    glowStrip.scale.set(2.6, 0.03, 0.1);
    glowStrip.position.set(0, 0.48, 0.35);
    benchGrp.add(glowStrip);

    scene.add(benchGrp);
    collisionBoxes.push(
      new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(bx, by + 0.3, bz),
        new THREE.Vector3(2.8, 0.6, 0.8)
      )
    );
  });

  // Place Illuminated LED Pedestrian Bollards at key intersection corners
  const bollardCoords: [number, number][] = [
    [-41, -25], [-41, -35], [-49, -25], [-49, -35],
    [-41, 25], [-41, 35], [-49, 25], [-49, 35],
    [41, -25], [41, -35], [49, -25], [49, -35],
    [41, 25], [41, 35], [49, 25], [49, 35],
    [-6, -25], [-6, -35], [6, -25], [6, -35],
    [-6, 25], [-6, 35], [6, 25], [6, 35],
  ];

  bollardCoords.forEach(([px, pz]) => {
    const post = new THREE.Mesh(cylGeo, bollardMat);
    post.scale.set(0.26, 1.1, 0.26);
    post.position.set(px, 0.55, pz);
    post.castShadow = true;
    scene.add(post);

    const cap = new THREE.Mesh(cylGeo, bollardGlowMat);
    cap.scale.set(0.28, 0.15, 0.28);
    cap.position.set(px, 1.1, pz);
    scene.add(cap);

    collisionBoxes.push(
      new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(px, 0.55, pz),
        new THREE.Vector3(0.5, 1.2, 0.5)
      )
    );
  });

  const setSectorSolved = (stationId: string, solved: boolean) => {
    const station = sectorStations.find(s => s.id === stationId);
    if (station) {
      station.solved = solved;
    }
    const term = stationTerminals.get(stationId);
    if (term) {
      const activeColor = solved ? 0x34d399 : (station?.beaconColor || 0x38bdf8);
      (term.beaconRing.material as THREE.MeshBasicMaterial).color.set(activeColor);
      (term.holoScreen.material as THREE.MeshBasicMaterial).color.set(activeColor);
      (term.hologramIcon.material as THREE.MeshBasicMaterial).color.set(activeColor);
      term.beaconLight.color.set(activeColor);
      term.beaconLight.intensity = solved ? 1.5 : 0.8;
    }
  };

  // Click Handler for raycasting
  let disposePointerHandler = () => {};
  if (options.interactiveRaycasting && options.onSelectZone) {
    const raycaster = new THREE.Raycaster();
    const handlePointer = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(selectableObjects, true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && !obj.userData.zoneId) {
          obj = obj.parent;
        }
        if (obj && obj.userData.zoneId) {
          options.onSelectZone!(obj.userData.zoneId);
        }
      }
    };
    renderer.domElement.addEventListener('click', handlePointer);
    disposePointerHandler = () => renderer.domElement.removeEventListener('click', handlePointer);
  }

  // Animation Update
  let trainX = -100;
  let simulationTime = 0;
  let visibilityElapsed = 0;
  const update = (delta: number, state?: { timeOfDay?: number; stability?: number }) => {
    simulationTime += delta;
    visibilityElapsed += delta;
    const refreshVisibility = !options.performanceMode || visibilityElapsed >= 0.1;
    if (refreshVisibility) visibilityElapsed = 0;

    if (refreshVisibility) {
      camera.updateMatrixWorld();
      for (let i = 0; i < lodObjects.length; i++) lodObjects[i].update(camera);
      _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      _frustum.setFromProjectionMatrix(_projScreenMatrix);
    }

    const camPos = camera.position;
    if (refreshVisibility) {
      for (let i = 0; i < distanceCullableObjects.length; i++) {
        const item = distanceCullableObjects[i];
        const dx = camPos.x - item.center.x;
        const dy = camPos.y - item.center.y;
        const dz = camPos.z - item.center.z;
        item.object.visible = dx * dx + dy * dy + dz * dz <= item.maxDistSq;
      }
    }

    // 3. Move and frustum-cull traffic vehicles
    for (let i = 0; i < animatedVehicles.length; i++) {
      const v = animatedVehicles[i];
      v.mesh.position.z += v.speed * delta * v.direction;
      if (v.direction > 0 && v.mesh.position.z > v.max) {
        v.mesh.position.z = v.min;
      } else if (v.direction < 0 && v.mesh.position.z < v.min) {
        v.mesh.position.z = v.max;
      }

      // Check distance & frustum intersection to skip off-screen rendering overhead
      if (refreshVisibility) {
        const distToCamSq = (v.mesh.position.x - camPos.x) ** 2 + (v.mesh.position.z - camPos.z) ** 2;
        if (distToCamSq > 38000) {
          v.mesh.visible = false;
        } else {
          _vehicleBox.setFromCenterAndSize(v.mesh.position, _vehicleHalfExtents);
          v.mesh.visible = _frustum.intersectsBox(_vehicleBox);
        }
      }
    }

    // 4. Spin wind turbine blades (skip when far away)
    for (let i = 0; i < windTurbineBlades.length; i++) windTurbineBlades[i].rotation.z += delta * 1.8;

    // 5. Move Maglev Train
    trainX += delta * 28;
    if (trainX > 100) trainX = -100;
    trainGrp.position.x = trainX;

    // Update Crisis Visual Particle Oscillations
    crisisVisuals.forEach(grp => {
      grp.children.forEach((child, idx) => {
        if (child instanceof THREE.Mesh) {
          child.rotation.y += delta * 2;
          child.scale.setScalar(1 + Math.sin(simulationTime * 8 + idx) * 0.15);
        }
      });
    });

    // Update Protocol Pulses
    for (let i = protocolPulseMeshes.length - 1; i >= 0; i--) {
      const pMesh = protocolPulseMeshes[i];
      pMesh.scale.addScalar(delta * 25);
      const mat = pMesh.material as THREE.MeshBasicMaterial;
      pMesh.userData.life -= delta;
      mat.opacity = Math.max(0, pMesh.userData.life / 1.05 * 0.85);
      if (pMesh.userData.life <= 0) {
        scene.remove(pMesh);
        pMesh.visible = false;
        protocolPulsePool.push(pMesh);
        protocolPulseMeshes.splice(i, 1);
      }
    }

    // Pulse aviation navigation beacons on skyscraper spires
    const beaconPulse = Math.sin(simulationTime * 4);
    const beaconIntensity = beaconPulse > 0.2 ? 2.8 : 0.4;
    aviationBeacons.forEach(b => {
      if (b.mesh.material instanceof THREE.MeshStandardMaterial) {
        b.mesh.material.emissiveIntensity = beaconIntensity;
      }
    });

    // Day/Night Cycle Handling
    if (state && typeof state.timeOfDay === 'number') {
      const time = state.timeOfDay;
      const isNight = time < 6 || time > 18;
      const sunAngle = ((time - 6) / 12) * Math.PI;
      const sunHeight = Math.sin(sunAngle);
      const sunProg = Math.max(0, Math.min(1, sunHeight));

      if (!isNight) {
        sunLight.intensity = 1.4 + sunProg * 0.8;
        sunLight.position.set(85 * Math.cos(sunAngle), 60 * Math.max(0.1, sunHeight), 65);
        ambientLight.intensity = 0.28 + sunProg * 0.15;
        scene.background = new THREE.Color(0x0c1424);
        scene.fog!.color.set(0x0c1424);
      } else {
        sunLight.intensity = 0.12;
        sunLight.position.set(85, -30, 65);
        ambientLight.intensity = 0.18;
        scene.background = new THREE.Color(0x050811);
        scene.fog!.color.set(0x050811);
      }

      // Streetlights toggle
      streetLightBulbs.forEach(b => {
        b.mesh.material = isNight ? b.onMat : b.offMat;
      });

      // Building windows emissive
      buildingMaterials.forEach(bMat => {
        bMat.emissiveIntensity = isNight ? 0.85 : 0.45;
      });
    }
    // Animate Sector Terminals
    stationTerminals.forEach((term, id) => {
      term.hologramIcon.rotation.y += delta * 1.6;
      term.hologramIcon.rotation.x += delta * 0.9;
      const station = stationById.get(id);
      const isSolved = !!station?.solved;
      term.hologramIcon.position.y = 2.7 + Math.sin(simulationTime * 3) * 0.15;
      const ringScale = 1 + Math.sin(simulationTime * 4) * (isSolved ? 0.04 : 0.08);
      term.beaconRing.scale.set(ringScale, ringScale, 1);

      if (term.holoRings && term.holoRings.length >= 2) {
        term.holoRings[0].rotation.x += delta * 1.8;
        term.holoRings[0].rotation.y += delta * 1.2;
        term.holoRings[1].rotation.y -= delta * 1.5;
        term.holoRings[1].rotation.z += delta * 1.1;
      }
    });
  };

  const disposeObjectResources = (root: THREE.Object3D, disposeTextures = true) => {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    root.traverse(object => {
      const renderable = object as THREE.Mesh;
      if (renderable.geometry) geometries.add(renderable.geometry);
      const objectMaterials = Array.isArray(renderable.material)
        ? renderable.material
        : renderable.material ? [renderable.material] : [];
      objectMaterials.forEach(material => {
        materials.add(material);
        Object.values(material).forEach(value => {
          if (value instanceof THREE.Texture) textures.add(value);
        });
      });
    });
    if (disposeTextures) textures.forEach(texture => texture.dispose());
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  };

  // Trigger Visual Protocol Animation
  const triggerProtocolVisual = (type: ProtocolType) => {
    const pulseColors: Record<ProtocolType, number> = {
      energy: 0x38bdf8,
      water: 0x06b6d4,
      traffic: 0x22c55e,
      environment: 0x10b981,
      emergency: 0xef4444,
    };

    let pulseMesh = protocolPulsePool.pop();
    if (!pulseMesh && protocolPulseMeshes.length < 8) {
      pulseMesh = new THREE.Mesh(protocolPulseGeometry, new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
      }));
    }
    if (!pulseMesh) return;
    const ringMat = pulseMesh.material as THREE.MeshBasicMaterial;
    ringMat.color.setHex(pulseColors[type] || 0x28d9ec);
    ringMat.opacity = 0.85;
    pulseMesh.userData.life = 1.05;
    pulseMesh.scale.setScalar(1);
    pulseMesh.visible = true;
    pulseMesh.rotation.x = -Math.PI / 2;
    pulseMesh.position.set(0, 0.4, 0);
    scene.add(pulseMesh);
    protocolPulseMeshes.push(pulseMesh);
  };

  // Spawn 3D Crisis Visual Marker
  const spawnCrisisVisual = (crisis: CrisisInstance) => {
    if (crisisVisuals.has(crisis.id)) return;

    const grp = new THREE.Group();
    const [x, , z] = crisis.coords;
    grp.position.set(x, 0.5, z);

    // Glowing alert ring
    const alertMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(3, 4.5, 24), alertMat);
    ring.rotation.x = -Math.PI / 2;
    grp.add(ring);

    // Holographic beacon cylinder
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xff3b30,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 18, 16, 1, true), beaconMat);
    beacon.position.y = 9;
    grp.add(beacon);

    scene.add(grp);
    crisisVisuals.set(crisis.id, grp);
  };

  const removeCrisisVisual = (crisisId: string) => {
    const grp = crisisVisuals.get(crisisId);
    if (grp) {
      scene.remove(grp);
      disposeObjectResources(grp);
      crisisVisuals.delete(crisisId);
    }
  };

  let currentProtocolMesh: THREE.Group | null = null;
  const setProtocol = (type: ProtocolType | null) => {
    if (currentProtocolMesh) {
      scene.remove(currentProtocolMesh);
      disposeObjectResources(currentProtocolMesh);
      currentProtocolMesh = null;
    }
    if (!type) return;

    const grp = new THREE.Group();
    const colors: Record<ProtocolType, number> = {
      energy: 0x38bdf8,
      water: 0x06b6d4,
      traffic: 0x22c55e,
      environment: 0x10b981,
      emergency: 0xef4444,
    };
    const col = colors[type] || 0xa855f7;
    const pillarMat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9, transparent: true, opacity: 0.9 });

    // Clean orthogonal grid helper (no diagonals, preserves black base)
    const gridHelper = new THREE.GridHelper(180, 24, col, col);
    gridHelper.position.y = 0.15;
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.45;
    grp.add(gridHelper);

    // Add data pillars at key locations depending on protocol
    const pillarCoords: [number, number, number][] = type === 'energy'
      ? [[68, 0, 0], [-22, 0, 0], [-25, 0, -60]]
      : type === 'water'
      ? [[-68, 0, 60], [0, 0, 0], [45, 0, 30]]
      : type === 'traffic'
      ? [[-45, 0, 0], [0, 0, -30], [45, 0, 0]]
      : type === 'environment'
      ? [[68, 0, 60], [-22, 0, 60], [22, 0, -60]]
      : [[-68, 0, 0], [0, 0, 0], [22, 0, 0]];

    pillarCoords.forEach(([px, py, pz], idx) => {
      const h = 16 + idx * 6;
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.4, h, 16), pillarMat);
      cyl.position.set(px, py + h / 2, pz);
      grp.add(cyl);

      const ring = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.4, 24), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(px, py + h, pz);
      grp.add(ring);
    });

    scene.add(grp);
    currentProtocolMesh = grp;
  };

  const dispose = () => {
    disposePointerHandler();
    disposeObjectResources(scene, false);
    sceneOwnedTextures.forEach(texture => texture.dispose());
    scene.environment?.dispose();
    protocolPulseGeometry.dispose();
    protocolPulsePool.forEach(mesh => (mesh.material as THREE.Material).dispose());
    renderer.renderLists.dispose();
    renderer.dispose();
    scene.clear();
    if (container.contains(renderer.domElement)) {
      container.removeChild(renderer.domElement);
    }
  };

  return {
    scene,
    camera,
    renderer,
    maxPixelRatio,
    ambientLight,
    sunLight,
    selectableObjects,
    collisionBoxes,
    sectorStations,
    setSectorSolved,
    update,
    triggerProtocolVisual,
    setProtocol,
    spawnCrisisVisual,
    removeCrisisVisual,
    setRenderScale,
    dispose,
  };
}
