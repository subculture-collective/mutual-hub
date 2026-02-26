import type { AidPostSummary, AidStatus } from "@mutual-hub/shared";

export interface AidQueryFilter {
  category?: AidPostSummary["category"];
  status?: AidStatus;
  minUrgency?: number;
}

export function filterAidPosts(
  posts: readonly AidPostSummary[],
  filter: AidQueryFilter,
): AidPostSummary[] {
  return posts.filter((post) => {
    if (filter.category && post.category !== filter.category) {
      return false;
    }

    if (filter.status && post.status !== filter.status) {
      return false;
    }

    if (filter.minUrgency && post.urgency < filter.minUrgency) {
      return false;
    }

    return true;
  });
}
