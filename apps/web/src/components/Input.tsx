import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    errorMessage?: string;
}

export const Input = ({
    className = '',
    errorMessage,
    id,
    ...props
}: InputProps) => {
    const errorId = errorMessage && id ? `${id}-error` : undefined;
    const describedBy = [props['aria-describedby'], errorId]
        .filter((value): value is string => Boolean(value))
        .join(' ');

    return (
        <div className='space-y-1'>
            <input
                id={id}
                aria-invalid={errorMessage ? true : props['aria-invalid']}
                aria-describedby={
                    describedBy.length > 0 ? describedBy : undefined
                }
                className={[
                    'mh-input w-full px-3 py-2 text-sm',
                    className,
                ].join(' ')}
                {...props}
            />
            {errorMessage ?
                <p
                    id={errorId}
                    role='alert'
                    className='mh-alert text-xs font-bold'
                >
                    {errorMessage}
                </p>
            :   null}
        </div>
    );
};
