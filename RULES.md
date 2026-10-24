# EdVerse OpenWorld — Ground rules (v0.1, 24 Oct 2026)

EdVerse OpenWorld is one shared world for kids aged 4 to 18. Players learn by doing, and the
community decides what gets built: anyone can suggest an idea, MEXTY staff vet it, a routine
builds it, and the person who suggested it is told when it is live.

These rules come first. Every idea, every staff decision, every routine and every line of code in
this repository is checked against them. They build on the 11 EdVerse Game Requirements (EV-LOAD …
EV-RIGHTS); where the two overlap, the stricter one applies.

## The ten rules

1. **No free-text chat between players.** Players talk with emotes, stickers and a phrase wheel.
   Phrase sets grow with age (icons with voice for 4–6, more phrases for older players), but nobody
   can type a message to another player.
2. **No identity.** Every player has a generated nickname ("Brave Otter 42") and an avatar built
   from preset parts. No real names, photos, schools, locations or contact details — ever. Idea
   authors are credited by nickname only.
3. **Age-aware instances.** Everyone shares the same map. Open rooms only mix players at most one
   EdVerse age tile apart (4–6 · 7–9 · 10–12 · 13–15 · 16–18). Family and class rooms, which a
   grown-up or teacher sets up, may mix every age.
4. **The grown-up's rules win.** Daily limits, quiet hours and mute set on the kid's profile pause
   the world (`mexty.paused`, `mexty.muted`). Nothing pushes a child to stay.
5. **No money, no pressure.** No real-money items, loot boxes, punishing streaks or countdowns.
   Rewards are cosmetic and earned by learning.
6. **Gentle play.** No combat between players and nothing scary, violent, sexual, hateful or
   mocking. Mistakes get a kind response. Competition only through leaderboards and co-op goals.
7. **Everything teaches.** Every place, activity, object or character has a stated learning goal,
   an EdVerse subject and the age tiles it is for, and its learning is tracked (BLOCK_* events /
   `mexty.progress`). An idea with no learning goal is declined kindly.
8. **Nothing ships unreviewed.** Ideas go through the automatic filter (personal info removed,
   unsafe words flagged), then a MEXTY staff member, then the review of what the routine built, and
   only then into the world.
9. **One-tap report.** Any player, object or idea can be reported in one tap. Reports go to the
   staff queue, and a reported object is hidden until a person has looked at it.
10. **Works for everyone.** Playable without reading for ages 4–6 (icons, voice), colour-blind safe,
    phone / tablet / desktop, touch or keyboard, landscape or portrait. Every text in EN and FR at
    launch.

## How an idea becomes part of the world

| Status | Who | What happens |
|---|---|---|
| `submitted` | a kid or grown-up, in EdVerse → OpenWorld | Text is filtered (emails, phones, links, @handles removed; unsafe words flagged). Max 5 ideas per account per day. |
| `approved` / `declined` | MEXTY staff, EdVerse admin → Ideas | Checked against these rules. A decline always carries a kind message to the family. |
| `building` | the OpenWorld build routine (org account) | Builds the idea in this repo and the game, opens a PR, records the PR on the idea. |
| `shipped` | staff, after reviewing the build | The idea becomes a lantern on the Idea Tree; the account that suggested it gets an email. |

## What staff check before approving

- Fits the world and one district (Idea Grove, Biome Frontier, Chrono Quarter, Skyharbor) or is a
  world-wide rule.
- Has a real learning goal that matches its subject and ages; the facts it needs can be checked.
- Safe for every age it is listed for (rule 6), and buildable without breaking rules 1–5.
- Contains no personal information (even after the filter) and no third-party brand or character
  we do not have the rights to (EV-RIGHTS).

## What routines may never do

- Add free-text input between players, links out of the game, ads, purchases or sign-ups.
- Store or show anything that identifies a child.
- Ship to players without a person's review.
- Change these rules. Rules change only by a reviewed PR to this file, approved by MEXTY staff.
