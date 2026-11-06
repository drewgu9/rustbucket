// Headless tests: the game logic has no DOM dependency, so a simple bot can play the real quests.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const FILES = ["save", "resource", "grid", "items", "quest", "quests", "places", "game"];

function boot() {
  const ctx = vm.createContext({ console });
  for (const f of FILES) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", f + ".js"), "utf8"), ctx);
  }
  return (code) => vm.runInContext(code, ctx);
}

// Jumps when something is coming or the ground is about to end, and uses kits when hurt.
const BOT = `
  function playQuest(id, hp, max) {
    const q = new Quest(QUESTS[id], hp, max);
    for (let i = 0; i < 6000 && !q.ended; i++) {
      const p = q.player;
      const groundAhead = !q.solidAt(p.x + 3, p.y + 1, 2, 1, { solid: false });
      const threat = q.entities.some((e) => !e.isPlayer && e.dx < 0 && e.y >= p.y - 1 && e.x - p.x > 2 && e.x - p.x < 7);
      const wall = q.entities.some((e) => !e.isPlayer && e.solid && e.x - p.x <= 6 && e.x > p.x && e.hp <= 2);
      if (groundAhead || threat || wall) q.jump();
      if (p.hp < p.maxHp * 0.3) q.useKit();
      q.tick();
    }
    return q;
  }
  playQuest;
`;

test("save round-trips and ignores bad data", () => {
  const run = boot();
  run(`Res.bolts.add(42); Items.give("wrench");`);
  const text = run("Save.toText()");
  run("Save.reset()");
  assert.equal(run("Res.bolts.current"), 0);
  run(`Save.fromText(${JSON.stringify(text + "\nnotAKey=1\nboltsCurrent2=x\nhp=\"oops\"")})`);
  assert.equal(run("Res.bolts.current"), 42);
  assert.equal(run(`Items.has("wrench")`), true);
  assert.equal(run(`Save.get("hp")`), 100);
});

test("resources track their max after spending", () => {
  const run = boot();
  run("Res.bolts.add(50); Res.bolts.add(-30);");
  assert.equal(run("Res.bolts.current"), 20);
  assert.equal(run("Res.bolts.max"), 50);
  assert.equal(run("Res.bolts.total"), 50);
  assert.equal(run("Res.bolts.add(-21)"), false);
});

test("the home screen reveals itself as bolts arrive", () => {
  const run = boot();
  run("var game = new Game();");
  const screen = () => run("game.drawMain().toText()");
  assert.ok(!screen().includes("Bolt them all"));
  run("Res.bolts.add(1)");
  assert.ok(screen().includes("Bolt them all"));
  assert.ok(!screen().includes("magpie"));
  run("Res.bolts.add(9)");
  assert.ok(screen().includes("magpie"));
  run("Res.bolts.add(20)");
  assert.ok(screen().includes("Repair your display"));
});

test("repairs unlock in order and the map appears last", () => {
  const run = boot();
  run("var game = new Game(); Res.bolts.add(1000);");
  for (const r of ["unlockDisplay", "unlockMemory", "unlockSensors", "unlockMap"]) {
    assert.equal(run(`Save.get("${r}")`), false);
    run(`game.repair(REPAIRS.find((x) => !Save.get(x.key)))`);
    assert.equal(run(`Save.get("${r}")`), true);
  }
  assert.ok(run("game.tabs().map((t) => t[0]).join()").includes("map"));
});

test("dynamo: table first, then a flattening curve", () => {
  const run = boot();
  assert.equal(run("dynamoPerSecond(3)"), 0);
  const a = run("dynamoPerSecond(8)");
  const b = run("dynamoPerSecond(60)");
  const c = run("dynamoPerSecond(600)");
  assert.ok(a >= 1 && b > a && c > b && c <= 40);
});

test("eating into max HP has diminishing returns", () => {
  const run = boot();
  assert.equal(run("maxHp()"), 100);
  run("Res.bolted.add(800)");
  const first = run("maxHp()");
  run("Res.bolted.add(800)");
  const second = run("maxHp()");
  assert.ok(first - 100 > second - first);
});

test("loot is only paid out on a win", () => {
  const run = boot();
  run(`var q = new Quest(QUESTS.heap, 100, 100); q.found = 50; q.finish(false);`);
  assert.equal(run("Res.bolts.current"), 0);
  run(`q = new Quest(QUESTS.heap, 100, 100); q.found = 50; q.finish(true);`);
  assert.equal(run("Res.bolts.current"), 50);
  assert.equal(run(`Save.get("doneHeap")`), true);
});

test("falling into a pit kills you", () => {
  const run = boot();
  run(`var q = new Quest(QUESTS.culvert, 100, 100); for (let i = 0; i < 400 && !q.ended; i++) q.tick();`);
  assert.equal(run("q.ended"), true);
  assert.equal(run("q.won"), false);
});

test("bot beats the Slag Heap with a wrench", () => {
  const run = boot();
  const play = run(BOT);
  run(`Items.give("wrench");`);
  const q = play("heap", 100, 100);
  assert.equal(q.won, true, q.log.join("\n"));
});

test("bare clamps usually aren't enough for the hulk", () => {
  const run = boot();
  run(`var q = new Quest(QUESTS.heap, 100, 100); for (let i = 0; i < 6000 && !q.ended; i++) q.tick();`);
  assert.equal(run("q.ended"), true);
  assert.equal(run("q.won"), false);
});

test("bot beats the Culvert with mid-game gear", () => {
  const run = boot();
  const play = run(BOT);
  run(`Items.give("wrench"); Items.give("hardhat"); Save.set("kits", 2);`);
  const q = play("culvert", 150, 150);
  assert.equal(q.won, true, q.log.join("\n"));
  assert.equal(run(`Items.has("gyro")`), true);
});

test("the Crusher needs real gear, and can be beaten with it", () => {
  const weak = boot();
  const playWeak = weak(BOT);
  weak(`Items.give("wrench");`);
  assert.equal(playWeak("crusher", 100, 100).won, false);

  const run = boot();
  const play = run(BOT);
  run(`Items.give("cutter"); Items.give("blasthelm"); Items.give("gyro"); Save.set("kits", 3);`);
  const q = play("crusher", 220, 220);
  assert.equal(q.won, true, q.log.join("\n"));
  assert.equal(run(`Save.get("doneCrusher")`), true);
});

test("riddle accepts sensible answers only", () => {
  const run = boot();
  run("var game = new Game();");
  assert.equal(run(`game.answerRiddle("a comb")`), false);
  assert.equal(run(`Items.has("emp")`), false);
  assert.equal(run(`game.answerRiddle("  A Gear ")`), true);
  assert.equal(run(`Items.has("emp")`), true);
});

test("every screen draws without throwing", () => {
  const run = boot();
  run(`var game = new Game(); Res.bolts.add(5000); Save.set("unlockMap", true);
       Save.set("doneHeap", true); Save.set("doneCulvert", true); Save.set("doneCrusher", true);
       for (const id in ITEMS) Items.give(id);`);
  for (const place of ["home", "map", "shop", "dynamo", "tower", "gate", "gear", "memory"]) {
    run(`game.place = "${place}"; game.drawMain().toHTML(); game.drawStatus().toHTML();`);
  }
  run(`game.startQuest("crusher"); for (let i = 0; i < 50; i++) game.questTick(); game.drawMain().toHTML();`);
});
