# EdVerse block: OpenWorld v2 Multiverse (prototype)

Mirror of the EdVerse draft game **`6adf1ed4b82eb1abf688083e`**. The block's workspace on MEXTY is the
source of truth; it holds:

- `src/block.tsx` — this folder's `block.tsx`: the React `Block` that mounts the engine and connects it
  to EdVerse (props, language, pause, `mexty.ready()`, `mexty.progress.level/complete`).
- `src/mv/*.js` — the engine, copied from `../src/` (every file except `main.js`).
- `package.json` (three pinned to 0.186.1, `@mexty/sdk`) and `tsconfig.json` (ES2020 target: the scaffold's
  ES5 target would break the engine's `for…of` loops over Maps and Sets).

To update the block: change the engine in `../src/`, test it with `npm run dev`, then write the changed
files to the block (EdVerse MCP `write_game_files`, paths `src/mv/<file>.js`) and rebuild.

Props: `heightfieldUrl` and `propsModelUrl` (library URLs of `heightfield.i16.bin` and `props.glb`),
`startUniverse`, `quality`, and every word as `{ en, fr }` under `universes` and `ui` (defaults in
`../src/text.js`).
