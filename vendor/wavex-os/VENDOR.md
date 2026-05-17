# Vendored wavex-os source

These directories are byte-for-byte copies of the corresponding paths in the
operator-omega monorepo. They are vendored (not depended on via npm) so that:

1. Source-of-truth fidelity is preserved — every file matches upstream.
2. Wavex-os has no external runtime dependency on the wavex-os registry.
3. Adapter packages in `packages/wavex-os-*/` and `packages/*-shim/` can wrap
   these vendored bytes with wavex-specific behavior (DB, auth, inference,
   composio gating) without modifying vendored source.

## Source

- **Upstream repo:** `/Users/dylanriedweg/operator-omega`
  (mirror: `https://github.com/dylanriedw10-oss/operatoromega`)
- **Source commit:** `d84983a1154c5cecf0641581295dd6782b114941`
- **Source date:** 2026-05-03
- **Source subject:** `harden(onboarding): five hardening fixes — vault Telegram secrets, Composio session recovery, manifest cache, terminal-phase button, multi-tab race`

## Mapping

| Vendored path | Upstream path |
|---|---|
| `vendor/wavex-os/plugin-sdk/`         | `packages/plugins/sdk/` |
| `vendor/wavex-os/shared/`             | `packages/shared/` |
| `vendor/wavex-os/tier-router/`        | `packages/plugins/tier-router/` |
| `vendor/wavex-os/flywheel-kernel/`    | `packages/plugins/flywheel-kernel/` |
| `vendor/wavex-os/onboarding/`         | `packages/plugins/onboarding/` |
| `vendor/wavex-os/wavex-os-flow-types/`| `packages/plugins/wavex-os-flow-types/` |

## Updating from upstream

```bash
SRC=/Users/dylanriedweg/operator-omega
DEST=/Users/dylanriedweg/wavex-os/vendor/wavex-os

for dir in plugin-sdk:plugins/sdk shared:shared tier-router:plugins/tier-router \
           flywheel-kernel:plugins/flywheel-kernel onboarding:plugins/onboarding \
           wavex-os-flow-types:plugins/wavex-os-flow-types; do
  pkg="${dir%%:*}"; src_path="${dir#*:}"
  rm -rf "$DEST/$pkg"
  cp -r "$SRC/packages/$src_path" "$DEST/$pkg"
done

# Strip build artifacts that shouldn't be vendored
find "$DEST" -type d \( -name node_modules -o -name dist \) -prune -exec rm -rf {} +

# Update this file's "Source commit" / "Source date" / "Source subject"
( cd "$SRC" && git log -1 --format='%H%n%cd%n%s' --date=short )
```

After updating, run `pnpm install && pnpm test` and resolve any drift in the
adapter packages (`packages/wavex-os-*/`, `packages/*-shim/`).

## Documented exceptions

A small set of vendored files have local edits to make them work in the
wavex-os workspace layout. Vendor-update scripts must re-apply these:

| File | Edit | Reason |
|---|---|---|
| `*/tsconfig.json` (all 6 packages) | `extends` swapped from `../../../tsconfig.json` or `../../tsconfig.base.json` to `../tsconfig.base.json` | Upstream tsconfig sits at monorepo root in operator-omega; in vendor/wavex-os/ we provide a sibling base |
| `tsconfig.base.json` | New file (mirrors upstream `tsconfig.base.json`) | Sibling base for the package tsconfigs |
| `shared/tsconfig.json` | Adds `types: ["node"]` + `exclude: ["src/**/*.test.ts"]` | Build was emitting test files; @types/node was missing from devDeps |
| `shared/package.json` | Adds `@types/node` to devDependencies | Fix for the same |
| `onboarding/src/phases/finalize/imprint-review.ts` | Bumps `timeout_ms: 120_000 → 300_000` on the deep+creative imprint T2 call | Upstream's 2 min timeout was triggering the deterministic fallback too often; the imprint pass routinely needs 2-4 min in real runs. Same value, different deadline — pure behavior fix, no contract change |

The first four edits are ergonomic-only. The fifth (imprint-review timeout) does
change behavior — bumping the timeout means slow T2 calls now succeed where they
previously fell back. The next vendor sync should diff all of these against
upstream and re-apply, and audit whether upstream has bumped the timeout itself.

## Do not modify (other than the above)

Files under this directory should not be edited locally beyond the
documented exceptions. If you need to change behavior, do it in an adapter
package that imports from here. Other local edits will be silently
overwritten on the next vendor update.

## Build step

`@paperclipai/plugin-sdk` is published as a built npm package — its
`exports` map points to `./dist/`. To make it usable in the workspace, build
it once after vendor sync:

```bash
pnpm --filter @paperclipai/plugin-sdk build
```

The other vendored packages (`shared`, `tier-router`, `flywheel-kernel`,
`onboarding`, `wavex-os-flow-types`) export from `src/*.ts` directly and
need no build step at runtime — wavex-os runs them via tsx / Vite.
