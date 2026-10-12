import { h, icon } from "../core/dom.js";

/** Renders the primary navigation twice: a top bar (desktop) and a tab bar (mobile). */
export function createNav(routes, { top, tabs }) {
  const items = routes.filter((route) => route.nav);
  const links = [];

  const build = (container, linkClass) => {
    for (const route of items) {
      const link = h(
        "a",
        {
          class: linkClass,
          href: route.nav.href,
          dataset: { route: route.name },
        },
        icon(route.nav.icon, { size: 20 }),
        h("span", {}, route.nav.label),
      );
      links.push(link);
      container.append(link);
    }
  };
  build(top, "nav__link");
  build(tabs, "tabbar__link");

  return {
    setActive(name) {
      for (const link of links) {
        if (link.dataset.route === name)
          link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      }
    },
  };
}
