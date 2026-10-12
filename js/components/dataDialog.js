import { APP_NAME } from "../config.js";
import { dateKey } from "../core/dates.js";
import { h, icon } from "../core/dom.js";
import { downloadBlob, plural } from "../core/utils.js";
import { createBackup, restoreBackup } from "../services/backup.js";
import { confirmDialog, createDialog } from "./dialog.js";
import { toast } from "./toast.js";

export function openDataDialog({ onRestored } = {}) {
  const dialog = createDialog({
    title: "Backup & restore",
    variant: "modal",
    onClose: () => dialog.destroy(),
  });
  const buttons = [];

  /** Runs an async task while disabling all buttons, reporting failures as toasts. */
  async function run(task) {
    buttons.forEach((button) => (button.disabled = true));
    try {
      await task();
    } catch (error) {
      console.error(error);
      toast(error.message || "Something went wrong.");
    } finally {
      buttons.forEach((button) => (button.disabled = false));
    }
  }

  const exportButton = (label, includeBooks, filePrefix) => {
    const button = h(
      "button",
      {
        class: "btn",
        type: "button",
        onclick: () =>
          run(async () => {
            const { blob, bookCount } = await createBackup({ includeBooks });
            downloadBlob(blob, `${filePrefix}-${dateKey()}.json`);
            toast(
              includeBooks
                ? `Exported data and ${plural(bookCount, "book")}`
                : "Exported progress and settings",
            );
          }),
      },
      icon("download", { size: 18 }),
      label,
    );
    buttons.push(button);
    return button;
  };

  const fileInput = h("input", {
    type: "file",
    accept: "application/json,.json",
    hidden: true,
    onchange: () => {
      const [file] = fileInput.files;
      fileInput.value = "";
      if (!file) return;
      run(async () => {
        const ok = await confirmDialog({
          title: "Replace current data?",
          message:
            "Your favorites, progress, streaks and reader settings will be replaced by the backup. This cannot be undone.",
          confirmLabel: "Restore backup",
          danger: true,
        });
        if (!ok) return;
        const books = await restoreBackup(file);
        toast(
          books
            ? `Backup restored with ${plural(books, "book")}`
            : "Backup restored",
        );
        dialog.close();
        onRestored?.();
      });
    },
  });
  const importButton = h(
    "button",
    { class: "btn", type: "button", onclick: () => fileInput.click() },
    icon("upload", { size: 18 }),
    "Choose backup file",
  );
  buttons.push(importButton);

  dialog.body.append(
    h(
      "section",
      { class: "setting" },
      h("h3", { class: "setting__title" }, "Export"),
      h(
        "p",
        { class: "dialog__text" },
        "Save favorites, progress, streaks and reader settings. Include your imported books to move your whole library to another device.",
      ),
      h(
        "div",
        { class: "stack" },
        exportButton("Progress and settings", false, "3nding-progress"),
        exportButton("Everything, including my books", true, "3nding-backup"),
      ),
    ),
    h(
      "section",
      { class: "setting" },
      h("h3", { class: "setting__title" }, "Import"),
      h("p", { class: "dialog__text" }, `Restore a file exported from ${APP_NAME}.`),
      importButton,
      fileInput,
    ),
  );
  dialog.open();
}
