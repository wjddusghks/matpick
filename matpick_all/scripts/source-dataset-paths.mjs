import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const projectRoot = path.resolve(__dirname, "..");
export const workspaceRoot = path.resolve(projectRoot, "..");
export const sourceDataRoot = path.join(workspaceRoot, "source-data");
export const generatedDataRoot = path.join(projectRoot, "client", "src", "data", "generated");
export const sourceCoverRoot = path.join(projectRoot, "client", "public", "source-covers");

export function resolveSourceDatasetPaths(datasetId) {
  return {
    datasetId,
    sourceDir: path.join(sourceDataRoot, datasetId),
    outputJson: path.join(generatedDataRoot, `${datasetId}.generated.json`),
    coverOutput: path.join(sourceCoverRoot, `${datasetId}.jpg`),
    coverPublicPath: `/source-covers/${datasetId}.jpg`,
    coordinatesPath: path.join(sourceDataRoot, datasetId, "coordinates.json"),
  };
}
