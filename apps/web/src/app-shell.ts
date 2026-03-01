export const publicRoutes = [
    '/map',
    '/feed',
    '/resources',
    '/volunteer',
    '/settings',
] as const;

export type PublicRoute = (typeof publicRoutes)[number];

export interface ShellSection {
    route: PublicRoute;
    title: string;
    description: string;
}

export const shellSections: readonly ShellSection[] = [
    {
        route: '/map',
        title: 'Map',
        description: 'Clustered, approximate-area discovery with quick triage.',
    },
    {
        route: '/feed',
        title: 'Feed',
        description: 'Latest + nearby request stream with lifecycle actions.',
    },
    {
        route: '/resources',
        title: 'Resources',
        description: 'Directory overlays and partner resources.',
    },
    {
        route: '/volunteer',
        title: 'Volunteer',
        description: 'Volunteer onboarding and profile management.',
    },
    {
        route: '/settings',
        title: 'Settings',
        description: 'Account settings, privacy controls, and data management.',
    },
];

export const isPublicRoute = (value: string): value is PublicRoute => {
    return publicRoutes.includes(value as PublicRoute);
};
