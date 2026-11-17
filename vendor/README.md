# Local dependency security replacements

These private workspace packages replace affected transitive dependencies through
scoped npm overrides. Their `-kondora.1` versions identify local forks, not upstream
releases. They are functional security changes, not advisory exclusions.
The app, CLI and program tests share the root workspace lockfile so separate
installs cannot silently restore affected transitive versions.

- `picomatch` contains the MIT-licensed upstream **4.0.7** runtime, with its
  original license preserved. The only runtime change is in
  `lib/parse.js:analyzeRepeatedExtglob`: repeated extglobs containing an
  unescaped wildcard or another unbounded repeat take the existing upstream
  literalization path, including single-branch bodies and callers disabling
  the optional recursion guard. This addresses
  [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf).
- `bigint-buffer` is a JavaScript implementation of the four conversion
  functions used by `@solana/buffer-layout-utils`. It has no native addon or
  unsafe allocation; invalid widths, negative values and overflow are rejected.
  This removes the native buffer overflow in
  [GHSA-3gc7-fjrx-p6mg](https://github.com/advisories/GHSA-3gc7-fjrx-p6mg).
- `stream-json-compat` adapts the two legacy Node stream entry points used by
  Jayson to **stream-json 3.9.0**, installed as `stream-json-safe`. The actual
  parser and assembler are upstream's patched implementation. Depth and packed
  token limits are applied by the adapters. This avoids the vulnerable 1.x
  implementation without changing Jayson's public API.

The application requires Node.js 22.12 or newer for synchronous ESM loading.
`scripts/security.test.mjs` exercises the replacements, including malicious
glob patterns, conversion boundaries and JSON prototype/depth handling. Remove
these overrides when compatible upstream fixes are available, then rerun the
security tests, Convex deployment validation and production build.
