import type { PropsWithChildren } from 'react';

interface BadgeProps {
    tone?: 'default' | 'danger' | 'success';
}

const toneMap: Record<NonNullable<BadgeProps['tone']>, string> = {
    default: 'bg-[var(--mh-accent-3)] text-black',
    danger: 'bg-[var(--mh-danger)] text-white',
    success: 'bg-[var(--mh-success)] text-white',
};

export const Badge = ({
    children,
    tone = 'default',
}: PropsWithChildren<BadgeProps>) => {
    return (
        <span
            className={[
                'inline-flex rounded-sm border-2 border-[var(--mh-border)] px-2 py-1 text-xs font-bold uppercase tracking-wide',
                toneMap[tone],
            ].join(' ')}
        >
            {children}
        </span>
    );
};
