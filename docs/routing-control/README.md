# Routing Control extension — development branch

This branch adds a Vue routing screen and an admin-session-only Flask bridge.
It is **not a deployable routing controller release**. Network execution, independent
rollback, gateway import, notification bindings and operation tracking require the
companion controller implementation and Linux acceptance testing.

The screen is at `#/routing` below the configured dashboard prefix. Draft gateway,
priority and route edits use optimistic concurrency. Bridge requests use a protected
Unix socket at `/run/routing-control/api.sock`; never expose the companion API over
TCP. Dashboard API keys do not authorize this bridge. Mutations require CSRF.

Telegram delivery remains owned by Zabbix. The existing-channel form is connected to durable check/test/disable jobs in the
companion API. New bot/recipient provisioning and saving a candidate binding remain
unavailable. The API requires explicitly configured server-side Zabbix credentials.

## Development checks

- Python with Flask: `python -m unittest discover -s tests/routing -p test_bridge.py`
- In `src/static/app`: `npm ci`, `node --test tests/routing/api.test.js`
- Build: `npm run build -- --outDir /tmp/routing-ui-build`
- Browser fixture: start Vite on loopback port 5178, then run
  `node tests/routing/browser.cjs`. Install Chromium with `npx playwright install chromium`
  or set `CHROMIUM_EXECUTABLE`. This test uses fake API responses and is not network acceptance.

Before deployment, managed-interface guards must cover existing dashboard mutation
routes, and existing parser customizations must be ported with regression tests.
