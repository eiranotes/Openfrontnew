import {
  allianceGoldSupportAmount,
  allianceTroopSupportAmount,
} from "../game/AllianceCoordination";
import { Execution, Game, Player, PlayerID, PlayerType } from "../game/Game";
import { DonateGoldExecution } from "./DonateGoldExecution";
import { DonateTroopsExecution } from "./DonateTroopExecution";

export class QuickChatExecution implements Execution {
  private recipient: Player;
  private mg: Game;

  private active = true;

  constructor(
    private sender: Player,
    private recipientID: PlayerID,
    private quickChatKey: string,
    private target: PlayerID | undefined,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    if (!mg.hasPlayer(this.recipientID)) {
      console.warn(
        `QuickChatExecution: recipient ${this.recipientID} not found`,
      );
      this.active = false;
      return;
    }

    this.recipient = mg.player(this.recipientID);
  }

  tick(ticks: number): void {
    if (!this.sender.canSendQuickChat(this.recipient)) {
      this.active = false;
      return;
    }

    const message = this.getMessageFromKey(this.quickChatKey);

    this.sender.recordQuickChat(this.recipient);

    this.mg.displayChat(
      message[1],
      message[0],
      this.target,
      this.recipient.id(),
      true,
      this.sender.id(),
    );

    this.mg.displayChat(
      message[1],
      message[0],
      this.target,
      this.sender.id(),
      false,
      this.recipient.id(),
    );

    console.log(
      `[QuickChat] ${this.sender.name} → ${this.recipient.displayName}: ${message}`,
    );

    this.respondToAllianceSupportRequest();
    this.active = false;
  }

  owner(): Player {
    return this.sender;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  private respondToAllianceSupportRequest(): void {
    if (
      this.recipient.type() === PlayerType.Human ||
      !this.recipient.isFriendly(this.sender)
    ) {
      return;
    }

    if (this.quickChatKey === "help.gold") {
      const amount = allianceGoldSupportAmount(this.recipient.gold());
      if (amount <= 0n || !this.recipient.canDonateGold(this.sender)) return;
      if (amount > 0n) {
        this.mg.addExecution(
          new DonateGoldExecution(
            this.recipient,
            this.sender.id(),
            Number(amount),
          ),
        );
      }
      return;
    }

    if (this.quickChatKey === "help.troops") {
      const amount = allianceTroopSupportAmount(
        this.recipient.troops(),
        this.mg.config().maxTroops(this.recipient),
      );
      if (amount <= 0 || !this.recipient.canDonateTroops(this.sender)) return;
      if (amount > 0) {
        this.mg.addExecution(
          new DonateTroopsExecution(this.recipient, this.sender.id(), amount),
        );
      }
    }
  }

  private getMessageFromKey(fullKey: string): string[] {
    const translated = fullKey.split(".");
    return translated;
  }
}
