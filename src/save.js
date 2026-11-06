// A flat registry of every persistent value in the game.
// Each module registers its keys when it loads, so saving is just dumping this map.
const Save = (() => {
  const SLOT = "rustbucket.save";
  const defaults = {};
  const data = {};

  function reg(key, value) {
    defaults[key] = value;
    data[key] = value;
  }

  function get(key) {
    if (!(key in defaults)) throw new Error("Unregistered save key: " + key);
    return data[key];
  }

  function set(key, value) {
    if (!(key in defaults)) throw new Error("Unregistered save key: " + key);
    data[key] = value;
  }

  function toText() {
    return Object.keys(defaults).map((k) => k + "=" + JSON.stringify(data[k])).join("\n");
  }

  // Unknown keys and values of the wrong type are ignored, so old or hand-edited saves can't break the game.
  function fromText(text) {
    let loaded = 0;
    for (const line of String(text).split("\n")) {
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      if (!(key in defaults)) continue;
      try {
        const value = JSON.parse(line.slice(eq + 1));
        if (typeof value === typeof defaults[key]) {
          data[key] = value;
          loaded++;
        }
      } catch (e) { /* skip the bad line */ }
    }
    return loaded;
  }

  function reset() {
    for (const k in defaults) data[k] = defaults[k];
  }

  // localStorage can throw in private windows, so a failed save or load is never fatal.
  function store() {
    try {
      localStorage.setItem(SLOT, toText());
      return true;
    } catch (e) {
      return false;
    }
  }

  function restore() {
    try {
      const text = localStorage.getItem(SLOT);
      return text ? fromText(text) > 0 : false;
    } catch (e) {
      return false;
    }
  }

  function wipe() {
    try { localStorage.removeItem(SLOT); } catch (e) { /* nothing to wipe */ }
    reset();
  }

  return { reg, get, set, toText, fromText, reset, store, restore, wipe };
})();
