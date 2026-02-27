import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'neutral';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
}

const variantClassMap: Record<ButtonVariant, string> = {
    primary: 'bg-[var(--mh-accent)] text-black',
    secondary: 'bg-[var(--mh-accent-2)] text-white',
    neutral: 'bg-[var(--mh-surface-elev)] text-white',
};

export const Button = ({
    children,
    className = '',
    variant = 'primary',
    type = 'button',
    ...props
}: PropsWithChildren<ButtonProps>) => {
    return (
        <button
            type={type}
            className={[
                'mh-button rounded-none px-4 py-2 text-sm font-bold uppercase tracking-[0.1em]',
                variantClassMap[variant],
                className,
            ].join(' ')}
            {...props}
        >
            {children}
        </button>
    );
};
