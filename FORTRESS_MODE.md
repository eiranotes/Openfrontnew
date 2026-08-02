# Fortress Mode balance

This fork changes OpenFront around two goals: compact development must remain a
real strategic option, and nuclear weapons must create an opening rather than
delete a small country outright.

## Military quality

| Highest completed city | Tier | Maximum quality |
| --- | --- | ---: |
| 1–2 | Conscript | 1.00x |
| 3–4 | Trained | 1.20x |
| 5–6 | Professional | 1.45x |
| 7–8 | Elite | 1.70x |
| 9+ | Guard | 2.00x |

Each completed city level trains 200,000 troops. If total manpower exceeds the
training capacity, quality is blended back toward 1.00x. Total manpower includes
home troops, active field armies, and troops embarked on transports.

Quality modifies casualty exchange through the square root of the quality ratio,
with safety caps. It also changes conquest speed only slightly. Opposing field
armies cancel by effective power rather than raw headcount.

## Anti-snowball rules

- Overextension begins at 20% of all land and reaches full pressure at 50%.
- At full pressure, attack losses are 35% higher and conquest costs 45% more time.
- Captured cities lose three levels; ports reset to level one.
- Factories, silos, SAMs, and defense posts are destroyed on capture.
- Human-player conquest transfers 25% of stored gold instead of 50%.

## Nuclear balance

- Atom bomb: 1.5M gold, radius 8/20.
- Hydrogen bomb: 10M gold, radius 45/65.
- MIRV warhead radius: 9/14.
- Non-MIRV troop-loss coefficient: 5 -> 2, with a 5,000-tile denominator floor.
- Silo cooldown: 25 seconds.
- First SAM: 750K, 10-second construction, 90 base range, 6-second reload.
- The default solo preset disables hydrogen bombs and MIRVs, but leaves atom
  bombs enabled for testing.
