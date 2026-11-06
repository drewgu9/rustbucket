// Ties everything together. There are two clocks: the economy runs once a second
// and never stops, and quests run ten times a second, so idle income continues during a fight.
Save.reg("playSeconds", 0);

class Game {
  constructor() {
    this.place = "home";
    this.quest = null;
    this.seconds = 0;
    this.saveNote = "";
    this.wipeArmed = false;
    this.handlers = [];
    this.hotkeys = {};
  }

  get hp() { return Save.get("hp"); }
  get playSeconds() { return Save.get("playSeconds"); }

  // --- The one-second clock ---
  secondTick() {
    this.seconds++;
    Save.set("playSeconds", this.playSeconds + 1);
    Res.bolts.add(1);
    this.runDynamo();
    if (!this.quest) this.regenerate();
    if (this.seconds % 30 === 0 && Save.get("unlockMemory") && Save.get("autosave")) {
      Save.store();
    }
  }

  runDynamo() {
    const coils = Save.get("coils");
    if (coils <= 0) return;
    if (coils < COIL_INTERVALS.length) {
      const progress = Save.get("coilProgress") + 1;
      if (progress >= COIL_INTERVALS[coils]) {
        Res.bolts.add(1);
        Save.set("coilProgress", 0);
      } else {
        Save.set("coilProgress", progress);
      }
    } else {
      Res.bolts.add(dynamoPerSecond(coils));
    }
  }

  regenerate() {
    if (this.seconds % 3 === 0) Save.set("hp", Math.min(maxHp(), this.hp + 1));
  }

  // --- The 100ms clock ---
  questTick() {
    if (!this.quest) return;
    this.quest.tick();
    Save.set("hp", Math.max(0, Math.ceil(this.quest.player.hp)));
  }

  // --- Navigation ---
  tabs() {
    const list = [["home", "Chassis"]];
    if (Save.get("unlockMap")) list.push(["map", "Map"]);
    if (Object.keys(ITEMS).some((id) => Items.has(id)) || Save.get("kits") > 0) list.push(["gear", "Gear"]);
    if (Save.get("unlockMemory")) list.push(["memory", "Memory"]);
    return list;
  }

  goTo(place) {
    if (this.quest) return;
    this.place = place;
    this.wipeArmed = false;
    this.saveNote = "";
  }

  startQuest(id) {
    if (this.hp <= 0) return;
    this.quest = new Quest(QUESTS[id], this.hp, maxHp());
  }

  leaveQuest() {
    this.quest = null;
    this.place = Save.get("doneCrusher") && !Save.get("sawEnding") ? this.seeEnding() : "map";
  }

  seeEnding() {
    Save.set("sawEnding", true);
    return "gate";
  }

  // --- Spending ---
  repair(r) {
    if (Res.bolts.add(-r.cost)) Save.set(r.key, true);
  }

  feedMagpie() {
    if (!Res.bolts.transferTo(Res.fed, 10)) return;
    if (Res.fed.current >= 100 && !Items.has("lens")) Items.give("lens");
  }

  buy(item) {
    if (Res.bolts.add(-item.price)) Items.give(item.id);
  }

  buyKit() {
    if (Res.bolts.add(-60)) Save.set("kits", Save.get("kits") + 1);
  }

  windCoils(n) {
    if (Res.bolts.add(-25 * n)) Save.set("coils", Save.get("coils") + n);
  }

  answerRiddle(text) {
    const answer = text.trim().toLowerCase().replace(/^an? /, "");
    if (["gear", "gears", "cog", "cogs", "cogwheel", "gearwheel"].includes(answer)) {
      Items.give("emp");
      Places.tower.wrong = false;
      return true;
    }
    Places.tower.wrong = true;
    return false;
  }

  // --- Drawing ---
  drawStatus() {
    if (!Save.get("unlockDisplay")) return new Grid(1, 1);
    const g = new Grid(100, 1);
    let x = g.text(fmt(Res.bolts.current) + " bolts", 0, 0, "hi") + 2;
    if (Save.get("unlockSensors")) x = g.text("HP " + this.hp + "/" + maxHp(), x, 0, this.hp < maxHp() / 4 ? "bad" : "good") + 2;
    for (const [place, label] of this.tabs()) {
      x = g.button(label, x, 0, () => this.goTo(place), { on: !this.quest && this.place === place, off: !!this.quest });
    }
    return g;
  }

  drawMain() {
    const g = new Grid(100, 1);
    if (this.quest) {
      drawQuest(g, this, this.quest);
    } else {
      const place = Places[this.place];
      const top = place.back ? 2 : 0;
      if (place.back) g.button("Back to the " + place.back, 0, 0, () => this.goTo(place.back));
      const inner = new Grid(100, 1);
      place.draw(inner, this);
      // Copy the place's grid below the back button, keeping its handlers.
      const offset = g.handlers.length;
      inner.chars.forEach((row, y) => row.forEach((ch, x) => {
        const act = inner.acts[y][x];
        if (ch !== " " || inner.classes[y][x]) g.put(ch, x, y + top, inner.classes[y][x], act >= 0 ? act + offset : -1);
      }));
      g.handlers.push(...inner.handlers);
      Object.assign(g.hotkeys, inner.hotkeys);
    }
    return g;
  }

  // --- Memory tab ---
  saveNow() {
    this.saveNote = Save.store() ? "Saved." : "This browser won't let me save. Try the box below.";
  }

  exportSave() {
    this.pendingExport = Save.toText();
    this.saveNote = "Written. Copy it somewhere safe.";
  }

  importSave() {
    this.pendingImport = true;
  }

  wipeClicked() {
    if (!this.wipeArmed) {
      this.wipeArmed = true;
      return;
    }
    Save.wipe();
    this.wipeArmed = false;
    this.place = "home";
    this.saveNote = "";
  }
}

Save.reg("sawEnding", false);
