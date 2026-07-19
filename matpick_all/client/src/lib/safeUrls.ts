export function toSafeHttpUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  try {
    const url = new URL(value.trim());
    const localHttp =
      url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if ((url.protocol !== "https:" && !localHttp) || url.username || url.password) {
      return "";
    }
    return url.href;
  } catch {
    return "";
  }
}

export function toSafeImageSource(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  const source = value.trim();
  if (source.startsWith("/") && !source.startsWith("//")) {
    return source;
  }

  if (/^data:image\/(?:jpeg|png|webp);base64,/i.test(source)) {
    return source;
  }

  if (source.startsWith("blob:")) {
    return source;
  }

  const url = toSafeHttpUrl(source);
  return url.startsWith("https://") ? url : "";
}
