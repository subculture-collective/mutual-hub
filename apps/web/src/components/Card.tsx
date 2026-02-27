import type { PropsWithChildren } from 'react';

interface CardProps {
    title: string;
}

export const Card = ({ title, children }: PropsWithChildren<CardProps>) => {
    return (
        <article className='mh-card mh-grid-pattern p-5 sm:p-6'>
            <h2 className='font-heading text-2xl font-black uppercase tracking-tight text-mh-text'>
                {title}
            </h2>
            <div className='mt-3 text-sm text-mh-textMuted'>
                {children}
            </div>
        </article>
    );
};
