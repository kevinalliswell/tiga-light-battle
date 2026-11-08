export const LAST_STAND_SECONDS = 30;

/** The same countdown continues through attacks; repeated hits cannot restart it. */
export class LastStand {
  remaining: number | null = null;

  reset() { this.remaining = null; }

  update(health: number, human: boolean, cleared: boolean, delta: number) {
    // Clearing the battlefield always wins, including a zero-health finishing hit.
    if (cleared || health > 0) {
      this.reset();
      return cleared ? 'victory' : 'normal';
    }
    if (human) return 'defeated';
    this.remaining = Math.max(0, (this.remaining ?? LAST_STAND_SECONDS) - delta);
    return this.remaining > 0 ? 'active' : 'defeated';
  }
}
