// A number that can be spent. It remembers its highest value, because unlocks are
// checked against the max: spending your bolts never hides a button you already earned.
class Resource {
  constructor(key) {
    this.key = key;
    Save.reg(key + "Current", 0);
    Save.reg(key + "Total", 0);
    Save.reg(key + "Max", 0);
  }

  get current() { return Save.get(this.key + "Current"); }
  get total() { return Save.get(this.key + "Total"); }
  get max() { return Save.get(this.key + "Max"); }

  add(n) {
    if (this.current + n < 0) return false;
    Save.set(this.key + "Current", this.current + n);
    if (n > 0) Save.set(this.key + "Total", this.total + n);
    if (this.current > this.max) Save.set(this.key + "Max", this.current);
    return true;
  }

  // Moves n (or everything) into another resource. Spending is usually a transfer, so
  // "bolts bolted on" and "bolts fed to the magpie" become resources of their own.
  transferTo(other, n = this.current) {
    if (n > this.current) return false;
    this.add(-n);
    other.add(n);
    return true;
  }
}

const Res = {
  bolts: new Resource("bolts"),
  bolted: new Resource("bolted"),
  fed: new Resource("fed"),
};

function fmt(n) {
  return Math.floor(n).toLocaleString("en-US");
}
