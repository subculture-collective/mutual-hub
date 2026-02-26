import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'neutral';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClassMap: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--mh-accent)] text-black',
  secondary: 'bg-[var(--mh-accent-2)] text-black',
  neutral: 'bg-[var(--mh-surface)] text-black'
};

export const Button = ({
  children,
  className = '',
  variant = 'primary',
  ...props
}: PropsWithChildren<ButtonProps>) => {
  return (
    <button
      className={[
        'mh-button border-2 border-[var(--mh-border)] px-4 py-2 text-sm font-bold uppercase tracking-wide',
        variantClassMap[variant],
        className
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  );
};
