import { READER_OPTIONS } from "../config.js";
import { h, icon } from "../core/dom.js";
import {
  canShareFiles,
  downloadQuoteCard,
  renderQuoteCard,
  shareQuoteCard,
} from "../services/quoteCard.js";
import { createDialog } from "./dialog.js";
import { createSegmented } from "./segmented.js";
import { toast } from "./toast.js";

/**
 * Opens a preview of the quote card for `highlight` with a theme picker and
 * share / download actions. `host` decides which element the dialog inherits
 * its colors from (the reader passes its own root).
 */
export function openQuoteCard(highlight, { host = document.body, theme = "paper" } = {}) {
  let current = theme;
  let url = null;
  let token = 0;

  const image = h("img", {
    class: "quote-preview__img",
    alt: `Quote card preview: ${highlight.text}`,
    width: 1080,
    height: 1350,
  });
  const preview = h("div", { class: "quote-preview" }, image);

  const dialog = createDialog({
    title: "Quote card",
    variant: "modal",
    host,
    onClose: () => {
      token++;
      if (url) URL.revokeObjectURL(url);
      url = null;
      dialog.destroy();
    },
  });

  async function draw() {
    const mine = ++token;
    preview.dataset.loading = "true";
    try {
      const blob = await renderQuoteCard(highlight, current);
      if (mine !== token) return;
      const next = URL.createObjectURL(blob);
      if (url) URL.revokeObjectURL(url);
      url = next;
      image.src = url;
    } catch (error) {
      console.error(error);
      if (mine === token) toast("The quote card could not be created.");
    } finally {
      if (mine === token) delete preview.dataset.loading;
    }
  }

  const themes = createSegmented({
    label: "Card theme",
    options: READER_OPTIONS.theme,
    variant: "theme",
    renderOption: (option) =>
      h(
        "span",
        { class: "segmented__text", dataset: { theme: option.value } },
        h("span", { class: "swatch" }),
        option.label,
      ),
    onChange: (value) => {
      current = value;
      draw();
    },
  });
  themes.set(current);

  const buttons = [];
  const action = (button, task) => {
    buttons.push(button);
    button.addEventListener("click", async () => {
      buttons.forEach((b) => (b.disabled = true));
      try {
        await task();
      } catch (error) {
        console.error(error);
        toast("That did not work. Please try again.");
      } finally {
        buttons.forEach((b) => (b.disabled = false));
      }
    });
    return button;
  };

  const download = action(
    h(
      "button",
      { class: canShareFiles() ? "btn" : "btn btn--primary", type: "button" },
      icon("download", { size: 18 }),
      "Download",
    ),
    async () => {
      await downloadQuoteCard(highlight, current);
      toast("Quote card saved");
    },
  );
  dialog.footer.append(download);
  if (canShareFiles()) {
    dialog.footer.append(
      action(
        h(
          "button",
          { class: "btn btn--primary", type: "button" },
          icon("share", { size: 18 }),
          "Share",
        ),
        async () => {
          const result = await shareQuoteCard(highlight, current);
          if (result === "downloaded") toast("Quote card saved");
        },
      ),
    );
  }

  dialog.body.append(preview, themes.el);
  dialog.open();
  draw();
}
