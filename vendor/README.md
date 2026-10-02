# vendor/

Pinned third-party code (PRD §10.7, D-39). Nothing here is loaded from a CDN at runtime.

| File | What | License |
|---|---|---|
| `supabase-js-2.117.2.esm.js` | `@supabase/supabase-js` **2.117.2**, bundled with esbuild into one minified ES module that exports `createClient` | MIT |

## Rebuilding / upgrading

Do this deliberately, never as a side effect. In a scratch directory (not the repo):

```
npm install @supabase/supabase-js@<exact version> esbuild
```

then bundle:

```js
import { build } from 'esbuild';
await build({
  stdin: { contents: "export { createClient } from '@supabase/supabase-js';", resolveDir: process.cwd() },
  bundle: true, format: 'esm', platform: 'browser', target: 'es2020', minify: true,
  outfile: '<repo>/vendor/supabase-js-<version>.esm.js',
  banner: { js: '/* @supabase/supabase-js <version> (MIT), bundled with esbuild as a single ES module. Do not edit; see vendor/README.md */' },
  legalComments: 'none',
});
```

Update the import in `js/api.js`, delete the old file, and re-run the staging regression.
