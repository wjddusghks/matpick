const NAVER_MAPS_CLIENT_ID = import.meta.env.VITE_NAVER_MAP_CLIENT_ID?.trim() ?? "";
const NAVER_MAPS_SCRIPT_ID = "matpick-naver-maps-sdk";
const NAVER_MAPS_SCRIPT_SRC = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${encodeURIComponent(
  NAVER_MAPS_CLIENT_ID
)}&submodules=geocoder`;

function hasWindow() {
  return typeof window !== "undefined";
}

export function isNaverMapsReady(): boolean {
  return (
    hasWindow() &&
    typeof (window as Window & { naver?: typeof naver }).naver !== "undefined" &&
    (window as Window & { naver?: typeof naver }).naver?.maps != null &&
    typeof (window as Window & { naver?: typeof naver }).naver?.maps.Map === "function"
  );
}

function waitForNaverMaps(timeout = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isNaverMapsReady()) {
      resolve();
      return;
    }

    const start = Date.now();
    const interval = window.setInterval(() => {
      if (isNaverMapsReady()) {
        window.clearInterval(interval);
        resolve();
      } else if (Date.now() - start > timeout) {
        window.clearInterval(interval);
        reject(new Error("Naver Maps SDK load timed out."));
      }
    }, 100);
  });
}

export function ensureNaverMapsSdk(timeout = 15000): Promise<void> {
  if (!NAVER_MAPS_CLIENT_ID) {
    return Promise.reject(new Error("VITE_NAVER_MAP_CLIENT_ID is missing."));
  }

  if (isNaverMapsReady()) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const handleReady = () => {
      waitForNaverMaps(timeout).then(resolve).catch(reject);
    };

    const handleError = () => {
      reject(
        new Error(
          "Failed to load the Naver Maps SDK. Check the client ID and allowed domains."
        )
      );
    };

    const existingScript = document.getElementById(
      NAVER_MAPS_SCRIPT_ID
    ) as HTMLScriptElement | null;

    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        handleReady();
        return;
      }

      existingScript.addEventListener("load", handleReady, { once: true });
      existingScript.addEventListener("error", handleError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = NAVER_MAPS_SCRIPT_ID;
    script.src = NAVER_MAPS_SCRIPT_SRC;
    script.async = true;
    script.dataset.loaded = "false";
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        handleReady();
      },
      { once: true }
    );
    script.addEventListener("error", handleError, { once: true });
    document.head.appendChild(script);
  });
}

export function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const query = address.trim();
  if (!query) {
    return Promise.resolve(null);
  }

  return ensureNaverMapsSdk().then(
    () =>
      new Promise((resolve, reject) => {
        naver.maps.Service.geocode({ query }, (status, response) => {
          if (status !== naver.maps.Service.Status.OK) {
            resolve(null);
            return;
          }

          const firstResult = response?.v2?.addresses?.[0];
          if (!firstResult) {
            resolve(null);
            return;
          }

          const lat = Number(firstResult.y);
          const lng = Number(firstResult.x);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            reject(new Error("Geocoder returned invalid coordinates."));
            return;
          }

          resolve({ lat, lng });
        });
      })
  );
}
