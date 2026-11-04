import * as THREE from 'three';

/** Static XZ broad phase for the city's immutable axis-aligned collision boxes. */
export class SpatialCollisionIndex {
  readonly boxes: readonly THREE.Box3[];
  private readonly cellSize: number;
  private readonly cells = new Map<number, number[]>();
  private readonly lastVisited: Uint32Array;
  private generation = 0;
  private readonly candidates: number[] = [];

  constructor(boxes: readonly THREE.Box3[], cellSize = 16) {
    this.boxes = boxes;
    this.cellSize = cellSize;
    this.lastVisited = new Uint32Array(boxes.length);

    boxes.forEach((box, index) => {
      const minX = Math.floor(box.min.x / cellSize);
      const maxX = Math.floor(box.max.x / cellSize);
      const minZ = Math.floor(box.min.z / cellSize);
      const maxZ = Math.floor(box.max.z / cellSize);
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          const key = this.cellKey(x, z);
          let cell = this.cells.get(key);
          if (!cell) {
            cell = [];
            this.cells.set(key, cell);
          }
          cell.push(index);
        }
      }
    });
  }

  queryXZ(minX: number, maxX: number, minZ: number, maxZ: number): readonly number[] {
    this.candidates.length = 0;
    this.generation++;
    if (this.generation === 0xffffffff) {
      this.lastVisited.fill(0);
      this.generation = 1;
    }

    const startX = Math.floor(minX / this.cellSize);
    const endX = Math.floor(maxX / this.cellSize);
    const startZ = Math.floor(minZ / this.cellSize);
    const endZ = Math.floor(maxZ / this.cellSize);
    for (let z = startZ; z <= endZ; z++) {
      for (let x = startX; x <= endX; x++) {
        const cell = this.cells.get(this.cellKey(x, z));
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          const boxIndex = cell[i];
          if (this.lastVisited[boxIndex] === this.generation) continue;
          this.lastVisited[boxIndex] = this.generation;
          this.candidates.push(boxIndex);
        }
      }
    }
    return this.candidates;
  }

  private cellKey(x: number, z: number): number {
    // These game-world coordinates fit comfortably within this signed-key range.
    return z * 4096 + x;
  }
}
