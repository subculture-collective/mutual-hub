export const publicRoutes = ["/map", "/feed", "/resources", "/volunteer"] as const;

export type PublicRoute = (typeof publicRoutes)[number];

export interface ShellSection {
  route: PublicRoute;
  title: string;
  description: string;
}

export const shellSections: readonly ShellSection[] = [
  {
    route: "/map",
    title: "Map",
    description: "Discover nearby aid requests by approximate area",
  },
  {
    route: "/feed",
    title: "Feed",
    description: "Browse fresh and urgent requests",
  },
  {
    route: "/resources",
    title: "Resources",
    description: "Find verified shelters, clinics, and food banks",
  },
  {
    route: "/volunteer",
    title: "Volunteer",
    description: "Join as a volunteer with skills and availability",
  },
];

export function isPublicRoute(route: string): route is PublicRoute {
  return publicRoutes.includes(route as PublicRoute);
}
