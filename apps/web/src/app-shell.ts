export const publicRoutes = [
    '/map',
    '/feed',
    '/resources',
    '/volunteer',
    '/settings',
    '/moderation',
    '/inbox',
    '/feedback',
    '/legal/terms',
    '/legal/privacy',
    '/legal/community-guidelines',
] as const;

export type PublicRoute = (typeof publicRoutes)[number];

export interface ShellSection {
    route: PublicRoute;
    title: string;
    description: string;
    requiresRole?: string;
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
    {
        route: '/moderation',
        title: 'Moderation',
        description: 'Moderator operations console for queue triage, policy actions, and audit review.',
        requiresRole: 'moderator',
    },
    {
        route: '/inbox',
        title: 'Inbox',
        description: 'Unified inbox for requests, assignments, messages, and alerts.',
    },
    {
        route: '/feedback',
        title: 'Feedback',
        description: 'Post-handoff outcome feedback and reporting.',
    },
    {
        route: '/legal/terms',
        title: 'Terms of Service',
        description: 'Platform terms of service and user agreement.',
    },
    {
        route: '/legal/privacy',
        title: 'Privacy Policy',
        description: 'How we collect, use, and protect your data.',
    },
    {
        route: '/legal/community-guidelines',
        title: 'Community Guidelines',
        description: 'Expected behaviour, prohibited content, and enforcement.',
    },
];

export const isPublicRoute = (value: string): value is PublicRoute => {
    return publicRoutes.includes(value as PublicRoute);
};
