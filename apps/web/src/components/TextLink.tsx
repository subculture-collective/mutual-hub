import type { AnchorHTMLAttributes, PropsWithChildren } from 'react';

export const TextLink = ({
    children,
    className = '',
    ...props
}: PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement>>) => {
    return (
        <a
            className={[
                'underline',
                'text-[var(--mh-link)] hover:text-[var(--mh-danger)]',
                className,
            ].join(' ')}
            {...props}
        >
            {children}
        </a>
    );
};
