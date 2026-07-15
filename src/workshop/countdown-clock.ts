/** Options used when re-anchoring a Workshop HUD countdown. */
export interface HUDCountdownReanchorOptions {
  /** Whether game time is currently advancing. */
  running: boolean;
  /** Local monotonic timestamp. Defaults to `performance.now()`. */
  nowMs?: number;
  /** Measured host-to-HUD latency to remove from the authoritative remainder. */
  transportLatencyMs?: number;
}

function monotonicNowMs(): number {
  if (typeof performance !== 'undefined') {
    const now = performance.now();
    if (Number.isFinite(now)) return now;
  }
  return Date.now();
}

/**
 * Locally interpolates a match countdown between authoritative game updates.
 *
 * Re-anchor only when the authoritative timer value or running state changes;
 * repeatedly anchoring identical high-frequency snapshots would prevent local
 * time from advancing.
 */
export class HUDCountdownClock {
  private anchorRemainingMs: number | null = null;
  private anchoredAtMs = 0;
  private running = false;

  /** Whether at least one valid authoritative value has been received. */
  get hasAnchor(): boolean {
    return this.anchorRemainingMs !== null;
  }

  /** Clear the current authoritative anchor. */
  reset(): void {
    this.anchorRemainingMs = null;
    this.anchoredAtMs = 0;
    this.running = false;
  }

  /**
   * Replace the authoritative anchor.
   *
   * Returns `false` and preserves the previous anchor when the supplied game
   * values are invalid.
   */
  reanchor(
    maxTimeMs: number,
    currentTimeMs: number,
    options: HUDCountdownReanchorOptions,
  ): boolean {
    if (
      !Number.isFinite(maxTimeMs) ||
      maxTimeMs <= 0 ||
      !Number.isFinite(currentTimeMs)
    ) {
      return false;
    }

    const candidateNow = options.nowMs ?? monotonicNowMs();
    const nowMs = Number.isFinite(candidateNow)
      ? candidateNow
      : monotonicNowMs();
    const candidateLatency = options.transportLatencyMs ?? 0;
    const transportLatencyMs = Number.isFinite(candidateLatency)
      ? Math.max(0, candidateLatency)
      : 0;
    const authoritativeRemainingMs = Math.max(
      0,
      maxTimeMs - currentTimeMs,
    );

    this.running = options.running;
    this.anchorRemainingMs = Math.max(
      0,
      authoritativeRemainingMs -
        (this.running ? transportLatencyMs : 0),
    );
    this.anchoredAtMs = nowMs;
    return true;
  }

  /** Remaining milliseconds at `nowMs`, or `null` before the first anchor. */
  getRemainingMs(nowMs: number = monotonicNowMs()): number | null {
    if (this.anchorRemainingMs === null) return null;
    if (!this.running || !Number.isFinite(nowMs)) {
      return this.anchorRemainingMs;
    }
    const elapsedMs = Math.max(0, nowMs - this.anchoredAtMs);
    return Math.max(0, this.anchorRemainingMs - elapsedMs);
  }
}
