import { type AidCategory, type AidStatus, aidCategories } from "@mutual-hub/shared";

import { type DiscoveryFilterState, type FeedTab, aidStatuses } from "./discovery-filters.js";

export interface DiscoveryFilterChip<TValue extends string | number = string> {
  id: string;
  label: string;
  value: TValue;
  active: boolean;
}

export interface DiscoveryFilterChipModel {
  tabs: readonly DiscoveryFilterChip<FeedTab>[];
  categories: readonly DiscoveryFilterChip<AidCategory>[];
  statuses: readonly DiscoveryFilterChip<AidStatus>[];
  urgencyLevels: readonly DiscoveryFilterChip<1 | 2 | 3 | 4 | 5>[];
}

const categoryLabels: Record<AidCategory, string> = {
  food: "Food",
  shelter: "Shelter",
  medical: "Medical",
  transport: "Transport",
  childcare: "Childcare",
  supplies: "Supplies",
  other: "Other",
};

const statusLabels: Record<AidStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  closed: "Closed",
};

const urgencyLabels: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Urgency 1+",
  2: "Urgency 2+",
  3: "Urgency 3+",
  4: "Urgency 4+",
  5: "Urgency 5",
};

const tabLabels: Record<FeedTab, string> = {
  latest: "Latest",
  nearby: "Nearby",
};

const urgencyOptions = [1, 2, 3, 4, 5] as const;
const feedTabOptions = ["latest", "nearby"] as const;

export function buildDiscoveryFilterChipModel(
  state: DiscoveryFilterState,
): DiscoveryFilterChipModel {
  return {
    tabs: feedTabOptions.map((tab) => ({
      id: `tab-${tab}`,
      label: tabLabels[tab],
      value: tab,
      active: state.feedTab === tab,
    })),
    categories: aidCategories.map((category) => ({
      id: `category-${category}`,
      label: categoryLabels[category],
      value: category,
      active: state.category === category,
    })),
    statuses: aidStatuses.map((status) => ({
      id: `status-${status}`,
      label: statusLabels[status],
      value: status,
      active: state.status === status,
    })),
    urgencyLevels: urgencyOptions.map((urgency) => ({
      id: `urgency-${urgency}`,
      label: urgencyLabels[urgency],
      value: urgency,
      active: state.minUrgency === urgency,
    })),
  };
}
