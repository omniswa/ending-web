import { createRouter } from "./core/router.js";
import { h, icon } from "./core/dom.js";
import { createNav } from "./components/nav.js";
import { openDataDialog } from "./components/dataDialog.js";
import { emptyState } from "./components/status.js";
import "./state/store.js"; // hydrates persisted state before any page renders
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

router.start();
