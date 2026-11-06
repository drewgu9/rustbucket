// The real-time part of the game. A quest is a list of entities on a character grid, ticked
// every 100ms. Rats, bosses, sparks and the player are all the same class with different settings.
class Entity {
  constructor(opts) {
    Object.assign(this, {
      name: "Something", art: ["?"], x: 0, y: 0, team: "mobs", cls: "",
      hp: Infinity, maxHp: Infinity, showBar: false,
      dx: 0, every: 1, moveT: 0,
      gravity: false, climbs: false, solid: true,
      weapons: [], oneShot: false, diesOnBlock: false, diesOnLand: false,
      drop: 0, ai: null,
      jumpT: 0, airborne: false, airJumps: 0,
    }, opts);
    if (this.maxHp === Infinity) this.maxHp = this.hp;
    this.h = this.art.length;
    this.w = Math.max(...this.art.map((l) => l.length));
  }

  get destructible() { return this.hp !== Infinity; }
}

function rectsOverlap(ax, ay, aw, ah, b) {
  return ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;
}

class Quest {
  constructor(def, playerHp, maxHp) {
    this.def = def;
    this.title = def.title;
    this.w = def.w;
    this.h = def.h;
    this.terrain = def.terrain;
    this.decor = def.decor || [];
    this.entities = [];
    this.log = [];
    this.found = 0;
    this.time = 0;
    this.spellCooldown = 0;
    this.ended = false;
    this.won = false;

    this.player = new Entity({
      name: "You", art: ["[o]"], x: 0, y: def.startY, team: "player", cls: "hi",
      hp: playerHp, maxHp, dx: 1, gravity: true, climbs: true, isPlayer: true,
      weapons: [Quest.makeWeapon(Items.weapon(), 1)],
    });
    this.entities.push(this.player);
    def.setup(this);
    this.say(def.intro);
  }

  static makeWeapon(item, reach) {
    return { name: item.name, damage: item.damage, delay: item.delay, reach, wait: 0 };
  }

  say(msg) {
    this.log.push(msg);
    if (this.log.length > 7) this.log.shift();
  }

  add(opts) {
    const e = new Entity(opts);
    this.entities.push(e);
    return e;
  }

  solidAt(x, y, w, h, self) {
    if (y < 0 || x < 0 && self.isPlayer) return true;
    for (let yy = Math.max(y, 0); yy < Math.min(y + h, this.h); yy++) {
      for (let xx = Math.max(x, 0); xx < Math.min(x + w, this.w); xx++) {
        if (this.terrain[yy][xx] !== " ") return true;
      }
    }
    if (!self.solid) return false;
    for (const other of this.entities) {
      if (other !== self && other.solid && rectsOverlap(x, y, w, h, other)) return true;
    }
    return false;
  }

  free(e, dx, dy) {
    return !this.solidAt(e.x + dx, e.y + dy, e.w, e.h, e);
  }

  // Climbing is for terrain steps only, or you could walk up and over a rat.
  entityAt(e, dx, dy) {
    return this.entities.some((o) => o !== e && o.solid && rectsOverlap(e.x + dx, e.y + dy, e.w, e.h, o));
  }

  jump() {
    const p = this.player;
    if (this.ended) return;
    const grounded = !this.free(p, 0, 1);
    if (!grounded && p.airJumps <= 0) return;
    if (!grounded) p.airJumps--;
    p.jumpT = Items.jumpHeight();
    p.airborne = true;
  }

