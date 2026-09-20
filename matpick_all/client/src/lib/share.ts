/** Copy still works when Web Share or the async Clipboard API is unavailable. */
export async function copyShareLink(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* Fall back to the browser's selection-based copy. */
  }
  if (typeof document === "undefined") return false;
  const activeElement = document.activeElement;
  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  field.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
  // Keep the fallback inside a modal's focus trap when one is open.
  (document.querySelector('[role="dialog"]') ?? document.body).appendChild(
    field
  );
  try {
    field.focus();
    field.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
    if (activeElement instanceof HTMLElement) activeElement.focus();
  }
}

export async function shareNatively(
  data: ShareData
): Promise<"shared" | "cancelled" | "unavailable"> {
  if (typeof navigator === "undefined" || !navigator.share)
    return "unavailable";
  try {
    if (navigator.canShare && !navigator.canShare(data)) return "unavailable";
    await navigator.share(data);
    return "shared";
  } catch (error) {
    return error instanceof Error && error.name === "AbortError"
      ? "cancelled"
      : "unavailable";
  }
}
