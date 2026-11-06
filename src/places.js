// A place is one screen: it draws itself into a Grid each time the game re-renders.
// The unlock ladder and the map both work by checking save flags at draw time.
Save.reg("hp", 100);
Save.reg("unlockDisplay", false);
Save.reg("unlockMemory", false);
Save.reg("unlockSensors", false);
Save.reg("unlockMap", false);
Save.reg("autosave", true);
Save.reg("coils", 0);
Save.reg("coilProgress", 0);

const REPAIRS = [
  { key: "unlockDisplay", label: "Repair your display", cost: 30, after: "Tabs! You can see tabs now." },
  { key: "unlockMemory", label: "Repair your memory", cost: 10, after: "You will now remember things between power cycles." },
  { key: "unlockSensors", label: "Repair your damage sensors", cost: 10, after: "Turns out you've been at 100% this whole time. Nice." },
  { key: "unlockMap", label: "Repair your navigation", cost: 20, after: "" },
];

const ROBOT = [
  "    _____",
  "   | o o |",
  "   |  ~  |",
  "   '-----'",
  "  __|___|__",
  " |  [ ]    |--o",
  " |_________|",
  "   O     O",
];

const MAGPIE_LINES = [
  { fed: 0, art: ["  ,", " (')>", " /)) ", "  ''"], text: "A magpie is eyeing your bolts." },
  { fed: 30, art: ["  ,", " (^)>", " /)) ", "_''_"], text: "The magpie has started a nest of bolts." },
  { fed: 60, art: ["  ,", " (^)>", " /)) *", "_''___"], text: "It keeps staring at the old radio tower. Teeth, it croaks. Teeth that never bite." },
  { fed: 100, art: ["  ,  *", " (^)>", " /)) *", "__''___"], text: "The magpie considers you family." },
];

// The first few coils are slow on purpose: seconds per bolt, read from a table.
// After that it's bolts per second on a curve that flattens out, so each coil adds less than the last.
const COIL_INTERVALS = [0, 30, 20, 12, 8, 5, 3, 2];

function dynamoPerSecond(coils) {
  if (coils < COIL_INTERVALS.length) return 0;
  return Math.ceil(40 * (1 - Math.exp(-(coils - COIL_INTERVALS.length + 1) / 60)));
}

function maxHp() {
  return 100 + Math.ceil(200 * (1 - Math.exp(-Res.bolted.current / 800)));
}

