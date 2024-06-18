import type { KnipConfig } from "knip";

const config: KnipConfig = {
  ignoreDependencies: [
    "@next/env", // This isn't listed as a dependency, but is included by next
  ],
  exclude: ["devDependencies"],
  compilers: {
    // This shows knip how to notice imports in css files e.g. @import "@radix-ui/colors"
    css: (text: string) => [...text.matchAll(/(?<=@)import[^;]+/g)].join("\n"),
  },
};

export default config;
