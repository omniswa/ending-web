/**
 * Strips anything executable or style-hijacking from book markup before it is
 * attached to the page. The reader applies its own typography, so author CSS,
 * classes and inline styles are dropped on purpose.
 */
const REMOVED_ELEMENTS = [
  "script",
  "style",
  "link",
  "meta",
  "base",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "noscript",
  "template",
  "audio",
  "video",
  "source",
  "track",
  "canvas",
  "foreignObject",
  "foreignobject",
  // SVG animation can rewrite href/xlink:href to a javascript: URL after
  // sanitizing; <use> can pull in external documents.
  "animate",
  "animateMotion",
  "animateTransform",
  "set",
  "use",
].join(",");

const REMOVED_ATTRIBUTES = new Set([
  "style",
  "class",
  "srcset",
  "contenteditable",
  "autofocus",
  "target",
  "ping", // sends a request when a link is followed
  "background", // legacy attribute that loads a remote image (table, body)
  "poster",
]);
const URL_ATTRIBUTES = new Set([
  "href",
  "src",
  "xlink:href",
  "action",
  "formaction",
]);
const UNSAFE_URL = /^\s*(?:javascript|vbscript|data:text\/html)/i;

export function sanitize(root) {
  root.querySelectorAll(REMOVED_ELEMENTS).forEach((node) => node.remove());
  for (const element of root.querySelectorAll("*")) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || REMOVED_ATTRIBUTES.has(name))
        element.removeAttribute(attribute.name);
      else if (URL_ATTRIBUTES.has(name) && UNSAFE_URL.test(attribute.value))
        element.removeAttribute(attribute.name);
    }
  }
}
