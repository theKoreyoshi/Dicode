import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runtimePin, sha256, writeRuntimeManifest } from "./generate-runtime-manifest.mjs";

const [runtimeSourceArg, compiler = "ISCC.exe"] = process.argv.slice(2);
if (!runtimeSourceArg) {
  throw new Error(`Usage: npm run package:windows -- <Codex release tar.gz | verified runtime directory> [ISCC.exe]\nCodex archive: ${runtimePin.source}`);
}
if (process.platform !== "win32" || process.arch !== "x64") {
  throw new Error("The Windows package build requires a Windows x64 Node.js runtime.");
}

const root = fileURLToPath(new URL("../", import.meta.url));
const releaseDir = resolve(root, process.env.DICODE_RELEASE_DIR || "release");
const runtimeSource = resolve(runtimeSourceArg);
const runtimeSourceIsDirectory = existsSync(runtimeSource) && statSync(runtimeSource).isDirectory();
if (!runtimeSourceIsDirectory && await sha256(runtimeSource) !== runtimePin.archiveSha256) {
  throw new Error("Codex release archive SHA-256 does not match the pinned package.");
}

mkdirSync(releaseDir, { recursive: true });
const workDir = mkdtempSync(join(releaseDir, ".windows-package-"));
try {
  const payload = join(workDir, "payload");
  const runtimeDir = join(payload, "runtime", "codex");
  mkdirSync(runtimeDir, { recursive: true });
  if (runtimeSourceIsDirectory) {
    for (const name of Object.keys(runtimePin.files)) {
      const destination = join(runtimeDir, name);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(join(runtimeSource, name), destination);
    }
  } else {
    // Keep the official coding-runtime layout. The optional voice subtree is outside Dicode's scope.
    run("tar.exe", ["-xf", runtimeSource, "-C", runtimeDir, ...Object.keys(runtimePin.files)]);
  }
  const { version } = readJson(join(root, "package.json"));
  await writeRuntimeManifest(runtimeDir, version);

  run(process.execPath, [join(root, "tools", "build-exe.mjs")]);
  copyFileSync(join(releaseDir, "dicode.exe"), join(payload, "dicode.exe"));
  cpSync(join(root, "resources"), join(payload, "resources"), { recursive: true });
  const { nodeVersion } = readJson(join(releaseDir, "build-info.json"));
  stageLicenses(join(payload, "licenses"), nodeVersion);
  writeFileSync(join(payload, "README-portable.txt"), portableReadme(), "utf8");

  const zip = "Dicode-Portable-x64.zip";
  const setup = "Dicode-Setup-x64.exe";
  const portableSupport = ["runtime", "licenses", "resources", "README-portable.txt"];
  run("tar.exe", ["-a", "-cf", join(workDir, zip), "-C", payload, "dicode.exe", ...portableSupport]);
  run(compiler, ["/Qp", `/O${workDir}`, `/DPackageStage=${payload}`, join(root, "installer", "inno", "dicode.iss")]);

  // Keep the local executable runnable after removing the staging directory.
  for (const name of portableSupport) {
    cpSync(join(payload, name), join(releaseDir, name), { recursive: true });
  }
  for (const name of [zip, setup]) {
    const file = join(releaseDir, name);
    renameSync(join(workDir, name), file);
    console.log(`${await sha256(file)}  ${file}`);
  }
} finally {
  if (dirname(workDir) === releaseDir) rmSync(workDir, { recursive: true, force: true });
}

function run(program, args) {
  execFileSync(program, args, { cwd: root, stdio: "inherit", windowsHide: true });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function stageLicenses(directory, nodeVersion) {
  const codexRef = `rust-v${runtimePin.codexVersion}`;
  const raw = "https://raw.githubusercontent.com";
  download(`${raw}/nodejs/node/${nodeVersion}/LICENSE`, join(directory, `Node.js-${nodeVersion}-LICENSE.txt`));
  download(`${raw}/openai/codex/${codexRef}/LICENSE`, join(directory, "Codex", "LICENSE"));
  download(`${raw}/openai/codex/${codexRef}/NOTICE`, join(directory, "Codex", "NOTICE"));
  download(`${raw}/ratatui/ratatui/ratatui-v0.30.2/LICENSE`, join(directory, "Codex", "Ratatui-LICENSE"));
  for (const name of ["COPYING", "LICENSE-MIT", "UNLICENSE"]) {
    download(`${raw}/BurntSushi/ripgrep/15.2.0/${name}`, join(directory, "ripgrep-15.2.0", name));
  }

  const { packages } = readJson(join(root, "package-lock.json"));
  for (const [path, entry] of Object.entries(packages)) {
    if (entry.dev || entry.link || !path.startsWith("node_modules/")) continue;
    const dependency = join(root, path);
    if (!existsSync(dependency)) continue;
    const name = path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length).replace(/^@/, "").replaceAll("/", "-");
    for (const file of readdirSync(dependency, { withFileTypes: true })) {
      if (file.isFile() && /^(?:licen[cs]es?|copying|notice|third[-_ ]party[-_ ](?:licen[cs]es?|notices?))(?:\.[^.]+)?$/i.test(file.name)) {
        copyFileSync(join(dependency, file.name), join(directory, `${name}-${entry.version}-${file.name}.txt`));
      }
    }
  }
}

function download(url, file) {
  mkdirSync(dirname(file), { recursive: true });
  run("curl.exe", ["--fail", "--silent", "--show-error", "--location", "--retry", "2", "--retry-all-errors", "--max-time", "60", url, "--output", file]);
}

function portableReadme() {
  return [
    "Dicode for Windows x64",
    "",
    "This package includes Node.js and the official Codex coding runtime.",
    "Keep dicode.exe beside its runtime directory when moving the application.",
    "",
    "Open PowerShell or Windows Terminal in this directory to run these commands.",
    "  .\\dicode.exe doctor",
    "  .\\dicode.exe login",
    "  .\\dicode.exe --cwd 'C:\\path\\to\\your\\project'",
    "",
    "Run login when doctor reports that Codex needs sign-in.",
    "Ctrl+P opens commands. Esc interrupts a task. Ctrl+Q closes Dicode.",
    "The package includes the Codex license and third-party notices under licenses.",
    "It includes the coding runtime. Optional Codex voice files are separate.",
    "",
  ].join("\r\n");
}
