import { getNaverMapsScriptUrl } from "./naverMapsConfig";
const NAVER_MAPS_SCRIPT_SRC = getNaverMapsScriptUrl(import.meta.env);
const NAVER_MAPS_SCRIPT_ID = "matpick-naver-maps-sdk";
export const NAVER_MAPS_AUTH_FAILURE_EVENT = "matpick:naver-maps-auth-failure";
let authenticationFailed = false;
let authenticationHandlerInstalled = false;

function installAuthenticationHandler() {
  if (authenticationHandlerInstalled) return;
  const mapsWindow = window as Window & { navermap_authFailure?: () => void };
  const previousHandler = mapsWindow.navermap_authFailure;
  mapsWindow.navermap_authFailure = () => {
    authenticationFailed = true;
    window.dispatchEvent(new Event(NAVER_MAPS_AUTH_FAILURE_EVENT));
    previousHandler?.();
  };
  authenticationHandlerInstalled = true;
}

function hasWindow() {
  return typeof window !== "undefined";
}

export function isNaverMapsReady(): boolean {
  return (
    hasWindow() &&
    !authenticationFailed &&
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
      } else if (authenticationFailed) {
        window.clearInterval(interval);
        reject(new Error("Naver Maps authentication failed."));
      } else if (Date.now() - start > timeout) {
        window.clearInterval(interval);
        reject(new Error("Naver Maps SDK load timed out."));
      }
    }, 100);
  });
}

export function ensureNaverMapsSdk(timeout = 15000): Promise<void> {
  if (!hasWindow()) return Promise.reject(new Error("A browser is required."));
  installAuthenticationHandler();
  if (authenticationFailed) {
    return Promise.reject(new Error("Naver Maps authentication failed."));
  }
  if (!NAVER_MAPS_SCRIPT_SRC) {
    return Promise.reject(new Error("VITE_NAVER_MAP_KEY_ID is missing (legacy environment name VITE_NAVER_MAP_CLIENT_ID is also supported)."));
  }

  if (isNaverMapsReady()) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    // Also bound the script download itself; previously only SDK initialization timed out.
    const deadline = window.setTimeout(() => reject(new Error("Naver Maps SDK load timed out.")), timeout);
    const finishReady = () => { window.clearTimeout(deadline); resolve(); };
    const finishError = (error: Error) => { window.clearTimeout(deadline); reject(error); };
    const handleReady = () => {
      waitForNaverMaps(timeout).then(finishReady).catch(finishError);
    };

    const handleError = () => {
      finishError(
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
