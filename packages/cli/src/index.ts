import { render } from "ink";
import { createElement } from "react";
import { App } from "@dicode/tui";
import { PRODUCT_NAME, PRODUCT_VERSION } from "@dicode/shared";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { HELP_TEXT, parseArgs } from "./router.js";
import {
  runDoctor,
  renderDoctorReport,
  checkEnvironment,
  checkDicodeVersion,
  checkBundledRuntime,
  checkUserData,
  checkAppServer,
  checkSqlite,
  pathDiagnostic,
  readManifest,
  verifyIntegrity,
  sha256File,
} from "./doctor.js";

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(argv);

  if (options.help) {
    process.stdout.write(HELP_TEXT);
    return;
  }
  if (options.version) {
    process.stdout.write(`${PRODUCT_NAME} ${PRODUCT_VERSION}\n`);
    return;
  }
  if (options.doctor) {
    const checks = await runDoctor();
    process.stdout.write(`${renderDoctorReport(checks)}\n`);
    return;
  }
  if (options.paths) {
    process.stdout.write(`${JSON.stringify(pathDiagnostic(), null, 2)}\n`);
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    process.stderr.write("Dicode requires an interactive terminal. Run dicode in a terminal or use dicode --help.\n");
    process.exitCode = 1;
    return;
  }

  render(createElement(App, { cwd: options.cwd, resume: options.resume }), { exitOnCtrlC: false });
}

export { parseArgs, HELP_TEXT };
export {
  runDoctor,
  renderDoctorReport,
  checkEnvironment,
  checkDicodeVersion,
  checkBundledRuntime,
  checkUserData,
  checkAppServer,
  checkSqlite,
  readManifest,
  verifyIntegrity,
  sha256File,
  pathDiagnostic,
};

const entryPath = process.argv[1] ? resolve(process.argv[1]) : "";
const thisPath = fileURLToPath(import.meta.url);
if (entryPath === thisPath) {
  void main();
}
