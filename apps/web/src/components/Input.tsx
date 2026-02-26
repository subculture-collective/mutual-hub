import type { InputHTMLAttributes } from 'react';

export const Input = ({
    className = '',
    ...props
}: InputHTMLAttributes<HTMLInputElement>) => {
    return (
        <input
            className={[
                'min-h-11 w-full border-2 px-3 py-2 text-sm',
                'border-[color:var(--mh-border-dark)_var(--mh-border-light)_var(--mh-border-light)_var(--mh-border-dark)]',
                'bg-white text-[var(--mh-text)]',
                className,
            ].join(' ')}
            {...props}
        />
    );
};