const Places = {
  home: {
    draw(g, game) {
      const bolts = Res.bolts;
      g.text("You have " + fmt(bolts.current) + " bolt" + (bolts.current === 1 ? "" : "s") + ".", 0, 0, "hi");
      g.art(ROBOT, 54, 0);
      const belt = ">  ".repeat(9).slice(game.seconds % 3, 21 + (game.seconds % 3));
      g.text("=====================", 50, 9, "dim");
      g.text(belt, 50, 10, "dim");

      let y = 2;
      if (bolts.max >= 1) {
        g.button("Bolt them all onto your chassis", 0, y, () => { bolts.transferTo(Res.bolted); }, { key: "b", off: bolts.current < 1 });
        if (Res.bolted.current > 0) g.text(fmt(Res.bolted.current) + " bolted on. Max HP " + maxHp() + ".", 0, y + 1, "dim");
        y += 3;
      }
      if (bolts.max >= 10) {
        g.button("Feed 10 bolts to the magpie", 0, y, () => game.feedMagpie(), { key: "f", off: bolts.current < 10 });
        const stage = MAGPIE_LINES.filter((s) => Res.fed.current >= s.fed).pop();
        g.art(stage.art, 0, y + 1, "cold");
        y = g.para(stage.text, 9, y + 2, 38, "dim") + 3;
      }
      if (bolts.max >= 30) {
        const next = REPAIRS.find((r) => !Save.get(r.key));
        const last = [...REPAIRS].reverse().find((r) => Save.get(r.key));
        if (next) {
          g.button(next.label + " (" + next.cost + " bolts)", 0, y, () => game.repair(next), { off: bolts.current < next.cost });
          if (last && last.after) g.para(last.after, 0, y + 1, 46, "dim");
        }
      }
    },
  },

  map: {
    draw(g, game) {
      g.text("THE SCRAPYARD", 0, 0, "hi");
      const dots = [
        "                         .                              .",
        "      .                                      .",
        "                 .                                          .",
        "  ___________________________________________________________",
        " /                                                           \\",
      ];
      g.art(dots, 2, 1, "dim");
      const go = (name) => () => game.goTo(name);
      const label = (text, x, y) => g.text(text, x, y, "dim");

      g.art(["  ___  ", " |VEND|", " |_9__|"], 4, 8, "", go("shop"));
      label("VEND-9's shop", 3, 11);
      g.art(["   /\\   ", "  /##\\  ", " /####\\ "], 22, 8, "", () => game.startQuest("heap"));
      label("The Slag Heap", 21, 11);

      if (Save.get("doneHeap")) {
        g.art([" _____ ", "|(@)  |", "|_____|"], 42, 8, "", go("dynamo"));
        label("Dynamo shed", 42, 11);
        g.art(["==(  )==", "  ~~~~  "], 21, 14, "", () => game.startQuest("culvert"));
        label("The Flooded Culvert", 18, 16);
      }
      if (Save.get("doneCulvert")) {
        g.art(["  )|(  ", "   |   ", "  /|\\  ", " / | \\ "], 58, 7, "", go("tower"));
        label("Radio tower", 58, 11);
        g.art([" .----. ", " |#  #| ", " |WWWW| ", " '----' "], 43, 13, "", () => game.startQuest("crusher"));
        label("The Crusher", 43, 17);
      }
      if (Save.get("doneCrusher")) {
        g.art(["  * ", " *** ", "|   |"], 62, 13, "good", go("gate"));
        label("The open gate", 58, 16);
      }
      if (game.hp <= 0) g.text("You're out of power. Wait for your HP to recover before setting out.", 0, 19, "bad");
    },
  },

  shop: {
    back: "map",
    draw(g, game) {
      g.art([" .------.", " | $  $ |", " |  --  |", " '------'", "  VEND-9"], 0, 2, "cold");
      g.para("\"INSERT BOLTS. NO REFUNDS. NO, THAT IS NOT A RAT, THAT IS MY NEPHEW.\"", 12, 2, 50, "dim");
      let y = 8;
      for (const it of Object.values(ITEMS)) {
        if (!it.price || Items.has(it.id)) continue;
        if (it.needs && !Save.get(it.needs)) continue;
        g.button("Buy " + it.name + " (" + fmt(it.price) + ")", 0, y, () => game.buy(it), { off: Res.bolts.current < it.price });
        g.text(it.desc, 36, y++, "dim");
      }
      g.button("Buy a repair kit (60)", 0, y, () => game.buyKit(), { off: Res.bolts.current < 60 });
      g.text("+60 HP mid-quest. You own " + Save.get("kits") + ".", 36, y, "dim");
    },
  },

  dynamo: {
    back: "map",
    draw(g, game) {
      const coils = Save.get("coils");
      g.art(["  ,-----.", " ( (@@@) )==[ ]", "  '-----'"], 0, 2, "hi");
      g.text("Coils wound: " + fmt(coils), 18, 2);
      let rate = "Silent.";
      if (coils > 0 && coils < COIL_INTERVALS.length) rate = "One bolt every " + COIL_INTERVALS[coils] + " seconds.";
      else if (coils >= COIL_INTERVALS.length) rate = dynamoPerSecond(coils) + " extra bolts per second.";
      g.text(rate, 18, 3, "good");
      let x = g.button("Wind 1 coil (25)", 0, 6, () => game.windCoils(1), { off: Res.bolts.current < 25 });
      g.button("Wind 10 coils (250)", x, 6, () => game.windCoils(10), { off: Res.bolts.current < 250 });
    },
  },

  tower: {
    back: "map",
    riddle: true,
    draw(g) {
      g.art(["  )|(", "   |", "  /|\\", " / | \\"], 0, 2, "cold");
      if (Items.has("emp")) {
        g.para("The radio hums happily. You already took its EMP charge.", 10, 2, 50);
      } else {
        g.para("The old radio crackles a question over and over. Beneath it sits an armored box with a voice lock.", 10, 2, 50);
        g.text('"I HAVE TEETH BUT I NEVER BITE.', 10, 6, "cold");
        g.text(' I TURN ALL DAY BUT GO NOWHERE."', 10, 7, "cold");
        if (Places.tower.wrong) g.text("The lock buzzes. That isn't it.", 10, 9, "bad");
      }
    },
  },

  gate: {
    back: "map",
    draw(g, game) {
      g.art([
        "     .        *          .     ",
        "  *        .       .        *  ",
        "      .        ____     .      ",
        "         .   ,'    `.          ",
        "  ~~~~~~~~~~/   ()   \\~~~~~~~~~",
        "  ~~~~~~~~~~\\________/~~~~~~~~~",
      ], 0, 2, "cold");
      let y = g.para("Past the gate there is no more scrap. There is a sea, a sky, and a conveyor belt running off toward the horizon.", 0, 9, 60);
      y = g.para("You could keep bolting things onto yourself. Or you could go and see where the bolts were coming from.", 0, y + 1, 60);
      g.text("THE END. Thanks for playing.", 0, y + 1, "good");
      g.text(fmt(Res.bolts.total) + " bolts earned in " + fmt(game.playSeconds) + " seconds of play.", 0, y + 2, "dim");
    },
  },

  gear: {
    draw(g) {
      g.text("WHAT YOU'RE CARRYING", 0, 0, "hi");
      let y = 2;
      for (const slot of ["weapon", "head", "feet"]) {
        g.text(slot.toUpperCase(), 0, y++, "dim");
        const owned = Object.values(ITEMS).filter((it) => it.slot === slot && Items.has(it.id));
        if (!owned.length) g.text(slot === "weapon" ? FISTS.name : "Nothing yet", 2, y++, "dim");
        for (const it of owned) {
          const on = Save.get("eq_" + slot) === it.id;
          g.button((on ? "[x] " : "[ ] ") + it.name, 2, y, () => Items.equip(slot, it.id), { on });
          g.text(it.desc, 34, y++, "dim");
        }
        y++;
      }
      const passive = Object.values(ITEMS).filter((it) => !it.slot && Items.has(it.id));
      if (passive.length) g.text("ALWAYS ON", 0, y++, "dim");
      for (const it of passive) {
        g.text(it.name, 2, y);
        g.text(it.desc, 34, y++, "dim");
      }
      g.text("Repair kits: " + Save.get("kits"), 0, y + 1, "dim");
    },
  },

  memory: {
    showSave: true,
    draw(g, game) {
      g.text("MEMORY BANKS", 0, 0, "hi");
      const on = Save.get("autosave");
      let x = g.button((on ? "[x]" : "[ ]") + " Autosave every 30 seconds", 0, 2, () => Save.set("autosave", !on), { on });
      g.button("Save now", x, 2, () => game.saveNow());
      if (game.saveNote) g.text(game.saveNote, 0, 3, "good");
      x = g.button("Write save to the box below", 0, 5, () => game.exportSave());
      g.button("Load from the box below", x, 5, () => game.importSave());
      const armed = game.wipeArmed;
      g.button(armed ? "Really wipe everything?" : "Wipe memory", 0, 7, () => game.wipeClicked());
    },
  },
};

