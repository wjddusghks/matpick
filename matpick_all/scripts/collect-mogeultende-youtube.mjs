import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(projectRoot, "..");
const outputPath = path.join(
  workspaceRoot,
  "source-data",
  "mogeultende",
  "youtube-videos.json"
);
const channelVideosUrl = "https://www.youtube.com/@sungsikyung/videos";
const headers = {
  "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.7,en;q=0.6",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

function extractJsonObject(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error(`Marker not found: ${marker}`);
  }

  const start = marker.endsWith("{")
    ? markerIndex + marker.length - 1
    : source.indexOf("{", markerIndex + marker.length);
  if (start < 0) {
    throw new Error(`JSON object not found after marker: ${marker}`);
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(source.slice(start, index + 1));
      }
    }
  }

  throw new Error(`Unterminated JSON object after marker: ${marker}`);
}

function getText(value) {
  if (!value) return "";
  if (typeof value.simpleText === "string") return value.simpleText.trim();
  if (Array.isArray(value.runs)) {
    return value.runs.map((run) => run.text ?? "").join("").trim();
  }
  return "";
}

function normalizeThumbnailUrl(url) {
  if (!url) return "";
  return url.startsWith("//") ? `https:${url}` : url;
}

function collectRenderers(root) {
  const videos = [];
  const continuationTokens = [];
  const seenObjects = new Set();

  function visit(value) {
    if (!value || typeof value !== "object" || seenObjects.has(value)) return;
    seenObjects.add(value);

    if (value.videoRenderer?.videoId) {
      const renderer = value.videoRenderer;
      const thumbnails = renderer.thumbnail?.thumbnails ?? [];
      videos.push({
        videoId: renderer.videoId,
        title: getText(renderer.title),
        publishedText: getText(renderer.publishedTimeText),
        duration: getText(renderer.lengthText),
        viewCountText: getText(renderer.viewCountText),
        thumbnailUrl: normalizeThumbnailUrl(thumbnails.at(-1)?.url ?? ""),
      });
    }

    if (
      value.lockupViewModel?.contentId &&
      value.lockupViewModel?.contentType === "LOCKUP_CONTENT_TYPE_VIDEO"
    ) {
      const renderer = value.lockupViewModel;
      const thumbnails =
        renderer.contentImage?.thumbnailViewModel?.image?.sources ?? [];
      const metadataParts =
        renderer.metadata?.lockupMetadataViewModel?.metadata
          ?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts ?? [];
      const badges =
        renderer.contentImage?.thumbnailViewModel?.overlays?.flatMap(
          (overlay) =>
            overlay.thumbnailBottomOverlayViewModel?.badges ?? []
        ) ?? [];
      const durationBadge = badges.find(
        (badge) => badge.thumbnailBadgeViewModel?.text
      );

      videos.push({
        videoId: renderer.contentId,
        title: renderer.metadata?.lockupMetadataViewModel?.title?.content?.trim() ?? "",
        publishedText: metadataParts.at(-1)?.text?.content?.trim() ?? "",
        duration: durationBadge?.thumbnailBadgeViewModel?.text?.trim() ?? "",
        viewCountText: metadataParts[0]?.text?.content?.trim() ?? "",
        thumbnailUrl: normalizeThumbnailUrl(thumbnails.at(-1)?.url ?? ""),
      });
    }

    const continuationToken =
      value.continuationCommand?.token ??
      value.continuationEndpoint?.continuationCommand?.token ??
      value.nextContinuationData?.continuation;
    if (continuationToken) {
      continuationTokens.push(continuationToken);
    }

    Object.values(value).forEach(visit);
  }

  visit(root);
  return { videos, continuationTokens };
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers ?? {}) },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
  return response.text();
}

async function collectChannelVideos() {
  const html = await fetchText(channelVideosUrl);
  const initialData = extractJsonObject(html, "var ytInitialData =");
  const config = extractJsonObject(html, "ytcfg.set({");
  const apiKey = config.INNERTUBE_API_KEY;
  const context = config.INNERTUBE_CONTEXT;

  if (!apiKey || !context) {
    throw new Error("YouTube InnerTube configuration was not found.");
  }

  const videosById = new Map();
  const visitedTokens = new Set();
  let { videos, continuationTokens } = collectRenderers(initialData);
  videos.forEach((video) => videosById.set(video.videoId, video));
  let continuation = continuationTokens.sort(
    (left, right) => right.length - left.length
  )[0];
  let page = 1;

  while (continuation && !visitedTokens.has(continuation) && page <= 100) {
    visitedTokens.add(continuation);
    const responseText = await fetchText(
      `https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ context, continuation }),
      }
    );
    const responseData = JSON.parse(responseText);
    ({ videos, continuationTokens } = collectRenderers(responseData));
    videos.forEach((video) => videosById.set(video.videoId, video));
    continuation = continuationTokens.sort(
      (left, right) => right.length - left.length
    )[0];
    page += 1;
  }

  return Array.from(videosById.values());
}

function isMogeultendeVideo(video) {
  return /먹을\s*텐데/.test(video.title);
}

async function mapConcurrent(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker)
  );
  return results;
}

function extractPlayerResponse(html) {
  for (const marker of [
    "var ytInitialPlayerResponse =",
    "ytInitialPlayerResponse =",
  ]) {
    try {
      return extractJsonObject(html, marker);
    } catch {
      // Try the next known YouTube assignment form.
    }
  }
  throw new Error("ytInitialPlayerResponse was not found.");
}

async function enrichVideoDetails(video, index, total) {
  try {
    const html = await fetchText(video.videoUrl);
    const playerResponse = extractPlayerResponse(html);
    const details = playerResponse.videoDetails ?? {};
    const microformat = playerResponse.microformat?.playerMicroformatRenderer ?? {};

    if ((index + 1) % 25 === 0 || index + 1 === total) {
      console.log(`Fetched video details ${index + 1}/${total}`);
    }

    return {
      ...video,
      title: details.title?.trim() || video.title,
      uploadDate: microformat.uploadDate ?? microformat.publishDate ?? "",
      publishDate: microformat.publishDate ?? microformat.uploadDate ?? "",
      description: details.shortDescription?.trim() ?? "",
      durationSeconds: Number(details.lengthSeconds) || null,
      viewCount: Number(details.viewCount) || null,
      detailError: null,
    };
  } catch (error) {
    return {
      ...video,
      uploadDate: "",
      publishDate: "",
      description: "",
      durationSeconds: null,
      viewCount: null,
      detailError: error.message,
    };
  }
}

async function main() {
  const allVideos = await collectChannelVideos();
  const listedVideos = allVideos
    .filter(isMogeultendeVideo)
    .map((video) => ({
      ...video,
      videoUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
    }));
  const videos = await mapConcurrent(listedVideos, 6, (video, index) =>
    enrichVideoDetails(video, index, listedVideos.length)
  );
  const output = {
    source: channelVideosUrl,
    collectedAt: new Date().toISOString(),
    channelVideoCount: allVideos.length,
    videoCount: videos.length,
    detailErrorCount: videos.filter((video) => video.detailError).length,
    videos,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Collected ${videos.length} 먹을텐데 videos from ${allVideos.length} channel videos.`);
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
