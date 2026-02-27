import type { PropsWithChildren } from 'react';

interface CardProps {
    title: string;
}

export const Card = ({ title, children }: PropsWithChildren<CardProps>) => {
    return (
        <article className='mh-card p-4'>
            <h2 className='font-heading text-xl font-black uppercase'>
                {title}
            </h2>
            <div className='mt-3 text-sm text-(--mh-text-muted)'>
                {children}
            </div>
        </article>
    );
};
