/**
 * Reader page. The chapter lives in a scroll container; progress is stored as
 * (chapter, scroll fraction) so it survives font-size or window changes.
 */
import { APP_NAME } from "../config.js";
import { h, icon } from "../core/dom.js";
import { clamp, debounce, rafThrottle } from "../core/utils.js";
import {
  applyReaderPrefs,
  createReaderSettings,
} from "../components/readerSettings.js";
import { createToc } from "../components/readerToc.js";
import { errorState } from "../components/status.js";
import { toast } from "../components/toast.js";
import { getBookBlob, resolveBook } from "../services/library.js";
import { openEpub } from "../services/epub/book.js";
import {
  getProgress,
  markFinished,
  saveLocation,
} from "../services/progress.js";
import { startReadingTimer } from "../services/readingTimer.js";
import { subscribeSelect } from "../state/store.js";

const RESTORE_WINDOW_MS = 1200;
const SAVE_DELAY_MS = 600;

export async function mount({ root, params, router }) {
  root.replaceChildren(
    h(
      "div",
      { class: "reader-loading", role: "status" },
      h("span", { class: "spinner", "aria-hidden": "true" }),
      "Opening book…",
    ),
  );

  const book = await resolveBook(params.id);
  if (!book) {
    root.replaceChildren(
      h(
        "div",
        { class: "container" },
        errorState({
          title: "Book not found",
          text: "It may have been removed from your library.",
        }),
        h(
          "p",
          { class: "center" },
          h("a", { class: "btn", href: "#/" }, "Back to library"),
        ),
      ),
    );
    return null;
  }

  let epub;
  try {
    epub = await openEpub(await getBookBlob(book));
  } catch (error) {
    console.error(error);
    root.replaceChildren(
      h(
        "div",
        { class: "container" },
        errorState({
          title: "This book could not be opened",
          text: error.message,
        }),
        h(
          "p",
          { class: "center" },
          h("a", { class: "btn", href: router.backHref() }, "Go back"),
        ),
      ),
    );
    return null;
  }

  document.title = `${book.title} · ${APP_NAME}`;
  const view = createReaderView({ book, epub, backHref: router.backHref() });
  root.replaceChildren(view.el);
  view.start();
  return { unmount: view.destroy };
}

