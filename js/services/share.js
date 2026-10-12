import { toast } from "../components/toast.js";

/** Shares a book via the native share sheet, falling back to copying a link. */
export async function shareBook(book) {
  const link =
    book.source === "catalog"
      ? new URL(`#/read/${encodeURIComponent(book.id)}`, location.href).href
      : location.href.split("#")[0];
  const text = `${book.title} by ${book.author}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: book.title, text, url: link });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${link}`);
    toast("Link copied to clipboard");
  } catch {
    toast("Sharing is not available in this browser");
  }
}
