// Level data. Terrain is built from [fromX, toX, groundRow] spans; anything not covered is a pit.
Save.reg("doneHeap", false);
Save.reg("doneCulvert", false);
Save.reg("doneCrusher", false);

function buildTerrain(w, h, spans, fill = "#") {
  const rows = [];
  for (let y = 0; y < h; y++) rows.push(new Array(w).fill(" "));
  for (const [from, to, ground] of spans) {
    for (let x = from; x <= to; x++) {
      for (let y = ground; y < h; y++) rows[y][x] = y === ground ? "=" : fill;
    }
  }
  return rows;
}

const Mob = {
  rat: (x, y) => ({
    name: "The scrap rat", art: ["<:~"], x, y: y - 1, hp: 5, dx: -1, every: 3, gravity: true, climbs: true, cls: "bad",
    weapons: [{ damage: 2, delay: 6, reach: 1, wait: 0 }], drop: 3,
  }),
  hulk: (x, y) => ({
    name: "The rust hulk", art: ["/#\\", "|_|"], x, y: y - 2, hp: 25, gravity: true, cls: "bad", showBar: true,
    weapons: [{ damage: 4, delay: 8, reach: 1, wait: 0 }], drop: 20,
  }),
  // Hovers at chest height and shoots sparks down the corridor. Jump them or take the hit.
  drone: (x, y) => ({
    name: "The patrol drone", art: ["<o>"], x, y: y - 1, hp: 10, cls: "cold",
    weapons: [{ damage: 3, delay: 8, reach: 1, wait: 0 }], drop: 10,
    ai(q, e) {
      if (q.time % 25 === 0 && e.x - q.player.x < 45 && e.x - q.player.x > 5) {
        q.add({
          name: "A spark", art: ["-"], x: e.x - 1, y: e.y, dx: -1, solid: false, oneShot: true, diesOnBlock: true, hp: Infinity, cls: "cold",
          weapons: [{ damage: 5, delay: 0, reach: 0, wait: 0 }],
        });
      }
    },
  }),
};

const QUESTS = {
  heap: {
    title: "The Slag Heap",
    w: 100,
    h: 16,
    startY: 11,
    intro: "You trundle up the Slag Heap. Something is skittering around up there.",
    terrain: buildTerrain(100, 16, [
      [0, 18, 12], [19, 30, 11], [31, 44, 10], [45, 58, 11], [59, 74, 12], [75, 86, 11], [87, 99, 12],
    ]),
    setup(q) {
      [[16, 12], [28, 11], [36, 10], [42, 10], [52, 11], [66, 12]].forEach(([x, y]) => q.add(Mob.rat(x, y)));
      q.add(Mob.hulk(84, 11));
    },
    onWin(q) {
      if (!Save.get("doneHeap")) q.say("From the top of the heap you spot a culvert, and a shed with a dynamo in it.");
      Save.set("doneHeap", true);
    },
  },

  culvert: {
    title: "The Flooded Culvert",
    w: 100,
    h: 16,
    startY: 11,
    intro: "The culvert stinks of old coolant. Falling in would be the end of you. Press SPACE to jump!",
    terrain: buildTerrain(100, 16, [
      [0, 14, 12], [20, 34, 12], [39, 46, 11], [52, 66, 12], [71, 84, 11], [90, 99, 12],
    ]),
    decor: [
      { text: "~~~~~", x: 15, y: 15, cls: "cold" }, { text: "~~~~", x: 35, y: 15, cls: "cold" },
      { text: "~~~~~", x: 47, y: 15, cls: "cold" }, { text: "~~~~", x: 67, y: 15, cls: "cold" },
      { text: "~~~~~", x: 85, y: 15, cls: "cold" },
    ],
    setup(q) {
      q.add(Mob.rat(28, 12));
      q.add(Mob.drone(44, 11));
      q.add(Mob.rat(58, 12));
      q.add(Mob.drone(64, 12));
      q.add(Mob.hulk(80, 11));
      q.add(Mob.rat(95, 12));
    },
    onWin(q) {
      if (!Save.get("doneCulvert")) {
        Items.give("gyro");
        q.say("You pull a working gyro out of the sludge! You can now jump once in mid-air.");
        q.say("Beyond the culvert: a radio tower, and something very large going THOOM.");
      }
      Save.set("doneCulvert", true);
    },
  },

  crusher: {
    title: "The Crusher",
    w: 100,
    h: 16,
    startY: 11,
    intro: "The Crusher wakes up. It has been waiting a long time for something to crush.",
    terrain: buildTerrain(100, 16, [[0, 99, 12]]),
    setup(q) {
      const boss = q.add({
        name: "The Crusher", x: 74, y: 3, hp: 250, cls: "bad", showBar: true,
        art: [
          ".-============-.",
          "|  [#]    [#]  |",
          "|      __      |",
          "|  |||||||||||  |".slice(0, 16),
          "|______________|",
          "  ||        ||  ",
          "  ||        ||  ",
          " _||_      _||_ ",
          "[____]    [____]",
        ],
        weapons: [{ damage: 6, delay: 10, reach: 1, wait: 0 }],
        drop: 400,
        ai(q2, e) {
          const distance = e.x - q2.player.x;
          const rate = e.hp < e.maxHp / 2 ? 20 : 30;
          if (q2.time % rate === 0 && distance > 8) {
            q2.add({
              name: "A shockwave", art: ["^^"], x: e.x - 3, y: 11, dx: -1, solid: false, oneShot: true, diesOnBlock: true, cls: "bad",
              weapons: [{ damage: 12, delay: 0, reach: 0, wait: 0 }],
            });
          }
          if (q2.time % 45 === 0) {
            q2.add({
              name: "Falling scrap", art: ["#"], x: q2.player.x + 1, y: 0, gravity: true, solid: false, oneShot: true, diesOnLand: true, cls: "bad",
              weapons: [{ damage: 8, delay: 0, reach: 0, wait: 0 }],
            });
          }
        },
        onDeath(q2) {
          q2.say("The Crusher grinds to a halt. The gate behind it swings open!");
        },
      });
      q.boss = boss;
    },
    onWin() {
      Save.set("doneCrusher", true);
    },
  },
};