  useKit() {
    if (this.ended || this.spellCooldown > 0 || Save.get("kits") <= 0) return;
    Save.set("kits", Save.get("kits") - 1);
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 60);
    this.spellCooldown = 10;
    this.say("You patch yourself up with a repair kit. +60 HP.");
  }

  castEmp() {
    if (this.ended || this.spellCooldown > 0 || !Items.has("emp")) return;
    let hit = 0;
    for (const e of this.entities) {
      if (e.team !== "player" && e.destructible) {
        e.hp -= 30;
        hit++;
      }
    }
    this.spellCooldown = 80;
    this.say("EMP! " + hit + " enem" + (hit === 1 ? "y" : "ies") + " shocked for 30.");
  }

  // One tick: check the end conditions, update everything, then sweep out the dead.
  tick() {
    if (this.ended) return;
    this.time++;
    if (this.spellCooldown > 0) this.spellCooldown--;

    if (this.player.x + this.player.w >= this.w) return this.finish(true);
    if (this.player.hp <= 0 || this.player.y >= this.h) return this.finish(false);

    if (this.def.tick) this.def.tick(this);
    for (const e of this.entities.slice()) this.updateEntity(e);
    this.sweep();
  }

  updateEntity(e) {
    if (e.ai) e.ai(this, e);
    const fell = this.applyGravity(e);
    if (!fell || e.airborne) this.applyMovement(e);
    this.applyCombat(e);
  }

  // Returns true if the entity fell this tick. Walking is skipped while falling, unless
  // the fall started with a jump, which is what makes jumping across a pit possible.
  applyGravity(e) {
    if (e.jumpT > 0) {
      e.jumpT--;
      if (this.free(e, 0, -1)) e.y--;
      else e.jumpT = 0;
      return false;
    }
    if (!e.gravity) return false;
    if (this.free(e, 0, 1)) {
      e.y++;
      return true;
    }
    if (e.airborne || e.isPlayer) {
      e.airborne = false;
      if (e.isPlayer) e.airJumps = Items.has("gyro") ? 1 : 0;
    }
    if (e.diesOnLand) e.hp = 0;
    return false;
  }

  applyMovement(e) {
    if (!e.dx) return;
    if (++e.moveT < e.every) return;
    e.moveT = 0;
    if (this.free(e, e.dx, 0)) {
      e.x += e.dx;
    } else if (e.climbs && !this.entityAt(e, e.dx, 0) && this.free(e, 0, -1) && this.free(e, e.dx, -1)) {
      e.x += e.dx;
      e.y--;
    } else if (e.diesOnBlock) {
      e.hp = 0;
    }
  }

  applyCombat(e) {
    for (const w of e.weapons) {
      if (w.wait > 0) {
        w.wait--;
        continue;
      }
      for (const target of this.entities.slice()) {
        if (target.team === e.team || !target.destructible || target.hp <= 0) continue;
        if (!rectsOverlap(e.x - w.reach, e.y, e.w + 2 * w.reach, e.h, target)) continue;
        this.hit(e, target, w);
        w.wait = w.delay;
      }
    }
  }

  hit(attacker, target, weapon) {
    let damage = weapon.damage;
    if (attacker.isPlayer) damage = Items.chain("onHit", damage);
    if (target.isPlayer) damage = Items.chain("onHurt", damage);
    target.hp -= damage;
    if (target.isPlayer && attacker.oneShot) this.say(attacker.name + " hits you for " + damage + ".");
    if (attacker.oneShot) attacker.hp = 0;
  }

  sweep() {
    this.entities = this.entities.filter((e) => {
      if (e.isPlayer) return true;
      if (e.hp <= 0) {
        if (e.drop) {
          const n = Items.chain("onFind", e.drop);
          this.found += n;
          this.say(e.name + " is scrap. You salvage " + n + " bolts.");
        }
        if (e.onDeath) e.onDeath(this);
        return false;
      }
      return e.x + e.w >= 0 && e.x < this.w && e.y < this.h;
    });
  }

  // Loot is only paid out on a win: die and everything you picked up is lost.
  finish(won) {
    this.ended = true;
    this.won = won;
    this.player.hp = Math.max(0, won ? this.player.hp : 0);
    if (won) {
      Res.bolts.add(this.found);
      this.say("Made it! " + this.found + " bolts salvaged.");
      if (this.def.onWin) this.def.onWin(this);
    } else {
      this.say(this.found ? "You shut down. The " + this.found + " bolts you salvaged are lost." : "You shut down.");
    }
  }

  draw(g, top) {
    for (let y = 0; y < this.h; y++) {
      const row = this.terrain[y];
      for (let x = 0; x < this.w; x++) {
        if (row[x] !== " ") g.put(row[x], x, top + y, "dim", -1);
      }
    }
    for (const d of this.decor) g.text(d.text, d.x, top + d.y, d.cls || "dim");
    for (const e of this.entities) {
      g.art(e.art, e.x, top + e.y, e.cls);
      if (e.showBar && e.hp > 0) {
        const filled = Math.ceil((e.w * e.hp) / e.maxHp);
        g.text("#".repeat(filled).padEnd(e.w, "."), e.x, top + e.y - 1, "bad");
      }
    }
  }
}
