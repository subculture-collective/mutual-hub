import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
    'apps/web/vite.config.ts',
    'apps/mobile',
    'services/*',
    'packages/*',
]);
