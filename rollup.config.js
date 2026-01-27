import fs from "node:fs/promises";
import path from "node:path";
import { babel } from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
// 1. 核心替换：引入rollup-plugin-postcss（纯CSS+PostCSS专用）
import postcss from "rollup-plugin-postcss";
import replace from "@rollup/plugin-replace";
import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import { glob } from "glob";
import { stripIndent } from "common-tags";
// 保留PostCSS插件引入（已安装，直接复用）
import autoprefixer from "autoprefixer";
// 引入cssnano（PostCSS生态，纯CSS压缩专用）
import cssnano from "cssnano";

// Plugins 遍历逻辑【完全不变】
const pluginPaths = await glob(["src/*/index.js"]);
const pluginConfigs = pluginPaths.map((pluginPath) => {
  const dir = path.basename(path.dirname(pluginPath));
  const name = path.basename(pluginPath, ".js");
  const outputName = name === "index" ? dir : name;

  return {
    inputPath: pluginPath,
    outputDir: `dist/${outputName}`, // CSS/JS仍输出到该同层级目录
    outputName:`docsify-${outputName}`, // 文件名保持一致，仅后缀不同
    title: `Docsify Plugin: ${outputName}`,
  };
});

// Rollup 基础配置【完全不变】
const currentYear = new Date().getFullYear();
const { homepage, license, version } = JSON.parse(
  await fs.readFile(path.join(import.meta.dirname, "package.json"), "utf8"),
);
const baseConfig = {
  output: {
    format: "iife",
  },
  plugins: [
    resolve(),
    commonjs(),
    replace({
      preventAssignment: true,
      values: {
        __VERSION__: version,
      },
    }),
    babel({
      babelHelpers: "bundled",
    }),
  ],
  watch: {
    clearScreen: false,
  },
};
const bundleConfigs = [];

// 生成打包配置【仅修改CSS处理部分，其余完全不变】
[...pluginConfigs].forEach((bundleConfig) => {
  const { inputPath, outputDir, outputName, title } = bundleConfig;
  const banner = stripIndent`
    /*!
     * ${title} v${version}
     * ${homepage}
     * (c) 2017-${currentYear}
     * ${license} license
     */
  `;

  // 压缩版配置（${outputName}.min.js + ${outputName}.min.css，纯CSS+PostCSS处理）
  const minifiedConfig = {
    ...baseConfig,
    input: inputPath,
    output: {
      ...baseConfig.output,
      banner,
      file: path.join(outputDir, `${outputName}.min.js`),
      sourcemap: true,
    },
    plugins: [
      ...baseConfig.plugins,
      // 2. 配置压缩版CSS：纯CSS+PostCSS+压缩，与min.js同层级
      postcss({
        extract: `${outputName}.min.css`, // 核心：提取独立CSS，路径与min.js完全同层级
        sourceMap: true, // 生成CSS SourceMap（与JS保持一致）
        plugins: [
          autoprefixer({
            // PostCSS核心插件：自动补全浏览器前缀（配置可保留/移至postcss.config.js）
            overrideBrowserslist: ["last 2 versions", "> 1%", "not dead"],
            grid: true,
          }),
          // 纯CSS压缩：使用cssnano（PostCSS生态，比通用压缩更适配CSS）
          cssnano({
            preset: "default", // 默认压缩配置，兼顾体积和兼容性
          }),
        ],
        minimize: false, // 关闭插件内置压缩，改用cssnano精准控制（推荐）
      }),
      terser({
        output: {
          comments: /^!/,
        },
      }),
    ],
  };

  // 未压缩版配置（${outputName}.js + ${outputName}.css，纯CSS+PostCSS处理，不压缩）
  const unminifiedConfig = {
    ...baseConfig,
    input: inputPath,
    output: {
      ...baseConfig.output,
      banner,
      file: path.join(outputDir, `${outputName}.js`),
    },
    plugins: [
      ...baseConfig.plugins,
      // 3. 配置未压缩版CSS：纯CSS+PostCSS，格式化输出，与js同层级
      postcss({
        extract: `${outputName}.css`, // 核心：提取独立CSS，路径与js完全同层级
        plugins: [
          autoprefixer({
            // 未压缩版与压缩版PostCSS插件配置完全一致，保证样式处理逻辑统一
            overrideBrowserslist: ["last 2 versions", "> 1%", "not dead"],
            grid: true,
          }),
          // 未压缩版：不添加cssnano，保留格式化CSS
        ],
        minimize: false, // 关闭压缩
        sourceMap: false, // 未压缩版可选关闭SourceMap（也可开启，根据需求调整）
      }),
      terser({
        compress: false,
        mangle: false,
        output: {
          beautify: true,
          comments: /^!/,
        },
      }),
    ],
  };

  bundleConfigs.push(minifiedConfig, unminifiedConfig);
});

// 导出配置【完全不变】
export default [...bundleConfigs];
