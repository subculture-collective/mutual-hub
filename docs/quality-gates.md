# Quality gates (Phase 1)

The repository quality baseline is enforced through workspace scripts and CI.

## Local commands

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

## CI behavior

Workflow: `.github/workflows/ci.yml`

Runs on pull requests and pushes to `main`:

1. Install dependencies (`npm ci`)
2. Lint
3. Typecheck
4. Unit tests
5. Build

If any step fails, the workflow fails and merge should be blocked via branch protection using this workflow check as required.
