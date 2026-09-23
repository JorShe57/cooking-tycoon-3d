# Cooking Tycoon 3D

A mobile-first 3D cooking tycoon game that runs in the browser (Three.js + Vite). Cook orders during short shifts, then run the business between days: plan the menu, set prices, buy stock, hire staff, rearrange the kitchen and expand.

## Play locally

```bash
npm install
npm run dev      # open the printed URL (works on your phone over LAN too)
npm run build    # production build in dist/
```

## Deploy to Vercel

Import the repo in Vercel — it's detected as a Vite project (`vercel.json` pins build command `npm run build` and output `dist`). No env vars or server needed.

## Game systems

**The shift**
- Tap stations to send the chef there; taps queue up (numbered badges), and the chef walks around counters, so kitchen layout matters.
- Stations: ingredient crates, cutting boards 🔪, burners 🔥, deep fryers 🛢️, plate counters 🍽️, sink 🧽, trash, and the serve pass.
- Food burns if left too long. From day 3 plates come back dirty and must be scrubbed at the sink.
- 7 recipes: Toast, Garden Salad, Tomato Soup, Burger, Fries, Fish & Chips, Veggie Club. Spicy 🌶️ orders (add chopped chili) from day 8.
- Customers: Casual, Rushed, Critic, Groups (2–3 dishes), Veggie 🌱, plus event-only Influencers and Health Inspectors.

**Between days (planner tabs)**
- **Report** — full profit & loss: sales, tips, bonuses, ingredients, rush deliveries, marketing, rent, wages, fines, spoilage.
- **Plan** — pick one of three day events (Rush Hour, Health Inspection, Influencer Night, Power Flicker, Supply Shortage, Holiday Crowd, Critics' Convention), buy flyers, see the forecast, switch location, track rank and the weekly challenge.
- **Menu** — choose dishes (limited slots) and set Bargain / Fair / Premium prices; learn new recipes.
- **Stock** — buy ingredients ahead of time; running out mid-shift means 3× rush deliveries; perishables spoil overnight.
- **Shop** — buy stations, upgrades (Turbo Heat, Comfy Shoes, Tip Jar, More Seating, Bigger Menu Board, Walk-in Fridge, Auto-Plater, Patio) and the Food Truck.
- **Staff** — hire a Dishwasher, Prep Cook and Runner (hire fee + daily wages).
- **Goals** — restaurant ranks, 15 milestones with cash rewards.
- **🛠 Kitchen** — grid editor to move, store and place stations.

20 career days, then endless free play. Progress saves to `localStorage`.

## Code map

- `src/data.js` — all content & tuning (items, recipes, customers, stations, venues, staff, upgrades, events, milestones)
- `src/layout.js` — kitchen grid: validation, auto-placement, chef pathfinding
- `src/game.js` — save data, between-day economy actions, the shift simulation
- `src/scene.js` — Three.js world built from the venue + layout
- `src/planner.js` — between-day planner UI
- `src/build.js` — kitchen editor
- `src/main.js` — modes, input, HUD, labels, main loop
- `src/audio.js` — tiny WebAudio sound effects
