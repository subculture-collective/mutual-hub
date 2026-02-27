import { Badge } from './components/Badge';
import { Button } from './components/Button';
import { Card } from './components/Card';
import { Input } from './components/Input';
import { Panel } from './components/Panel';
import { CoreFlowSurfaces } from './components/surfaces';
import { TextLink } from './components/TextLink';

export const APP_TITLE = 'Patchwork';

const discoveryShellPanel = (
    <Panel title='Discovery shell'>
        <p className='mb-3 text-sm text-mh-textMuted'>
            Vite + React + TypeScript + Tailwind are wired and ready for Phase
            7 moderation, anti-spam, and privacy hardening.
        </p>
        <label
            htmlFor='search-requests'
            className='mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-mh-text'
        >
            Search requests
        </label>
        <Input
            id='search-requests'
            placeholder='e.g. food, shelter, transport'
        />
        <div className='mt-4 flex flex-wrap gap-2'>
            <Button>Find nearby</Button>
            <Button variant='secondary'>Create post</Button>
        </div>
    </Panel>
);

const serviceBoundariesCard = (
    <Card title='Service boundaries online'>
        <ul className='list-disc space-y-1 pl-5 text-sm'>
            <li>
                API shell at <code>localhost:4000</code>
            </li>
            <li>
                Indexer shell at <code>localhost:4100</code>
            </li>
            <li>
                Moderation worker shell at{' '}
                <code>localhost:4200</code>
            </li>
        </ul>
        <p className='mt-3'>
            See <TextLink href='/'>architecture docs</TextLink> for bounded
            contexts and ADR rationale.
        </p>
    </Card>
);

export const App = () => {
    return (
        <main className='mh-grain min-h-screen bg-mh-bg text-mh-text'>
            <div className='mh-grid-pattern mx-auto min-h-screen max-w-6xl border-x-2 border-mh-border px-4 py-8 sm:px-6 lg:px-8'>
                <header className='mb-8 border-b-2 border-mh-border pb-6 sm:pb-8'>
                    <p className='mb-3 text-xs font-bold uppercase tracking-[0.14em] text-mh-textMuted'>
                        Mutual aid shell · phase 7
                    </p>
                    <div className='flex flex-wrap items-end justify-between gap-4'>
                        <h1 className='font-heading text-5xl font-black uppercase leading-none tracking-tight sm:text-6xl md:text-7xl'>
                            {APP_TITLE}
                        </h1>
                        <Badge tone='danger'>Phase 7 baseline</Badge>
                    </div>
                </header>

                <div className='grid gap-6 md:grid-cols-5'>
                    <section className='md:col-span-3'>{discoveryShellPanel}</section>
                    <section className='md:col-span-2'>{serviceBoundariesCard}</section>
                </div>

                <CoreFlowSurfaces />
            </div>
        </main>
    );
};
