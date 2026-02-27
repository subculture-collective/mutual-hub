import type { PropsWithChildren } from 'react';

interface BadgeProps {
    tone?: 'default' | 'neutral' | 'info' | 'danger' | 'success';
}

const toneMap: Record<NonNullable<BadgeProps['tone']>, string> = {
    default: 'bg-mh-accent3 text-black',
    neutral: 'bg-mh-surfaceElev text-mh-text',
    info: 'bg-mh-accent2 text-white',
    danger: 'bg-mh-danger text-black',
    success: 'bg-mh-success text-black',
};

export const Badge = ({
    children,
    tone = 'default',
}: PropsWithChildren<BadgeProps>) => {
    return (
        <span
            className={[
                'inline-flex rounded-none border-2 border-mh-border px-2 py-1 text-xs font-bold uppercase tracking-[0.12em]',
                toneMap[tone],
            ].join(' ')}
        >
            {children}
        </span>
    );
};
