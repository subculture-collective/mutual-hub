import { type AidPostSummary, type DistanceBand, computeFeedScore } from "@mutual-hub/shared";

export interface RankedAid extends AidPostSummary {
  score: number;
}

export interface RankContext {
  now?: number;
  distanceBandByPostId?: Record<string, DistanceBand>;
  trustScoreByDid?: Record<string, number>;
}

export function rankAidCards(
  posts: readonly AidPostSummary[],
  context: RankContext = {},
): RankedAid[] {
  const now = context.now ?? Date.now();

  return posts
    .map((post) => {
      const distanceBand = context.distanceBandByPostId?.[post.id] ?? "mid";
      const trustScore = context.trustScoreByDid?.[post.authorDid] ?? 0.5;
      const score = computeFeedScore(
        {
          urgency: post.urgency,
          trustScore,
          distanceBand,
          createdAt: post.createdAt,
        },
        now,
      );

      return {
        ...post,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);
}
