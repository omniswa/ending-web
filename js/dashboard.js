import { esc, toast } from "./app.js";
import {
  GOALS,
  getGoal,
  setGoal,
  todaySeconds,
  streak,
  week,
} from "./stats.js";
import { exportData, importData } from "./data.js";

export function mountStats(main, onImport = () => {}) {
  let el = main.querySelector("#stats");
  if (!el) {
    el = document.createElement("section");
    el.className = "stats";
    el.setAttribute("aria-label", "Reading goal and backup");
    main.prepend(el);
  }

  function render(focusGoal) {
    const g = getGoal(),
      t = todaySeconds(),
      pct = Math.min(100, Math.floor((t / (g * 60)) * 100)),
      s = streak();
    el.innerHTML = `<div class="st-top"><div><strong class="st-n">${s}</strong> day streak</div>
<label class="st-goal">Daily goal<select id="goal">${GOALS.map((m) => `<option value="${m}"${m === g ? " selected" : ""}>${m} min</option>`).join("")}</select></label></div>
<div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Today's reading goal"><b><i style="width:${pct}%"></i></b>${Math.floor(t / 60)} / ${g} min</div>
<div class="st-week" role="img" aria-label="Last 7 days">${week()
      .map(
        (d) =>
          `<span class="${d.sec >= g * 60 ? "met" : d.missed ? "miss" : d.sec >= 10 ? "some" : ""}" title="${esc(d.key)}: ${Math.floor(d.sec / 60)} min${d.missed ? " (goal missed)" : ""}"><i></i>${esc(d.label)}</span>`,
      )
      .join("")}</div>
<div class="st-data"><button class="btn" data-d="exp">Export progress</button><button class="btn" data-d="imp">Import progress</button><input id="imp" type="file" accept="application/json,.json" hidden></div>`;
    if (focusGoal) el.querySelector("#goal").focus();
  }
  el.addEventListener("change", async (e) => {
    if (e.target.id === "goal") {
      setGoal(+e.target.value);
      render(true);
    } else if (e.target.id === "imp") {
      const f = e.target.files[0];
      e.target.value = "";
      if (!f) return;
      try {
        if (f.size > 5e6) throw new Error("That file is too large");
        toast("Imported: " + importData(await f.text()));
        render();
        onImport();
      } catch (err) {
        toast(err.message || "Could not import that file");
      }
    }
  });
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-d]");
    if (!b) return;
    if (b.dataset.d === "exp") {
      exportData();
      toast("Progress file saved");
    } else el.querySelector("#imp").click();
  });
  render();
  return render;
}
