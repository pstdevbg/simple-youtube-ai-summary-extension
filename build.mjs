import * as esbuild from "esbuild";
import { cpSync, mkdirSync } from "fs";

const watch = process.argv.includes("--watch");

function copyPublic() {
  mkdirSync("dist", { recursive: true });
  cpSync("public", "dist", { recursive: true });
}

const options = {
  entryPoints: [
    "src/youtube/index.ts",
    "src/background/index.ts",
    "src/options/index.ts",
    "src/ai/chatgpt.ts",
    "src/ai/claude.ts",
    "src/ai/gemini.ts",
    "src/ai/deepseek.ts",
  ],
  bundle: true,
  outdir: "dist",
  format: "iife",
  target: "chrome120",
  minify: !watch,
};

copyPublic();

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await esbuild.build(options);
  console.log("Build complete.");
}
