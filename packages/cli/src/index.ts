import { render } from "ink";
import { createElement } from "react";
import { App } from "@dicode/tui";
import { PRODUCT_NAME, PRODUCT_VERSION } from "@dicode/shared";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { HELP_TEXT, parseArgs } from "./router.js";

export function main(argv: string[] = process.argv.slice(2)): void {
  const options = parseArgs(argv);

  if (options.help) {
    process.stdout.write(HELP_TEXT);
    return;
  }
  if (options.version) {
    process.stdout.write(`${PRODUCT_NAME} ${PRODUCT_VERSION}\n`);
    return;
  }

  render(createElement(App, { cwd: options.cwd, resume: options.resume }));
}

export { parseArgs, HELP_TEXT };

const entryPath = process.argv[1] ? resolve(process.argv[1]) : "";
const thisPath = fileURLToPath(import.meta.url);
if (entryPath === thisPath) {
  main();
}
