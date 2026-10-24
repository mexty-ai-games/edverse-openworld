# EdVerse OpenWorld

A safe, shared world for kids aged 4 to 18, built from the community's ideas. Part of
[EdVerse](https://future.mexty.ai/edverse), MEXTY's learning-game store.

- **[RULES.md](RULES.md)** — the ground rules. Read first.
- **[ART.md](ART.md)** — the art direction and the four districts.
- **[docs/ROUTINE.md](docs/ROUTINE.md)** — how approved ideas are built (draft).
- **[game/](game/)** — the world game's source (an EdVerse game / MEXTY block).

## How it works

```
Idea (EdVerse → OpenWorld page) → filter → MEXTY staff (EdVerse admin → Ideas)
   → build routine (this repo + the game) → person reviews → shipped: lantern + email to the family
```

The ideas API lives in `mext-ai/backend` (`/api/edverse/ideas`, `/api/edverse/admin/ideas`), the
pages in `mext-ai/website` (`/edverse/openworld`, `/edverse/admin/ideas`). EdVerse is on `dev` and
`future` only for now.
