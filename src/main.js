// The browser layer: clocks, input, and copying the grids into the page.
if (typeof document !== "undefined") {
  const game = new Game();
  const statusEl = document.getElementById("status");
  const mainEl = document.getElementById("main");
  const riddleBox = document.getElementById("riddleBox");
  const riddleInput = document.getElementById("riddle");
  const saveBox = document.getElementById("saveBox");
  const saveText = document.getElementById("saveText");
  let statusHandlers = [];
  let mainHandlers = [];
  let hotkeys = {};
  let lastStatus = null;
  let lastMain = null;

  function render() {
    if (game.pendingImport) {
      game.pendingImport = false;
      game.saveNote = Save.fromText(saveText.value) > 0 ? "Loaded." : "That doesn't look like a save.";
    }
    if (game.pendingExport) {
      saveText.value = game.pendingExport;
      game.pendingExport = null;
    }

    const status = game.drawStatus();
    const main = game.drawMain();
    statusHandlers = status.handlers;
    mainHandlers = main.handlers;
    hotkeys = main.hotkeys;

    // Only touch the DOM when something changed, so hover states and text selection survive.
    const statusHtml = status.toHTML();
    const mainHtml = main.toHTML();
    if (statusHtml !== lastStatus) statusEl.innerHTML = lastStatus = statusHtml;
    if (mainHtml !== lastMain) mainEl.innerHTML = lastMain = mainHtml;

    const place = game.quest ? {} : Places[game.place];
    riddleBox.hidden = !(place.riddle && !Items.has("emp"));
    saveBox.hidden = !place.showSave;
  }

  // Buttons are redrawn constantly, so a click (press + release on the same node) would often
  // be lost. Acting on pointerdown avoids that.
  function bindClicks(el, getHandlers) {
    el.addEventListener("pointerdown", (event) => {
      const target = event.target.closest("[data-act]");
      if (!target) return;
      const fn = getHandlers()[Number(target.dataset.act)];
      if (fn) {
        event.preventDefault();
        fn();
        render();
      }
    });
  }
  bindClicks(statusEl, () => statusHandlers);
  bindClicks(mainEl, () => mainHandlers);

  document.addEventListener("keydown", (event) => {
    if (event.target.matches("input, textarea")) return;
    const key = event.key === "Enter" ? "enter" : event.key.toLowerCase();
    const fn = hotkeys[key];
    if (fn) {
      event.preventDefault();
      if (!event.repeat || key === " ") fn();
      render();
    }
  });

  riddleInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    if (game.answerRiddle(riddleInput.value)) riddleInput.value = "";
    render();
  });

  Save.restore();
  render();

  setInterval(() => {
    game.secondTick();
    render();
  }, 1000);

  setInterval(() => {
    if (game.quest) {
      game.questTick();
      render();
    }
  }, 100);

  // A hook for the browser console and for playtesting.
  window.rustbucket = game;
}
