import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build, Platform } from "electron-builder";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const packageJson = JSON.parse(await readFile(resolve(rootDir, "package.json"), "utf8"));

const requiredSigningEnv = [
  "CSC_LINK",
  "CSC_KEY_PASSWORD",
  "APPLE_API_KEY",
  "APPLE_API_KEY_ID",
  "APPLE_API_ISSUER",
];

const hasSigningSecrets = requiredSigningEnv.every((name) => Boolean(process.env[name]));
const config = structuredClone(packageJson.build);

if (!hasSigningSecrets) {
  const missing = requiredSigningEnv.filter((name) => !process.env[name]);

  console.warn(
    `macOS signing secrets missing (${missing.join(", ")}). Building an unsigned local-test artifact.`,
  );
  console.warn(
    "Unsigned macOS downloads can trigger Gatekeeper's damaged-app warning after browser download.",
  );

  process.env.CSC_IDENTITY_AUTO_DISCOVERY = "false";
  for (const name of requiredSigningEnv) {
    delete process.env[name];
  }

  config.mac = {
    ...config.mac,
    identity: null,
    hardenedRuntime: false,
    gatekeeperAssess: false,
    notarize: false,
    entitlements: undefined,
    entitlementsInherit: undefined,
    artifactName: "${productName}-${version}-${os}-${arch}-unsigned.${ext}",
  };
} else {
  console.log("macOS signing and notarization secrets detected. Building a Gatekeeper-safe release.");

  config.mac = {
    ...config.mac,
    identity: undefined,
    hardenedRuntime: true,
    gatekeeperAssess: false,
    notarize: true,
    entitlements: "build/entitlements.mac.plist",
    entitlementsInherit: "build/entitlements.mac.inherit.plist",
  };
}

await build({
  projectDir: rootDir,
  targets: Platform.MAC.createTarget(["dmg", "zip"]),
  publish: "never",
  config,
});
