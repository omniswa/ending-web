import { createRouter } from "./core/router.js";
import { h, icon } from "./core/dom.js";
import { createNav } from "./components/nav.js";
import { createDrawer } from "./components/drawer.js";
import { openDataDialog } from "./components/dataDialog.js";
import { emptyState } from "./components/status.js";
import { toast } from "./components/toast.js";
import { onPersistError, storeReady } from "./state/store.js";
import { routes } from "./routes.js";

const nav = createNav(routes, {
  top: document.getElementById("nav-top"),
  tabs: document.getElementById("nav-tabs"),
});

const router = createRouter({
  outlet: document.getElementById("main"),
  routes,
  onNavigate: (route) => nav.setActive(route?.name),
  renderNotFound: (error) =>
    h(
      "div",
      { class: "container" },
      emptyState({
        iconName: "alert",
        title: error ? "Something went wrong" : "Page not found",
        text: error
          ? error.message
          : "The page you are looking for does not exist.",
        action: h(
          "a",
          { class: "btn btn--primary", href: "#/" },
          "Back to library",
        ),
      }),
    ),
});

const dataButton = document.getElementById("data-btn");
dataButton.prepend(icon("database", { size: 18 }));
dataButton.addEventListener("click", () =>
  openDataDialog({ onRestored: () => router.reload() }),
);

// Drawer: mobile-only secondary nav (About, Terms, Privacy)
const drawer = createDrawer();
document.querySelector(".app-header__inner").append(drawer.trigger);

// Saving can fail (storage full, private browsing). Say so, but not on every attempt.
const SAVE_WARNING_COOLDOWN_MS = 30_000;
let lastSaveWarning = 0;
onPersistError(() => {
  const now = Date.now();
  if (now - lastSaveWarning < SAVE_WARNING_COOLDOWN_MS) return;
  lastSaveWarning = now;
  toast("Your changes could not be saved. Browser storage may be full or blocked.");
});

// Start once highlights are loaded so pages never flash an empty state.
storeReady.then(() => router.start());
