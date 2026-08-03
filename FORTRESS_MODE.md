# Fortress Mode balance

Fortress Mode는 영토 확장에 숨은 손실을 부과하지 않습니다. 확장은 최대 병력과 전략 공간을 늘리고, 도시·공장에 집중 투자한 국가는 효율 보너스와 높은 병력 품질을 얻습니다.

## Military quality

| Tier | Highest completed city | Total city levels | Maximum quality |
| --- | ---: | ---: | ---: |
| Conscript | 1 | 1 | 1.00x |
| Trained | 3 | 3 | 1.20x |
| Professional | 5 | 7 | 1.45x |
| Elite | 7 | 13 | 1.70x |
| Guard | 9 | 21 | 2.00x |

Each completed city level trains 200,000 troops. Total manpower includes home troops, active field armies, and troops embarked on transports. When manpower exceeds training capacity, quality blends back toward 1.00x.

Quality changes casualty exchange through the square root of the attacker/defender quality ratio, with safety caps. Opposing field armies cancel by effective power rather than raw headcount.

## Compact development

Administrative capacity is calculated from:

- base capacity: 12,000
- each completed city level: +5,000
- each completed factory: +8,000

Development density grants positive bonuses up to:

- economy: +30%
- reinforcement: +22%
- combat: +10%

Territory ownership never reduces these multipliers below 1.00x. A large state can recover maximum efficiency by building enough cities and factories.

## Conquest

- Captured cities retain half their level, rounded down with a minimum of level one.
- Captured ports reset to level one.
- Factories, silos, SAMs, and defense posts are destroyed on capture.
- Human-player conquest transfers 25% of stored gold.

## Landing operations and naval combat

- A landing command may target any owned tile in the selected enemy country.
- The game searches that country's complete border for the nearest shore connected to water reachable from the attacker.
- Shores facing disconnected inland lakes are excluded.
- Transport availability is retained during command-panel refreshes instead of being replaced with an empty buildable list.
- Transport ships have 600 health.
- Defensive warships prioritize hostile warships, then transports, then trade ships; escorts are engaged before protected transports.

## Nuclear balance

- Atom bomb: 1.5M gold, radius 8/20.
- Hydrogen bomb: 10M gold, radius 45/65.
- MIRV warhead radius: 9/14.
- Non-MIRV troop-loss coefficient: 2, with a 5,000-tile denominator floor.
- Silo cooldown: 25 seconds.
- First SAM: 750K, 10-second construction, 90 base range, 6-second reload.

The default solo preset uses World, Easy, 400 bots, Normal Map, and all units enabled.
