/** Route table. Pages are imported lazily so the first load only pays for what it shows. */
export const routes = [
  {
    name: "home",
    path: "/",
    title: "Library",
    nav: { label: "Home", icon: "home", href: "#/" },
    load: () => import("./pages/home.js"),
  },
  {
    name: "favorites",
    path: "/favorites",
    title: "Favorites",
    nav: { label: "Favorites", icon: "heart", href: "#/favorites" },
    load: () => import("./pages/favorites.js"),
  },
  {
    name: "highlights",
    path: "/highlights",
    title: "Highlights",
    nav: { label: "Highlights", icon: "quote", href: "#/highlights" },
    load: () => import("./pages/highlights.js"),
  },
  {
    name: "library",
    path: "/library",
    title: "My books",
    nav: { label: "My books", icon: "library", href: "#/library" },
    load: () => import("./pages/library.js"),
  },
  {
    name: "reader",
    path: "/read/:id",
    title: "Reading",
    load: () => import("./pages/reader.js"),
  },
  {
    name: "about",
    path: "/about",
    title: "About",
    load: () => import("./pages/about.js"),
  },
  {
    name: "terms",
    path: "/terms",
    title: "Terms",
    load: () => import("./pages/terms.js"),
  },
  {
    name: "privacy",
    path: "/privacy",
    title: "Privacy",
    load: () => import("./pages/privacy.js"),
  },
];
