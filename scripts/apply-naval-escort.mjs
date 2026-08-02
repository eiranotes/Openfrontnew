import fs from "node:fs";
import path from "node:path";
const root = path.resolve(process.argv[2] ?? ".");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const write = (p, c) => fs.writeFileSync(path.join(root, p), c);
function replaceOnce(file, before, after, label) {
  let content = read(file);
  if (content.includes(after)) return;
  if (!content.includes(before)) throw new Error(`Naval patch anchor missing: ${label}`);
  write(file, content.replace(before, after));
}
replaceOnce(
  "src/core/configuration/Config.ts",
  `      case UnitType.TransportShip:
        info = {
          cost: () => 0n,
        };`,
  `      case UnitType.TransportShip:
        info = {
          cost: () => 0n,
          maxHealth: 600,
        };`,
  "transport health",
);
replaceOnce(
  "src/core/execution/WarshipExecution.ts",
  `      const typePriority =
        type === UnitType.TransportShip ? 0 : type === UnitType.Warship ? 1 : 2;`,
  `      // Hostile escorts must be cleared before transports can be farmed.
      const typePriority =
        type === UnitType.Warship ? 0 : type === UnitType.TransportShip ? 1 : 2;`,
  "escort priority",
);
replaceOnce(
  "src/core/execution/WarshipExecution.ts",
  `    if (this.mg.ticks() - this.lastShellAttack > shellAttackRate) {
      if (this.warship.targetUnit()?.type() !== UnitType.TransportShip) {
        // Warships don't need to reload when attacking transport ships.
        this.lastShellAttack = this.mg.ticks();
      }
      this.mg.addExecution(`,
  `    if (this.mg.ticks() - this.lastShellAttack > shellAttackRate) {
      this.lastShellAttack = this.mg.ticks();
      this.mg.addExecution(`,
  "transport reload",
);
console.log("Applied naval escort and transport survivability rules.");
