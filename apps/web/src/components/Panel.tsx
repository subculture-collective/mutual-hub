import type { PropsWithChildren } from 'react';

interface PanelProps {
    title: string;
}

export const Panel = ({ title, children }: PropsWithChildren<PanelProps>) => {
    return (
        <section className='mh-panel-shell p-3 sm:p-4'>
            <header className='mh-panel-titlebar mb-3 px-3 py-2 text-sm font-semibold tracking-[0.01em] text-mh-text'>
                {title}
            </header>
            <div className='mh-grid-pattern rounded-2xl border border-mh-borderSoft bg-mh-surface p-4'>
                {children}
            </div>
        </section>
    );
};
