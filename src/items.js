// Items never touch the combat code directly. They expose optional hooks (onHit, onHurt, onFind)
// and every number flows through whatever the player has active.
const FISTS = { id: "fists", name: "Bare clamps", slot: "weapon", damage: 1, delay: 6 };

const ITEMS = {
  wrench: { name: "Big Wrench", slot: "weapon", price: 40, damage: 3, delay: 6, desc: "3 damage. Rats hate it." },
  cutter: { name: "Ion Cutter", slot: "weapon", price: 600, damage: 8, delay: 5, needs: "doneHeap", desc: "8 damage, and a bit quicker." },
  hardhat: {
    name: "Hard Hat", slot: "head", price: 80, desc: "Blocks 1 damage per hit.",
    onHurt: (d) => Math.max(1, d - 1),
  },
  blasthelm: {
    name: "Blast Helm", slot: "head", price: 500, needs: "doneCulvert", desc: "Blocks 3 damage per hit.",
    onHurt: (d) => Math.max(1, d - 3),
  },
  springs: { name: "Spring Legs", slot: "feet", price: 150, jump: 5, desc: "Jump higher and further." },
  magnet: {
    name: "Magnet Palm", price: 300, desc: "Always on. Salvage 50% more bolts.",
    onFind: (n) => Math.ceil(n * 1.5),
  },
  // Not for sale: these come from quests, the magpie and the radio tower.
  gyro: { name: "Salvaged Gyro", desc: "Always on. Jump once more in mid-air." },
  lens: {
    name: "Shiny Lens", desc: "Always on. One hit in five does double damage.",
    onHit: (d) => (Math.random() < 0.2 ? d * 2 : d),
  },
  emp: { name: "EMP Charge", desc: "A spell: shocks every enemy on screen." },
};

for (const id in ITEMS) {
  ITEMS[id].id = id;
  Save.reg("has_" + id, false);
}
Save.reg("eq_weapon", "");
Save.reg("eq_head", "");
Save.reg("eq_feet", "");
Save.reg("kits", 0);

const Items = {
  has: (id) => Save.get("has_" + id),

  give(id) {
    Save.set("has_" + id, true);
    const slot = ITEMS[id].slot;
    if (slot && !Save.get("eq_" + slot)) Save.set("eq_" + slot, id);
  },

  equipped: (slot) => ITEMS[Save.get("eq_" + slot)] || null,

  equip(slot, id) {
    Save.set("eq_" + slot, Save.get("eq_" + slot) === id ? "" : id);
  },

  weapon: () => Items.equipped("weapon") || FISTS,

  jumpHeight: () => (Items.equipped("feet") ? Items.equipped("feet").jump : 3),

  // Everything currently affecting the player: slotless items you own, plus what's equipped.
  active() {
    return Object.values(ITEMS).filter((it) =>
      Items.has(it.id) && (!it.slot || Save.get("eq_" + it.slot) === it.id));
  },

  // Passes a value through a hook on every active item.
  chain(hook, value) {
    for (const it of Items.active()) if (it[hook]) value = it[hook](value);
    return value;
  },
};
