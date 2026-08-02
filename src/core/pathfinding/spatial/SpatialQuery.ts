import { Game, Player, TerraNullius } from "../../game/Game";
import { TileRef } from "../../game/GameMap";
import {
  bumpTraversalGeneration,
  tileTraversalScratch,
} from "../../game/TileTraversalScratch";
import { DebugSpan } from "../../utilities/DebugSpan";
import { PathFinding } from "../PathFinder";
import { AStarWaterBounded } from "../algorithms/AStar.WaterBounded";

type Owner = Player | TerraNullius;

const REFINE_MAX_SEARCH_AREA = 100 * 100;

export class SpatialQuery {
  private boundedAStar: AStarWaterBounded | null = null;

  constructor(private game: Game) {}

  private getBoundedAStar(): AStarWaterBounded {
    this.boundedAStar ??= new AStarWaterBounded(
      this.game.map(),
      REFINE_MAX_SEARCH_AREA,
    );

    return this.boundedAStar;
  }

  /**
   * Find nearest tile matching predicate using BFS traversal.
   * Uses Manhattan distance filter, ignores terrain barriers.
   */
  private bfsNearest(
    from: TileRef,
    maxDist: number,
    predicate: (t: TileRef) => boolean,
  ): TileRef | null {
    const map = this.game.map();
    // `from` can trace back to a network intent. `visited` is a Uint32Array, so
    // a fractional ref makes `visited[t] = gen` a silent no-op that always reads
    // back undefined — the dedup fails and the stack grows until it OOMs. Every
    // caller is individually guarded today; this keeps the trap from being
    // re-armed by a future one.
    if (!map.isValidRef(from)) return null;
    const scratch = tileTraversalScratch(this.game);
    const gen = bumpTraversalGeneration(scratch);
    const visited = scratch.visited;
    const stack = scratch.stack;
    stack.length = 0;

    // Strict < keeps the first candidate at the minimum distance, so the
    // winner depends only on the deterministic traversal order (LIFO with
    // neighbors visited in the shared N, S, W, E order).
    let best: TileRef | null = null;
    let bestDist = Infinity;

    const mark = (t: TileRef) => {
      visited[t] = gen;
      stack.push(t);
      if (predicate(t)) {
        const dist = map.manhattanDist(from, t);
        if (dist < bestDist) {
          best = t;
          bestDist = dist;
        }
      }
    };

    if (maxDist >= 0) {
      mark(from);
    }
    const visit = (n: TileRef) => {
      if (visited[n] !== gen && map.manhattanDist(from, n) <= maxDist) {
        mark(n);
      }
    };
    while (stack.length > 0) {
      const curr = stack.pop()!;
      map.forEachNeighbor(curr, visit);
    }

    return best;
  }

  /**
   * Find closest shore tile by land BFS.
   * Works for both players and terra nullius.
   */
  closestShore(
    owner: Owner,
    tile: TileRef,
    maxDist: number = 50,
  ): TileRef | null {
    const gm = this.game;
    const ownerId = owner.smallID();

    const isValidTile = (t: TileRef) => {
      if (!gm.isShore(t) || !gm.isLand(t)) return false;
      const tOwner = gm.ownerID(t);
      return tOwner === ownerId;
    };

    return this.bfsNearest(tile, maxDist, isValidTile);
  }

  /**
   * Find the closest shore tile owned by `targetOwner` that sits on a water
   * component reachable from `attacker`'s own shoreline.
   *
   * Player territory is searched across its complete border. This lets a
   * country-level landing command work even when the selected tile is deep
   * inland. Terra nullius still uses the bounded local search because it has no
   * maintained border set.
   */
  closestReachableShore(
    targetOwner: Owner,
    attacker: Player,
    tile: TileRef,
    maxDist: number = 50,
  ): TileRef | null {
    const gm = this.game;
    const map = gm.map();
    const targetId = targetOwner.smallID();

    // Read component IDs from adjacent water tiles instead of asking for one
    // arbitrary component on a shore that may touch multiple water bodies.
    const reachable = new Set<number>();
    for (const shore of attacker.borderTiles()) {
      if (!gm.isShore(shore) || !gm.isLand(shore)) continue;
      map.forEachNeighbor(shore, (neighbor) => {
        if (!gm.isWater(neighbor)) return;
        const component = gm.getWaterComponent(neighbor);
        if (component !== null) reachable.add(component);
      });
    }
    if (reachable.size === 0) return null;

    const isValidTile = (candidate: TileRef) => {
      if (!gm.isShore(candidate) || !gm.isLand(candidate)) return false;
      if (gm.ownerID(candidate) !== targetId) return false;

      let touchesReachableWater = false;
      map.forEachNeighbor(candidate, (neighbor) => {
        if (touchesReachableWater || !gm.isWater(neighbor)) return;
        const component = gm.getWaterComponent(neighbor);
        touchesReachableWater =
          component !== null && reachable.has(component);
      });
      return touchesReachableWater;
    };

    if (!targetOwner.isPlayer()) {
      return this.bfsNearest(tile, maxDist, isValidTile);
    }

    let best: TileRef | null = null;
    let bestDist = Infinity;
    for (const candidate of targetOwner.borderTiles()) {
      if (!isValidTile(candidate)) continue;
      const distance = map.manhattanDist(tile, candidate);
      if (
        distance < bestDist ||
        (distance === bestDist && (best === null || candidate < best))
      ) {
        best = candidate;
        bestDist = distance;
      }
    }
    return best;
  }

