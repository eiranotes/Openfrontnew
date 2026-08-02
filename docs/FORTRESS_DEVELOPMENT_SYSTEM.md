# Fortress Internal Development and Military Quality

This document is the implementation contract for the Fortress economy,
administration, military-quality, and responsive UI work.

## Economic rules

- Base gold income remains `100 / tick` (`50 / tick` for bots).
- City base gold per tick is `10 * (min(cityLevel, 9) + 1)^2`.
- Administrative capacity is `sum(completed city levels) * 6,000 tiles`.
- Administrative efficiency is
  `clamp(sqrt(administrativeCapacity / ownedTiles), 0.40, 1.20)`.
- Final city income is `sum(city base gold) * administrative efficiency`.
- Next total city-level cost is
  `min(1,200,000, 100,000 + 20,000 * nextTotalCityLevel^2)`.
- Bot and nation conquest gold is 40% of captured gold.
- Human conquest gold remains 25%.

## Military-quality rules

| Highest completed city | Tier | Maximum quality |
| --- | --- | ---: |
| 0-2 | Conscript | 1.00 |
| 3-4 | Trained | 1.20 |
| 5-6 | Professional | 1.45 |
| 7-8 | Elite | 1.70 |
| 9+ | Guard | 2.00 |

- Training capacity is `sum(completed city levels) * 300,000 troops`.
- Total military manpower includes home troops, outgoing attacks, and troops
  embarked on transport ships.
- Training coverage is `min(1, trainingCapacity / totalMilitaryManpower)`.
- Effective quality is
  `1 + (tierMaximumQuality - 1) * trainingCoverage`.
- Existing combat-quality multipliers remain unchanged; this work changes
  capacity, economy, visibility, and progression clarity.

## UI requirements

- The in-game HUD exposes military tier, effective and maximum quality, trained
  manpower, capacity, coverage state, next-tier requirement, city gold income,
  and administrative efficiency.
- Mobile uses a compact one-line military status that expands on tap into a
  bottom detail sheet.
- City build and upgrade surfaces show current and next-level gold income,
  training capacity, administrative capacity, tier unlocks, and cost before
  confirmation.
- Gold-income details separate base production and city production, including
  the administrative modifier.
- Tier-up notifications are brief and non-blocking.
- Controls use at least 44px touch targets on coarse pointers, avoid hover-only
  information, and preserve map interaction space.
