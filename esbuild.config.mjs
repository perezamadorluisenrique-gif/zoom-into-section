import esbuild from "esbuild";
import process   from "process";
import { builtinModules } from "node:module";

const isProd = process.argv[2] === "production";

const context = await esbuild.context({
  entryPoints: ["main.ts"],
  bundle:      true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    // Node's own list, in both spellings, in place of the
    // `builtin-modules` package. Nothing here imports a Node builtin;
    // this only keeps esbuild from trying to bundle one if that changes.
    ...builtinModules,
    ...builtinModules.map((name) => `node:${name}`),
  ],
  format:     "cjs",
  target:     "es2018",
  logLevel:   "info",
  sourcemap:  isProd ? false : "inline",
  treeShaking: true,
  outfile:    "main.js",
});

if (isProd) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
