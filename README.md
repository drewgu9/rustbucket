# Rustbucket

A small original ASCII incremental RPG for the browser. You're a salvage robot that wakes up in a scrapyard with one bolt arriving per second, and you slowly repair your own interface until you can leave.

It was built to show how [Candy Box 2](https://github.com/candybox2/candybox2.github.io) (by aniwey) works, using the same kinds of systems in about 1,200 lines. All code, art, text and levels here are new. See **[docs/how-candy-box-2-works.md](docs/how-candy-box-2-works.md)** for the breakdown, which maps each Candy Box 2 system to the matching Rustbucket file.

## Play

No build step or dependencies. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8123
```

Then go to http://localhost:8123.

**Keys:** `b` bolt on, `f` feed the magpie, `space` jump, `1` repair kit, `2` EMP, `enter` leave a finished quest.

Your robot walks by itself on quests. Your job is when to jump, and what to bring.

## Code

| File | What it does |
|---|---|
| `src/save.js` | Flat registry of every saved value, plus `localStorage` and text export |
| `src/resource.js` | Spendable numbers that remember their max |
| `src/grid.js` | The character grid everything is drawn into |
| `src/items.js` | Items and the hook chain combat numbers pass through |
| `src/quest.js` | The real-time entity engine |
| `src/quests.js` | Level data |
| `src/places.js` | One draw function per screen, plus the economy curves |
| `src/game.js` | The two clocks, navigation and spending |
| `src/main.js` | Browser layer: timers, input, DOM |

## Tests

```bash
node --test test/game.test.js
```

The game logic doesn't touch the DOM, so the tests load it in a VM and have a simple bot play the actual quests.
