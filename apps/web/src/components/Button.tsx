import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'neutral';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
}

const variantClassMap: Record<ButtonVariant, string> = {
    primary: 'mh-button--primary',
    secondary: 'mh-button--secondary',
    neutral: 'mh-button--neutral',
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
                'mh-button inline-flex items-center justify-center px-4 py-2 text-sm font-semibold tracking-[0.01em] transition',
                variantClassMap[variant],
                className,
            ].join(' ')}
            {...props}
        >
            {children}
        </button>
    );
};
