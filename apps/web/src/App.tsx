import { Badge } from './components/Badge';
import { Button } from './components/Button';
import { Card } from './components/Card';
import { Input } from './components/Input';
import { Panel } from './components/Panel';
import { TextLink } from './components/TextLink';

export const APP_TITLE = 'Patchwork';

const discoveryShellPanel = (
    <Panel title='Discovery shell'>
        <p className='mb-3 text-sm text-[var(--mh-text-muted)]'>
            Vite + React + TypeScript + Tailwind are wired and ready for Phase 7
            moderation, anti-spam, and privacy hardening.
        </p>
        <label
            htmlFor='search-requests'
            className='mb-2 block text-xs font-bold uppercase tracking-wide'
        >
            Search requests
        </label>
        <Input
            id='search-requests'
            placeholder='e.g. food, shelter, transport'
        />
        <div className='mt-3 flex gap-2'>
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
                Moderation worker shell at <code>localhost:4200</code>
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
        <main className='mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 lg:px-8'>
            <header className='mb-8 flex flex-wrap items-center gap-3'>
                <h1 className='font-heading text-4xl font-black uppercase'>
                    {APP_TITLE}
                </h1>
                <Badge tone='danger'>Phase 7 baseline</Badge>
            </header>

            <div className='grid gap-6 md:grid-cols-2'>
                {discoveryShellPanel}
                {serviceBoundariesCard}
            </div>
        </main>
    );
};
