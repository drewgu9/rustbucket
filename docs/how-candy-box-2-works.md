# How Candy Box 2 works

A breakdown of [Candy Box 2](https://github.com/candybox2/candybox2.github.io) (by aniwey, GPLv3), written from reading its TypeScript source, with each system shown again in miniature in Rustbucket.

Paths like `Game.ts` are in `code/main/` of the Candy Box 2 repo. Rustbucket reimplements the ideas in its own code and shares none of Candy Box 2's code, art, text or levels.

**Scale:** about 25,000 lines of TypeScript across 285 files in `code/main`, plus jQuery, compiled with `tsc` into one JS file. There is no game framework or canvas. The whole game is text in `<pre>` tags.

## The big idea

Three design choices explain most of the codebase:

1. **The screen is a character grid.** Everything, including "UI", is ASCII drawn into a 2D array of characters.
2. **Almost all state is a flat dictionary of named values.** Progression is mostly booleans that screens check when they draw.
3. **Two independent clocks.** The economy ticks once a second and quests tick ten times a second, so the idle game never stops.

## 1. Rendering: a character grid with tags

`RenderArea.ts` holds an array of strings plus, per row, a sorted list of *tags*: raw HTML snippets anchored to an x position. To draw, it splices the tags into the strings and writes the result to a `<pre>`.

- A button is just a tag: `addAsciiRealButton()` wraps text in `<span class="asciiRealButton">`.
- Map locations are clickable art. `addMultipleAsciiButtons()` wraps a row range in a span for each row of a house or tree, so an irregular shape acts as one button.
- Click handlers are stored as `RenderLink` objects and attached with jQuery after each write.

| | Candy Box 2 | Rustbucket |
|---|---|---|
| Grid | `RenderArea.ts`: strings + tag lists | `src/grid.js`: chars + per-cell class and handler |
| Output | HTML in two `<pre>`s (status bar, main) | The same two `<pre>`s |

Rustbucket stores a class per cell rather than tag lists, which avoids overlapping-tag problems when sprites cross. It also skips the DOM write if the HTML is unchanged.

## 2. State and saving: a registry

`Saving.ts` is three maps: bools, numbers and strings. Files register their keys at load time, at the top of the file:

```ts
Saving.registerBool("candyBoxBoxOpened", false);
```

Because every persistent value lives in those maps, saving needs no per-feature code:

- **Local slots** (`LocalSaving.ts`) write each key to `localStorage` as `slotN.key`.
- **File export** is plain text lines such as `bool name=value`, parsed back with regexes.
- **Autosave** counts down inside the one-second tick, every 600 seconds by default (`Game.ts`).

A side effect is that the save format doubles as a cheat and debug tool. `Saving.ts` has a commented-out block that sets every flag to test late-game content.

Rustbucket's version is `src/save.js`. It adds type checks on load, so a hand-edited save can't introduce a value of the wrong type.

## 3. Resources

`Resource.ts` tracks `current`, `accumulated` and `max`, and has a list of callbacks that fire on change. Two details matter:

- **Unlocks check `max`, not `current`.** `CandyBox.checkCandies()` shows the eat button at `max > 0`, throw at `max >= 10` and request-a-feature at `max >= 30`. Spending can't hide a button you've earned.
- **Spending is usually `transferTo()` another resource.** "Candies eaten", "candies thrown" and "candies in the cauldron" are all resources, so every sink is automatically tracked and saved.

Rustbucket: `src/resource.js`. Bolts bolted on and bolts fed to the magpie are resources in the same way.

## 4. The two clocks

From `Game.ts`:

```ts
this.oneSecondIntervalId = window.setInterval(this.oneSecondMethod.bind(this), 1000);
window.setTimeout(this.questMethod.bind(this), 100);
```

- `oneSecondMethod()` handles HP regen, candy production, lollipop production, pond conversion, autosave, and then callbacks registered by the current screen.
- `questMethod()` only fires callbacks. It re-arms itself with `setTimeout`, so the optional slow-motion mode just uses a 200ms delay instead.

Screens subscribe to these through `CallbackCollection`, and the subscriptions are cleared on every screen change.

Rustbucket: `secondTick()` and `questTick()` in `src/game.js`.

## 5. Screens are `Place`s

`Place.ts` is the base class for every location, and quests extend it too. A place owns a `RenderArea` and has lifecycle hooks (`willBeDisplayed`, `willBeClosed`). `Game.setPlace()` tears down the old place's callbacks and hotkeys, then shows the new one. `StatusBar.ts` draws the resource counters and tabs above it.

Rustbucket: the `Places` object in `src/places.js`. Each place is simply a `draw()` function, and the whole screen is redrawn on each change.

## 6. Progression is flags checked at draw time

There is no quest tree or unlock graph. `MainMap.load()` is a list of conditions:

```ts
if(Saving.loadBool("mainMapDoneDesert")){
    this.loadFarm(115, 57);
    this.loadBridge(99, 61);
    ...
}
if(Saving.loadBool("mainMapDoneBridge")) this.loadSorceressHut(95, 68);
```

Winning a quest sets a flag (`Bridge.endQuest` sets `mainMapDoneBridge`), and the map shows more the next time it is drawn.

The same approach gives the game its famous opening. `CandyBox.update()` is an `if/else if` ladder over `statusBarUnlocked`, `...Cfg`, `...Save`, `...HealthBar` and `...Map`, so you buy the game's interface one piece at a time: 30, 5, 5, 5, then 10 candies. Each purchase also changes the comment text beside the next button.

Rustbucket: the `REPAIRS` list (display, memory, sensors, navigation) and `Places.map` in `src/places.js`.

## 7. The economy's curves

**Max HP** (`Player.reCalcMaxHp`) grows with candies eaten, on two saturating curves:

```
100 + ceil((1 - e^(-eaten/3000)) * 100) + ceil((1 - e^(-eaten/400000)) * 800)
```

The first curve rewards early eating and the second keeps a long tail, so each candy is worth less than the last but none are worthless. Items then add to or multiply the total.

**Lollipop farm** (`Game.calcLollipopFarmProduction`) has two regimes:

- **1 to 20 planted:** a hand-written table of seconds per lollipop, from 8 hours at 1 down to 2 seconds at 20.
- **More than 20:** lollipops per second, `ceil(100 * (1 - e^(-(planted-20)/5000)))`, times multipliers from three items (×3, ×3, ×5).

The table lets the designer tune the early game by hand, and the curve keeps the late game from running away.

**HP regen** (`Player.magicHealthRegain`) gives at least 1 HP per second, but only outside quests. HP carries between quests, and you can't start one at 0 HP (`Game.canStartQuest`). Waiting is the cost of losing.

Rustbucket: `maxHp()` and `dynamoPerSecond()` plus `COIL_INTERVALS` in `src/places.js`, with shorter numbers so the game fits into one sitting.

## 8. Quests: a small entity engine

This is the most interesting part of the code. `Quest.ts` holds a list of `QuestEntity` objects, and **everything is an entity**: the player, monsters, fireballs, walls and floors. Each tick:

```
Quest.update()
  check win (usually a position test) and death
  every entity.update():
    animation
    gravity, and movement only if gravity had no effect
    weapons and spell casters
  remove dead entities and those out of the area
  lower the spell countdowns
  redraw
```

**Movement.** `QuestEntityMovement` is an offset applied every N ticks. Two flags give the feel of the game:

- `gravity` makes the entity fall when nothing is beneath it.
- `wormsLike` lets it step up one character and walk down one without falling.

Your character walks by itself: the Bridge quest sets its movement to `new Pos(1, 0)`. Your input is timing, through jumps and spells, not steering. After a jump, `controlledFalling` allows sideways movement while falling, which is what makes pits crossable.

**Collision.** Entities have collision boxes (`CollisionBox.ts`), simple rectangles. `checkCollision()` tests an entity against all the others at a proposed offset. It's O(n²), which is fine at this scale. Even the floor is a `Wall` entity.

**Combat.** A `QuestEntityWeapon` has damage and a delay. `handleCombat()` hits every entity from a different team that overlaps its box. Fists are `damage 1, delay 6`. Weapon boxes are larger than the sprite, which is how melee has reach.

**Spells.** `Quest.ts` has a `castPlayer...()` method for each spell. They share cooldown counters (`playerSpellsCountdown`, `playerPotionsCountdown`). Fireballs and other projectiles are just more entities.

**Loot is held until the end.** Found candies go into a temporary `Resource`, and `Quest.endQuest(win)` only transfers them if you won. Dying costs you the run's loot but nothing else.

| | Candy Box 2 | Rustbucket |
|---|---|---|
| Engine | `Quest.ts`, `QuestEntity.ts` (about 1,700 lines with spells) | `src/quest.js` |
| Level | A class per quest (`Bridge.ts`) | Data in `src/quests.js` |
| Floor | `Wall` entities | A character array of terrain |
| Death by pit | Falling out of the area | Same |

## 9. Items hook into the damage pipeline

Combat code doesn't know about specific items. `Player.hit()` and `Player.inflictDamage()` pass the damage through every equipped `EqItem` and owned `GridItem`:

```ts
for(var savingName in this.game.getSelectedEqItems()){
    damage = this.game.getSelectedEqItems()[savingName].hit(this, this.getQuest(), questEntity, damage, reason);
}
```

`foundCandies()` does the same for loot. Adding an item that changes combat means overriding a method on one class. There are two kinds:

- **`EqItem`:** one per slot (weapon, hat, body armour, gloves, boots).
- **`GridItem`:** always active once owned.

Rustbucket: `Items.chain()` in `src/items.js`, with `onHit`, `onHurt` and `onFind` hooks and the same slotted and always-on split.

## 10. Input

`Keyboard.ts` listens with jQuery and looks up the key in the current place's hotkeys, then in global ones. It tracks held keys and ignores hotkeys while you're typing in a text box. `Enigma` text inputs provide riddles, with the answers checked by `EnigmaAnswer` classes.

Rustbucket: `keydown` in `src/main.js` and the riddle in `Places.tower`.

## 11. Content pipeline

ASCII art and text live outside the code, in `ascii/` and `text/`. Python scripts (`pythonScripts/genAscii.py`, `genText.py`) generate `code/gen/*.ts` full of `Database.addAscii()` calls, so art can be edited as plain text files and is bundled at build time. `Database.ts` serves it at runtime, and translations are lookups by language key. Art files can start with an `@author` line, which the generator strips.

Rustbucket has too little art to justify this, so sprites live inline in the code.

## 12. Things Rustbucket leaves out

These are real parts of Candy Box 2 with no equivalent in Rustbucket. I only skimmed them, so treat this as a map rather than a full analysis:

- **Cauldron** (`Cauldron.ts`): a timed potion-brewing minigame with mixing and boiling actions and a recipe book.
- **Mini-games:** tic-tac-toe with a minimax AI (`ATree*.ts`), plus games inside the third house (`SuperRPG.ts`, `GalacticWars.ts`).
- **Scrolling quests:** `TheHole.ts`, for example, uses a global drawing offset.
- **Wishing well** (`WishingWell.ts`) for permanent gift upgrades, used in `Player.hit` and `reCalcMaxHp`.
- **The Computer** (`TheComputer.ts`), which includes a `Bugs.ts` system that deliberately corrupts rendering and collisions.
- **Arena** (`code/arena/`): extra quests built on the same `Quest` API. `create_quest.html` is a tutorial for writing your own.
- **Game modes** such as hard mode, which disables the eaten-candies HP bonus.

## Lessons worth stealing

- **Reveal the interface slowly.** The UI itself is the first reward.
- **Unlock on `max`, spend from `current`.**
- **Make everything an entity.** Walls, spells and bosses all sharing one class is why one small engine supports so many quests.
- **Route numbers through hooks,** so items are additions rather than edits.
- **Keep state flat and registered.** Saves, cheats and debug setups then come almost free.
- **A table for the early game, a curve for the late game.**