  /**
   * Find closest shore tile by water pathfinding.
   * Returns null for terra nullius (no borderTiles).
   */
  closestShoreByWater(owner: Owner, target: TileRef): TileRef | null {
    return DebugSpan.wrap("SpatialQuery.closestShoreByWater", () => {
      if (!owner.isPlayer()) return null;

      const gm = this.game;
      const player = owner as Player;

      // Target must be water or shore (land adjacent to water)
      if (!gm.isWater(target) && !gm.isShore(target)) return null;

      const targetComponent = gm.getWaterComponent(target);
      if (targetComponent === null) return null;

      const isValidTile = (t: TileRef) => {
        if (!gm.isShore(t) || !gm.isLand(t)) return false;
        const tComponent = gm.getWaterComponent(t);
        return tComponent === targetComponent;
      };

      const shores = Array.from(player.borderTiles()).filter(isValidTile);
      if (shores.length === 0) return null;

      const path = PathFinding.Water(gm).findPath(shores, target);
      if (!path || path.length === 0) return null;

      return DebugSpan.wrap("SpatialQuery.refineStartTile", () =>
        this.refineStartTile(path, shores, gm),
      );
    });
  }

  private refineStartTile(
    path: TileRef[],
    shores: TileRef[],
    gm: Game,
  ): TileRef {
    const CANDIDATE_RADIUS = 20;
    const MIN_WAYPOINT_DIST = 50;
    const MAX_WAYPOINT_DIST = 200;
    const PADDING = 10;

    if (path.length <= MIN_WAYPOINT_DIST) {
      return path[0];
    }

    const bestTile = path[0];
    const map = gm.map();

    const candidates = shores.filter(
      (s) => map.manhattanDist(s, bestTile) <= CANDIDATE_RADIUS,
    );

    if (candidates.length <= 1) return bestTile;

    // Precompute candidate bounds
    let candMinX = map.x(candidates[0]);
    let candMaxX = candMinX;
    let candMinY = map.y(candidates[0]);
    let candMaxY = candMinY;

    for (let i = 1; i < candidates.length; i++) {
      const sx = map.x(candidates[i]);
      const sy = map.y(candidates[i]);
      candMinX = Math.min(candMinX, sx);
      candMaxX = Math.max(candMaxX, sx);
      candMinY = Math.min(candMinY, sy);
      candMaxY = Math.max(candMaxY, sy);
    }

    // Binary search for furthest waypoint that keeps bounds within limit
    let lo = MIN_WAYPOINT_DIST;
    let hi = Math.min(MAX_WAYPOINT_DIST, path.length - 1);
    let bestWaypointIdx = lo;

    for (let i = 0; i < 5 && lo <= hi; i++) {
      const mid = (lo + hi) >> 1;
      const wp = path[mid];
      const wpX = map.x(wp);
      const wpY = map.y(wp);

      const minX = Math.min(candMinX, wpX) - PADDING;
      const maxX = Math.max(candMaxX, wpX) + PADDING;
      const minY = Math.min(candMinY, wpY) - PADDING;
      const maxY = Math.max(candMaxY, wpY) + PADDING;

      const area = (maxX - minX + 1) * (maxY - minY + 1);
      if (area <= REFINE_MAX_SEARCH_AREA) {
        bestWaypointIdx = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    const waypoint = path[bestWaypointIdx];
    const wpX = map.x(waypoint);
    const wpY = map.y(waypoint);

    const bounds = {
      minX: Math.max(0, Math.min(candMinX, wpX) - PADDING),
      maxX: Math.min(map.width() - 1, Math.max(candMaxX, wpX) + PADDING),
      minY: Math.max(0, Math.min(candMinY, wpY) - PADDING),
      maxY: Math.min(map.height() - 1, Math.max(candMaxY, wpY) + PADDING),
    };

    const boundsArea =
      (bounds.maxX - bounds.minX + 1) * (bounds.maxY - bounds.minY + 1);
    if (boundsArea > REFINE_MAX_SEARCH_AREA) return bestTile;

    const refinedPath = this.getBoundedAStar().searchBounded(
      candidates,
      waypoint,
      bounds,
    );

    DebugSpan.set("$candidates", () => candidates);
    DebugSpan.set("$refinedPath", () => refinedPath);
    DebugSpan.set("$originalBestTile", () => bestTile);
    DebugSpan.set("$newBestTile", () => refinedPath?.[0] ?? bestTile);

    return refinedPath?.[0] ?? bestTile;
  }
}
