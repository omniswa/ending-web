/**
 * Hash-based router with lazily imported pages (works on any static host).
 * A page module exports `mount({ root, params, router })` and returns an
 * object (or function) used to clean up when the user navigates away.
 */
import { APP_NAME } from "../config.js";
import { h } from "./dom.js";

function compile(path) {
  const keys = [];
  const source = path.replace(/:([a-zA-Z]+)/g, (_, key) => {
    keys.push(key);
    return "([^/]+)";
  });
  return { pattern: new RegExp(`^${source}/?$`), keys };
}

const currentPath = () => location.hash.replace(/^#/, "").split("?")[0] || "/";

function currentQuery() {
  const qIndex = location.hash.indexOf("?");
  if (qIndex === -1) return {};
  const search = location.hash.slice(qIndex + 1);
  return Object.fromEntries(new URLSearchParams(search));
}

export function createRouter({ outlet, routes, onNavigate, renderNotFound }) {
  const compiled = routes.map((route) => ({ route, ...compile(route.path) }));
  let active = null; // { route, hash, instance }
  let previous = null;
  let token = 0;

  function match(path) {
    for (const entry of compiled) {
      const found = entry.pattern.exec(path);
      if (found) {
        const params = Object.fromEntries(
          entry.keys.map((key, i) => [key, decodeURIComponent(found[i + 1])]),
        );
        return { route: entry.route, params };
      }
    }
    return null;
  }

  function teardown() {
    const instance = active?.instance;
    (typeof instance === "function" ? instance : instance?.unmount)?.call(
      instance,
    );
  }

  async function resolve() {
    const current = ++token;
    const found = match(currentPath());

    teardown();
    if (active) previous = { name: active.route?.name, hash: active.hash };
    active = {
      route: found?.route ?? null,
      hash: location.hash || "#/",
      instance: null,
    };

    if (found?.route?.name && found.route.name !== "reader") {
      try {
        sessionStorage.setItem("3nding:last_hash", location.hash || "#/");
      } catch {}
    }

    outlet.replaceChildren();
    const root = h("div", { class: "page" });
    outlet.append(root);

    if (!found) {
      document.body.dataset.route = "not-found";
      document.title = `Not found · ${APP_NAME}`;
      onNavigate?.(null);
      root.append(renderNotFound());
      return;
    }

    document.body.dataset.route = found.route.name;
    document.title = `${found.route.title} · ${APP_NAME}`;
    onNavigate?.(found.route);
    window.scrollTo(0, 0);

    try {
      const page = await found.route.load();
      const instance = await page.mount({
        root,
        params: found.params,
        query: currentQuery(),
        router: api,
      });
      if (current !== token) {
        (typeof instance === "function" ? instance : instance?.unmount)?.call(
          instance,
        );
        return;
      }
      active.instance = instance;
    } catch (error) {
      console.error(error);
      if (current === token) root.replaceChildren(renderNotFound(error));
    }
  }

  const api = {
    start() {
      window.addEventListener("hashchange", resolve);
      return resolve();
    },
    /** Re-mounts the current page (e.g. after restoring a backup). */
    reload: resolve,
    /** Where the reader's back button should go. */
    backHref: () =>
      previous && previous.name !== "reader" && previous.hash
        ? previous.hash
        : sessionStorage.getItem("3nding:last_hash") || "#/",
    /** Updates current hash in-place without triggering a reload, preserving back state. */
    replaceHash(newHash) {
      if (active) active.hash = newHash;
      try {
        sessionStorage.setItem("3nding:last_hash", newHash);
      } catch {}
      history.replaceState(null, "", newHash);
    },
    getQuery: currentQuery,
  };
  return api;
}
