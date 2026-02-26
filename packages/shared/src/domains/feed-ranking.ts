export type DistanceBand = "near" | "mid" | "far";

export interface FeedRankSignals {
  urgency: number;
  trustScore: number;
  distanceBand: DistanceBand;
  createdAt: string;
}

const distanceWeight: Record<DistanceBand, number> = {
  near: 1,
  mid: 0.7,
  far: 0.45,
};

export function computeFeedScore(signals: FeedRankSignals, now = Date.now()): number {
  const createdAtMs = Date.parse(signals.createdAt);
  const ageHours = Number.isNaN(createdAtMs) ? 24 : Math.max(0, (now - createdAtMs) / 3_600_000);
  const recency = 1 / (1 + ageHours / 6);

  return (
    signals.urgency * 0.45 +
    signals.trustScore * 0.25 +
    distanceWeight[signals.distanceBand] * 0.2 +
    recency * 0.1
  );
}
