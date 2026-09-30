export type AdBlockResult = "blocked" | "clear" | "unknown";

export function isAdGateExempt(path: string) {
  return /^\/(admin|auth|privacy|terms|contact)(\/|$)/.test(path);
}

export function classifyAdProbe(
  controlVisible: boolean,
  hidden: boolean[]
): AdBlockResult {
  if (!controlVisible || hidden.length < 2) return "unknown";
  return hidden.every(Boolean) ? "blocked" : "clear";
}

// Cosmetic-filter probes only: a failed ad request, lack of consent, an empty
// inventory slot, or a slow network must never lock out a normal visitor.
export async function detectAdBlock(): Promise<AdBlockResult> {
  if (document.visibilityState !== "visible" || !navigator.onLine)
    return "unknown";
  const control = document.createElement("div");
  const probes = [document.createElement("div"), document.createElement("div")];
  probes[0].className = "adsbox ad-banner adsbygoogle";
  probes[1].className = "ad-placement pub_300x250 text-ad";
  const nodes = [control, ...probes];
  for (const node of nodes) {
    node.setAttribute("aria-hidden", "true");
    node.style.cssText =
      "position:absolute;left:-10000px;top:-10000px;width:10px;height:10px;pointer-events:none;";
    document.body.appendChild(node);
  }
  const hidden = (node: HTMLElement) => {
    const style = getComputedStyle(node);
    return (
      !node.isConnected ||
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number(style.opacity) === 0 ||
      node.getBoundingClientRect().height === 0
    );
  };
  try {
    const sample = () => classifyAdProbe(!hidden(control), probes.map(hidden));
    await new Promise(resolve => setTimeout(resolve, 180));
    const first = sample();
    await new Promise(resolve => setTimeout(resolve, 180));
    if (document.visibilityState !== "visible" || !navigator.onLine)
      return "unknown";
    const second = sample();
    return first === "blocked" && second === "blocked"
      ? "blocked"
      : second === "blocked"
        ? "unknown"
        : second;
  } catch {
    return "unknown";
  } finally {
    nodes.forEach(node => node.remove());
  }
}
