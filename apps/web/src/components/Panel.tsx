import type { PropsWithChildren } from 'react';

interface PanelProps {
    title: string;
}

export const Panel = ({ title, children }: PropsWithChildren<PanelProps>) => {
    return (
        <section className='mh-panel-shell p-2'>
            <header className='mh-panel-titlebar mb-3 px-2 py-1 text-sm font-bold text-white'>
                {title}
            </header>
            <div className='mh-texture-dots rounded-none border-2 border-(--mh-border) bg-(--mh-surface) p-3'>
                {children}
            </div>
        </section>
    );
};
