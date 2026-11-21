import { generateGlobPatterns, serwist } from "@serwist/next/config";

export default serwist.withNextConfig((nextConfig) => {
  const distDir = `${nextConfig.distDir.replace(/[\\/]+$/, "")}/`;

  return {
    swSrc: "src/app/sw.ts",
    swDest: "out/sw.js",
    globPatterns: [
      ...generateGlobPatterns(distDir),
      `${distDir}static/**/*.{woff,woff2,ttf,otf}`,
    ],
  };
});