function createReaderView({ book, epub, backHref }) {
  const lastIndex = epub.spine.length - 1;
  const saved = getProgress(book.id);
  let chapter = clamp(saved.chapter, 0, lastIndex);
  let current = { chapter, offset: saved.offset, percent: saved.percent };
  let token = 0;
  let lastScrollTop = 0;
  let restoring = false;
  let restoreOffset = 0;
  let restoreTimer = null;
  let started = false;
  let destroyed = false;

  // ----- Structure -----
  const chapterLabel = h("span", { class: "reader__chapter" });
  const article = h("article", {
    class: "prose",
    lang: epub.metadata.language || null,
  });
  const prevButton = h(
    "button",
    { class: "btn btn--ghost", type: "button", onclick: () => go(chapter - 1) },
    icon("chevron-left", { size: 18 }),
    "Previous",
  );
  const nextLabel = h("span");
  const nextButton = h(
    "button",
    { class: "btn btn--primary", type: "button", onclick: onNext },
    nextLabel,
    icon("chevron-right", { size: 18 }),
  );
  const scroller = h(
    "div",
    {
      class: "reader__scroll",
      tabindex: "0",
      role: "region",
      "aria-label": `${book.title} text`,
    },
    h(
      "div",
      { class: "reader__page" },
      article,
      h(
        "nav",
        { class: "reader__chapter-nav", "aria-label": "Chapters" },
        prevButton,
        nextButton,
      ),
    ),
  );
  const progressFill = h("div", { class: "reader__progress-fill" });
  const progressBar = h(
    "div",
    {
      class: "reader__progress",
      role: "progressbar",
      "aria-label": "Reading progress",
      "aria-valuemin": "0",
      "aria-valuemax": "100",
    },
    progressFill,
  );
  const status = h("span", { class: "reader__status" });

  const el = h(
    "div",
    { class: "reader", dataset: { chrome: "visible" } },
    h(
      "header",
      { class: "reader__bar reader__bar--top" },
      h(
        "a",
        { class: "icon-btn", href: backHref, "aria-label": "Back" },
        icon("arrow-left"),
      ),
      h(
        "div",
        { class: "reader__heading" },
        h("strong", { class: "reader__book" }, book.title),
        chapterLabel,
      ),
      h(
        "div",
        { class: "reader__tools" },
        h(
          "button",
          {
            class: "icon-btn",
            type: "button",
            "aria-label": "Contents",
            onclick: () => toc.open(),
          },
          icon("list"),
        ),
        h(
          "button",
          {
            class: "icon-btn",
            type: "button",
            "aria-label": "Appearance",
            onclick: () => settings.open(),
          },
          icon("type"),
        ),
      ),
    ),
    scroller,
    h(
      "footer",
      { class: "reader__bar reader__bar--bottom" },
      progressBar,
      status,
    ),
  );

  const settings = createReaderSettings({ host: el });
  const toc = createToc({
    host: el,
    epub,
    getChapter: () => chapter,
    onSelect: (entry) => go(entry.chapter, { anchor: entry.anchor }),
  });

  // ----- Position & progress -----
  const maxScroll = () => scroller.scrollHeight - scroller.clientHeight;

  function applyOffset(offset) {
    const max = maxScroll();
    scroller.scrollTop = max > 0 ? offset * max : 0;
    lastScrollTop = scroller.scrollTop;
  }

  /** Holds the scroll position steady while content settles (images loading, font changes). */
  function beginRestore(offset) {
    restoring = true;
    restoreOffset = offset;
    applyOffset(offset);
    clearTimeout(restoreTimer);
    restoreTimer = setTimeout(endRestore, RESTORE_WINDOW_MS);
  }
  function endRestore() {
    restoring = false;
    clearTimeout(restoreTimer);
  }

  const saveNow = () => {
    if (destroyed || !started) return;
    const finishedNow = saveLocation(book.id, current);
    if (finishedNow) toast("You finished this book. Nice work!");
  };
  const scheduleSave = debounce(saveNow, SAVE_DELAY_MS);

  function updateStatus() {
    const percent = Math.round(current.percent);
    progressFill.style.width = `${current.percent}%`;
    progressBar.setAttribute("aria-valuenow", String(percent));
    status.textContent = `${percent}% · Section ${chapter + 1} of ${lastIndex + 1}`;
  }

  function updateChapterUi() {
    chapterLabel.textContent = epub.titleOf(chapter);
    prevButton.disabled = chapter === 0;
    nextLabel.textContent = chapter === lastIndex ? "Finish" : "Next";
  }

  const setChrome = (visible) => {
    el.dataset.chrome = visible ? "visible" : "hidden";
  };

  const onScroll = rafThrottle(() => {
    const top = scroller.scrollTop;
    const max = maxScroll();
    const offset =
      max > 0 ? clamp(top / max, 0, 1) : chapter === lastIndex ? 1 : 0;
    current = { chapter, offset, percent: epub.percentAt(chapter, offset) };
    updateStatus();
    if (restoring) return;
    const delta = top - lastScrollTop;
    lastScrollTop = top;
    if (Math.abs(delta) > 6) setChrome(delta < 0 || top < 60);
    scheduleSave();
  });

  // ----- Navigation -----
  async function showChapter(index, { offset = 0, anchor = "" } = {}) {
    const mine = ++token;
    el.dataset.loading = "true";
    try {
      const { node } = await epub.loadChapter(index);
      if (mine !== token || destroyed) return;
      article.replaceChildren(...node.childNodes);
      chapter = index;
      updateChapterUi();
      setChrome(true);
      scroller.scrollTop = 0;
      const target = anchor ? findAnchor(anchor) : null;
      if (target) {
        target.scrollIntoView({ block: "start" });
        lastScrollTop = scroller.scrollTop;
      } else if (offset > 0) {
        beginRestore(offset);
      }
      current = { chapter, offset: 0, percent: epub.percentAt(chapter, 0) };
      onScroll(); // derives the real offset/percent from the scroll position and schedules a save
    } catch (error) {
      console.error(error);
      article.replaceChildren(
        h(
          "p",
          { class: "prose__error" },
          "This section could not be displayed.",
        ),
      );
    } finally {
      if (mine === token) delete el.dataset.loading;
    }
  }

  const findAnchor = (anchor) =>
    article.querySelector(
      `#${CSS.escape(anchor)}, [name="${CSS.escape(anchor)}"]`,
    );

  function go(index, options) {
    if (index < 0 || index > lastIndex) return;
    saveNow();
    showChapter(index, options);
  }

  function onNext() {
    if (chapter < lastIndex) return go(chapter + 1);
    markFinished(book.id);
    toast("Marked as finished");
  }

  // ----- Events -----
  const onArticleClick = (event) => {
    const link = event.target.closest("a");
    if (link) {
      const { chapter: targetChapter, anchor } = link.dataset;
      if (link.getAttribute("href") === "#") event.preventDefault();
      if (targetChapter !== undefined) go(Number(targetChapter), { anchor });
      else if (anchor !== undefined)
        findAnchor(anchor)?.scrollIntoView({ block: "start" });
      return;
    }
    if (!window.getSelection()?.toString())
      setChrome(el.dataset.chrome !== "visible");
  };

  const onKeydown = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (
      event.target.closest("input, select, textarea") ||
      document.querySelector("dialog[open]")
    )
      return;
    if (event.key === "ArrowRight") go(chapter + 1);
    else if (event.key === "ArrowLeft") go(chapter - 1);
  };

  const userEvents = ["wheel", "touchstart", "pointerdown", "keydown"];
  const onUserInput = () => endRestore();
  // Images finishing after restore would shift the layout; re-apply the saved position.
  const onContentLoad = () => restoring && applyOffset(restoreOffset);

  scroller.addEventListener("scroll", onScroll, { passive: true });
  article.addEventListener("click", onArticleClick);
  article.addEventListener("load", onContentLoad, true);
  userEvents.forEach((type) =>
    scroller.addEventListener(type, onUserInput, { passive: true }),
  );
  document.addEventListener("keydown", onKeydown);

  // ----- Preferences, theme color and reading timer -----
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const originalThemeColor = themeMeta?.getAttribute("content");
  const syncThemeColor = () => {
    const color = el.isConnected
      ? getComputedStyle(el).getPropertyValue("--r-bg").trim()
      : "";
    if (color) themeMeta?.setAttribute("content", color);
  };
  let firstPrefs = true;
  const stopPrefs = subscribeSelect(
    (s) => s.reader,
    (prefs) => {
      applyReaderPrefs(el, prefs);
      syncThemeColor();
      if (!firstPrefs)
        requestAnimationFrame(() => beginRestore(current.offset));
      firstPrefs = false;
    },
  );

  const timer = startReadingTimer({
    onGoalReached: ({ streak }) =>
      toast(
        streak > 1
          ? `Daily goal reached. ${streak} day streak!`
          : "Daily goal reached. Streak started!",
      ),
  });

  return {
    el,
    start() {
      started = true;
      syncThemeColor();
      updateChapterUi();
      showChapter(chapter, { offset: saved.offset });
      scroller.focus({ preventScroll: true });
    },
    destroy() {
      scheduleSave.cancel();
      saveNow();
      destroyed = true;
      endRestore();
      timer.stop();
      stopPrefs();
      scroller.removeEventListener("scroll", onScroll);
      userEvents.forEach((type) =>
        scroller.removeEventListener(type, onUserInput),
      );
      document.removeEventListener("keydown", onKeydown);
      if (themeMeta && originalThemeColor)
        themeMeta.setAttribute("content", originalThemeColor);
      settings.destroy();
      toc.destroy();
      epub.destroy();
    },
  };
}
