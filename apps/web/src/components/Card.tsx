import type { PropsWithChildren } from 'react';

interface CardProps {
    title: string;
}

export const Card = ({ title, children }: PropsWithChildren<CardProps>) => {
    return (
        <article className='mh-card p-5 sm:p-6'>
            <h2 className='font-heading text-xl font-semibold tracking-tight text-mh-text sm:text-2xl'>
                {title}
            </h2>
            <div className='mt-3 text-sm text-mh-textMuted'>{children}</div>
        </article>
    );
};
