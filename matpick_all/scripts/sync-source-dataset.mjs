import { spawn } from "node:child_process";
import path from "node:path";
import { projectRoot, resolveSourceDatasetPaths } from "./source-dataset-paths.mjs";

const importScriptPath = path.join(projectRoot, "scripts", "import-old-korean-100.ps1");
const geocodeScriptPath = path.join(projectRoot, "scripts", "geocode-source-dataset.mjs");

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

async function runImport(datasetId) {
  const paths = resolveSourceDatasetPaths(datasetId);
  await runCommand(
    "powershell",
    [
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      importScriptPath,
      "-SourceDir",
      paths.sourceDir,
      "-OutputJson",
      paths.outputJson,
      "-CoverOutput",
      paths.coverOutput,
      "-CoordinateOverrides",
      paths.coordinatesPath,
      "-CoverPublicPath",
      paths.coverPublicPath,
    ],
    `${datasetId} import`
  );
}

async function runGeocode(datasetId) {
  await runCommand("node", [geocodeScriptPath, datasetId], `${datasetId} geocode`);
}

async function main() {
  const datasetId = process.argv[2]?.trim();
  if (!datasetId) {
    throw new Error("Usage: node scripts/sync-source-dataset.mjs <dataset-id>");
  }

  console.log(`1/3 Importing ${datasetId} Excel rows into generated dataset...`);
  await runImport(datasetId);

  if (!hasGeocodeCredentials()) {
    console.warn(
      `[${datasetId}] Geocode credentials were not found. Skipping automatic coordinate resolution.`
    );
    console.warn(
      "Set NAVER_MAP_CLIENT_SECRET and NAVER_MAP_CLIENT_ID (or VITE_NAVER_MAP_CLIENT_ID) to auto-fill coordinates."
    );
    return;
  }

  console.log(`2/3 Resolving missing coordinates for ${datasetId} from address data...`);
  await runGeocode(datasetId);

  console.log(`3/3 Rebuilding ${datasetId} generated dataset with persisted coordinates...`);
  await runImport(datasetId);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
