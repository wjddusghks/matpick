const PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places";

function getApiKey() {
  return String(process.env.GOOGLE_PLACES_API_KEY || "").trim();
}

async function requestJson(url, apiKey, fieldMask) {
  const response = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      ...(fieldMask ? { "X-Goog-FieldMask": fieldMask } : {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Places request failed: ${response.status} ${body}`);
  }

  return response.json();
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return res.status(500).json({ error: "GOOGLE_PLACES_API_KEY is not configured" });
  }

  const placeId = String(req.query?.placeId || "").trim();
  if (!placeId) {
    return res.status(400).json({ error: "placeId is required" });
  }

  try {
    const place = await requestJson(
      `${PLACE_DETAILS_URL}/${encodeURIComponent(placeId)}`,
      apiKey,
      "id,photos"
    );

    const photo = Array.isArray(place?.photos) ? place.photos[0] : null;
    if (!photo?.name) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ imageUrl: "", source: "google", attributions: [] });
    }

    const media = await requestJson(
      `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=1200&skipHttpRedirect=true`,
      apiKey
    );

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      imageUrl: typeof media?.photoUri === "string" ? media.photoUri : "",
      source: "google",
      attributions: Array.isArray(photo.authorAttributions) ? photo.authorAttributions : [],
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load Google place photo",
    });
  }
};
