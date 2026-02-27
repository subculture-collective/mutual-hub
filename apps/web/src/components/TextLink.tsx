import type { AnchorHTMLAttributes, PropsWithChildren } from 'react';

export const TextLink = ({
    children,
    className = '',
    ...props
}: PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement>>) => {
    return (
        <a
            className={['mh-link cursor-pointer', className].join(' ')}
            {...props}
        >
            {children}
        </a>
    );
};
