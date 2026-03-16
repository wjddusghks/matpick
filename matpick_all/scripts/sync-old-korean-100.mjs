import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const importScriptPath = path.join(projectRoot, "scripts", "import-old-korean-100.ps1");
const geocodeScriptPath = path.join(projectRoot, "scripts", "geocode-old-korean-100.mjs");

function runCommand(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: "inherit",
      shell: false,
      env: process.env,
    });

    child.on("error", (error) => {
      reject(new Error(`${label} failed to start: ${error.message}`));
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${label} exited with code ${code ?? "unknown"}`));
    });
  });
}

function hasGeocodeCredentials() {
  return Boolean(
    (process.env.NAVER_MAP_CLIENT_ID || process.env.VITE_NAVER_MAP_CLIENT_ID) &&
      process.env.NAVER_MAP_CLIENT_SECRET
  );
}

async function runImport() {
  await runCommand(
    "powershell",
    ["-ExecutionPolicy", "Bypass", "-File", importScriptPath],
    "old-korean-100 import"
  );
}

async function runGeocode() {
  await runCommand("node", [geocodeScriptPath], "old-korean-100 geocode");
}

async function main() {
  console.log("1/3 Importing Excel rows into generated dataset...");
  await runImport();

  if (!hasGeocodeCredentials()) {
    console.warn(
      "Geocode credentials were not found. Skipping automatic coordinate resolution."
    );
    console.warn(
      "Set NAVER_MAP_CLIENT_SECRET and NAVER_MAP_CLIENT_ID (or VITE_NAVER_MAP_CLIENT_ID) to auto-fill coordinates."
    );
    return;
  }

  console.log("2/3 Resolving missing coordinates from address data...");
  await runGeocode();

  console.log("3/3 Rebuilding generated dataset with persisted coordinates...");
  await runImport();
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
