# Landing operations and command UI correction

## Root causes

1. `PlayerPanel.tick()` refreshed country actions with `units = null`. `GameRunner.playerActions()` defines that value as an explicit request for no buildable units, so `buildableUnits` became empty and the landing action disappeared.
2. `SpatialQuery.closestReachableShore()` searched only 50 tiles around the selected tile. Selecting deep inland territory in a large country therefore returned no shore even when a valid connected coast existed.
3. Periodic action requests could overlap and an older response could overwrite a newer country selection.
4. Ground attack and landing used the same target icon and did not show the current committed troop amount.

## Implemented behavior

- Country command refreshes request `TransportShip` availability explicitly every five ticks and prevent overlapping refreshes.
- Every selection has a revision number; obsolete async results are discarded.
- Tile reference zero is handled as a valid tile in `PlayerView` worker requests.
- Player targets search their complete border and only accept shores touching a water component reachable from the attacker.
- Neutral territory retains the bounded local search.
- Landing uses a boat icon and a sky/naval visual variant.
- Ground attack and landing show the selected attack percentage and estimated committed troops.
- Duplicate dock entrance keyframes were removed.

## Regression coverage

`tests/LandingOperations.test.ts` verifies:

- a player-country landing resolves beyond the former local search radius;
- periodic command refreshes keep transport buildability and accept tile zero;
- a stale async refresh cannot replace a newer selection.

The test module is imported by the existing targeted alliance suite so the current Fortress CI executes it.

## Remaining UI work

The next UI milestone remains the city-development/build flow: non-modal mobile construction sheet, upgrade effect preview, map-level city progression, and opponent military-quality comparison. These should be implemented against the current positive internal-development rules rather than the retired overextension model.
