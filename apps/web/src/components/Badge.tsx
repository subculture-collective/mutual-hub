import type { PropsWithChildren } from 'react';

interface BadgeProps {
    tone?: 'default' | 'neutral' | 'info' | 'danger' | 'success';
}

const toneMap: Record<NonNullable<BadgeProps['tone']>, string> = {
    default: 'bg-mh-accent3 text-mh-text',
    neutral: 'bg-mh-surfaceElev text-mh-text',
    info: 'bg-mh-accent2 text-mh-text',
    danger: 'bg-mh-danger text-white',
    success: 'bg-mh-success text-white',
};

export const Badge = ({
    children,
    tone = 'default',
}: PropsWithChildren<BadgeProps>) => {
    return (
        <span
            className={[
                'inline-flex min-w-0 max-w-full break-all whitespace-normal rounded-full border border-mh-border px-2.5 py-1 text-xs font-semibold tracking-[0.01em]',
                toneMap[tone],
            ].join(' ')}
        >
            {children}
        </span>
    );
};
