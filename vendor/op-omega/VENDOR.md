# Vendored op-omega source

These directories are byte-for-byte copies of the corresponding paths in the
operator-omega monorepo. They are vendored (not depended on via npm) so that:

1. Source-of-truth fidelity is preserved — every file matches upstream.
2. Wavex-os has no external runtime dependency on the op-omega registry.
3. Adapter packages in `packages/op-omega-*/` and `packages/*-shim/` can wrap
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
| `vendor/op-omega/plugin-sdk/`         | `packages/plugins/sdk/` |
| `vendor/op-omega/shared/`             | `packages/shared/` |
| `vendor/op-omega/tier-router/`        | `packages/plugins/tier-router/` |
| `vendor/op-omega/flywheel-kernel/`    | `packages/plugins/flywheel-kernel/` |
| `vendor/op-omega/onboarding/`         | `packages/plugins/onboarding/` |
| `vendor/op-omega/op-omega-flow-types/`| `packages/plugins/op-omega-flow-types/` |

## Updating from upstream

```bash
SRC=/Users/dylanriedweg/operator-omega
DEST=/Users/dylanriedweg/wavex-os/vendor/op-omega

for dir in plugin-sdk:plugins/sdk shared:shared tier-router:plugins/tier-router \
           flywheel-kernel:plugins/flywheel-kernel onboarding:plugins/onboarding \
           op-omega-flow-types:plugins/op-omega-flow-types; do
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
adapter packages (`packages/op-omega-*/`, `packages/*-shim/`).

## Documented exceptions

A small set of vendored files have local edits to make them work in the
wavex-os workspace layout. Vendor-update scripts must re-apply these:

| File | Edit | Reason |
|---|---|---|
| `*/tsconfig.json` (all 6 packages) | `extends` swapped from `../../../tsconfig.json` or `../../tsconfig.base.json` to `../tsconfig.base.json` | Upstream tsconfig sits at monorepo root in operator-omega; in vendor/op-omega/ we provide a sibling base |
| `tsconfig.base.json` | New file (mirrors upstream `tsconfig.base.json`) | Sibling base for the package tsconfigs |
| `shared/tsconfig.json` | Adds `types: ["node"]` + `exclude: ["src/**/*.test.ts"]` | Build was emitting test files; @types/node was missing from devDeps |
| `shared/package.json` | Adds `@types/node` to devDependencies | Fix for the same |

These edits are ergonomic-only. They don't change behavior. The next vendor
sync should diff these against upstream and re-apply.

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
`onboarding`, `op-omega-flow-types`) export from `src/*.ts` directly and
need no build step at runtime — wavex-os runs them via tsx / Vite.
