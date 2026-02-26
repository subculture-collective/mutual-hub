import type { PropsWithChildren } from 'react';

interface PanelProps {
  title: string;
}

export const Panel = ({ title, children }: PropsWithChildren<PanelProps>) => {
  return (
    <section className="border-2 border-[var(--mh-border)] bg-[var(--mh-panel)] p-2">
      <header className="mb-3 bg-gradient-to-r from-[var(--mh-titlebar-start)] to-[var(--mh-titlebar-end)] px-2 py-1 text-sm font-bold text-white">
        {title}
      </header>
      <div className="rounded-none border-2 border-[var(--mh-border)] bg-[var(--mh-surface)] p-3">{children}</div>
    </section>
  );
};
