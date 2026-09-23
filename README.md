# Cooking Tycoon 3D

A mobile-first 3D cooking tycoon game that runs in the browser (Three.js + Vite). Tap stations to cook, plate, and serve orders; spend profits on upgrades between days.

## Play locally

```bash
npm install
npm run dev      # open the printed URL (works on your phone over LAN too)
npm run build    # production build in dist/
```

## Deploy to Vercel

Import the repo in Vercel — it's detected as a Vite project (`vercel.json` pins build command `npm run build` and output `dist`). No env vars or server needed.

## What's in the MVP slice

| Plan item | In game |
|---|---|
| Day loop | Open → orders arrive → prep/cook/plate/serve → shift timer ends → results + upgrade shop → harder next day |
| Stations | Ingredient crates, prep board (chop), stove (2 burners, cook timer + burn window), plating (2 plates), serve pass, trash (−$2) |
| Recipes | Toast (day 1), Garden Salad (day 1), Tomato Soup (day 2), Burger (day 4). Each has ingredient steps, cook times, price and tip multiplier |
| Customers | Casual, Rushed (short patience, big tips, day 3), Critic (picky, big rating swing, day 5) |
| Upgrades | Turbo Burners, More Seating, Tip Jar, Extra Cutting Board, Auto-Plater, Prep Helper (staff AI assist) |
| Progression | Cash + ★ rating (affects tips), 0–3 stars per day, daily bonus goal ("serve 3 salads"), 10 career days, then endless free play |
| Screens | Start (New / Continue), in-run HUD (money, rating, timer, order tickets), between-day shop + next-day preview, pause + recipe book |

Progress saves automatically to `localStorage`.

## Code map

- `src/data.js` — all content & tuning (items, recipes, customers, upgrades, day pacing)
- `src/game.js` — game rules/state, no rendering
- `src/scene.js` — Three.js kitchen, characters, food meshes
- `src/main.js` — input, HUD, screens, main loop
- `src/audio.js` — tiny WebAudio sound effects

## Next ideas (from the content plan)

Oven/fryer station, groups & dietary tags, challenge days, events (health inspection, influencer night), patio/food-truck expansion.
