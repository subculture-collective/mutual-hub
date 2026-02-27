import type { PropsWithChildren } from 'react';

interface PanelProps {
    title: string;
}

export const Panel = ({ title, children }: PropsWithChildren<PanelProps>) => {
    return (
        <section className='mh-panel-shell p-2 sm:p-3'>
            <header className='mh-panel-titlebar mb-3 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-mh-text'>
                {title}
            </header>
            <div className='mh-texture-dots mh-grid-pattern rounded-none border-2 border-mh-border bg-mh-surface p-4'>
                {children}
            </div>
        </section>
    );
};