// Drawn every frame while a quest is running.
function drawQuest(g, game, q) {
  g.text(q.title, 0, 0, "hi");
  g.text("Weapon: " + Items.weapon().name, 26, 0, "dim");
  let x = g.button("Jump (space)", 0, 1, () => q.jump(), { key: " " });
  const ready = q.spellCooldown === 0;
  x = g.button("Repair kit x" + Save.get("kits") + " (1)", x, 1, () => q.useKit(), { key: "1", off: !ready || Save.get("kits") <= 0 });
  if (Items.has("emp")) g.button("EMP (2)", x, 1, () => q.castEmp(), { key: "2", off: !ready });
  const top = 3;
  q.draw(g, top);
  const bar = Math.max(0, Math.ceil((30 * q.player.hp) / q.player.maxHp));
  g.text("HP [" + "#".repeat(bar).padEnd(30, ".") + "] " + Math.max(0, Math.ceil(q.player.hp)) + "/" + q.player.maxHp, 0, top + q.h + 1, q.player.hp < q.player.maxHp / 4 ? "bad" : "good");
  const logTop = top + q.h + 3;
  q.log.forEach((line, i) => g.text(line, 0, logTop + i, i === q.log.length - 1 ? "" : "dim"));
  if (q.ended) {
    const label = q.won ? "Back to the map" : "Limp back to the map";
    g.button(label, 0, logTop + 8, () => game.leaveQuest(), { key: "enter" });
  }
}
