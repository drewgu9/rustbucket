// Everything on screen is drawn into a grid of characters, then turned into HTML for a <pre>.
// Each cell also knows its CSS class and which click handler it belongs to.
class Grid {
  constructor(w, h) {
    this.w = w;
    this.h = 0;
    this.chars = [];
    this.classes = [];
    this.acts = [];
    this.handlers = [];
    this.hotkeys = {};
    this.ensure(h - 1);
  }

  ensure(y) {
    while (this.h <= y) {
      this.chars.push(new Array(this.w).fill(" "));
      this.classes.push(new Array(this.w).fill(""));
      this.acts.push(new Array(this.w).fill(-1));
      this.h++;
    }
  }

  put(ch, x, y, cls, act) {
    if (x < 0 || x >= this.w || y < 0) return;
    this.ensure(y);
    this.chars[y][x] = ch;
    this.classes[y][x] = cls;
    this.acts[y][x] = act;
  }

  text(str, x, y, cls = "") {
    for (let i = 0; i < str.length; i++) this.put(str[i], x + i, y, cls, -1);
    return x + str.length;
  }

  // Multi-line art. Spaces are transparent; "%" draws a real space, for sprites that hide what's behind them.
  art(lines, x, y, cls = "", fn = null) {
    const act = fn ? this.handler(fn) : -1;
    const shown = fn ? (cls + " hot").trim() : cls;
    lines.forEach((line, row) => {
      for (let i = 0; i < line.length; i++) {
        if (line[i] === " ") continue;
        this.put(line[i] === "%" ? " " : line[i], x + i, y + row, shown, act);
      }
    });
  }

  handler(fn) {
    this.handlers.push(fn);
    return this.handlers.length - 1;
  }

  // Returns the x just after the button, so buttons can be laid out in a row.
  button(label, x, y, fn, opts = {}) {
    const off = opts.off === true;
    const act = off ? -1 : this.handler(fn);
    const cls = "btn" + (off ? " off" : "") + (opts.on ? " on" : "");
    const str = " " + label + " ";
    for (let i = 0; i < str.length; i++) this.put(str[i], x + i, y, cls, act);
    if (opts.key && !off) this.hotkeys[opts.key] = fn;
    return x + str.length + 1;
  }

  // Word-wraps text and returns the next free row.
  para(str, x, y, width, cls = "") {
    let line = "";
    for (const word of str.split(" ")) {
      if (line && line.length + 1 + word.length > width) {
        this.text(line, x, y++, cls);
        line = word;
      } else {
        line = line ? line + " " + word : word;
      }
    }
    if (line) this.text(line, x, y++, cls);
    return y;
  }

  toHTML() {
    const rows = [];
    for (let y = 0; y < this.h; y++) {
      let html = "";
      let end = this.w;
      while (end > 0 && this.chars[y][end - 1] === " " && !this.classes[y][end - 1]) end--;
      let x = 0;
      while (x < end) {
        const cls = this.classes[y][x];
        const act = this.acts[y][x];
        let run = "";
        while (x < end && this.classes[y][x] === cls && this.acts[y][x] === act) run += this.chars[y][x++];
        run = run.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        if (cls || act >= 0) {
          html += '<span class="' + cls + '"' + (act >= 0 ? ' data-act="' + act + '"' : "") + ">" + run + "</span>";
        } else {
          html += run;
        }
      }
      rows.push(html);
    }
    return rows.join("\n");
  }

  // Plain text version, used by the tests.
  toText() {
    return this.chars.map((row) => row.join("").trimEnd()).join("\n");
  }
}
