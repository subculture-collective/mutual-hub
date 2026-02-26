import type { PropsWithChildren } from 'react';

interface CardProps {
  title: string;
}

export const Card = ({ title, children }: PropsWithChildren<CardProps>) => {
  return (
    <article className="border-2 border-[var(--mh-border)] bg-[var(--mh-surface)] p-4 shadow-[8px_8px_0_0_var(--mh-border)]">
      <h2 className="font-heading text-xl font-black uppercase">{title}</h2>
      <div className="mt-3 text-sm text-[var(--mh-text-muted)]">{children}</div>
    </article>
  );
};
