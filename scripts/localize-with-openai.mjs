#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const DOCS_JSON_PATH = path.join(ROOT, "docs.json");
const SOURCE_DIRS = ["pages", "snippets", "api-reference"];
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5.4";
const CACHE_DIR = path.join(ROOT, ".translation-cache");

const LANGUAGES = {
  cn: {
    code: "cn",
    label: "Chinese",
    localeName: "Simplified Chinese",
    dir: "cn",
  },
  jp: {
    code: "jp",
    label: "Japanese",
    localeName: "Japanese",
    dir: "jp",
  },
  ko: {
    code: "ko",
    label: "Korean",
    localeName: "Korean",
    dir: "ko",
  },
};

const NAV_TRANSLATIONS = {
  cn: {
    Overview: "概览",
    "Ephemeral Rollup": "Ephemeral Rollup",
    "Private Ephemeral Rollup": "Private Ephemeral Rollup",
    "Verifiable Randomness": "可验证随机性",
    Templates: "模板",
    Tools: "工具",
    "Additional Information": "更多信息",
    "How-to-Guide": "操作指南",
    "Reference Material": "参考资料",
    "How it Works": "工作原理",
    "Magic Actions": "Magic Actions",
    "ROUTER API": "ROUTER API",
    "RPC API": "RPC API",
    Methods: "方法",
    Introduction: "简介",
    "How-to Guide": "操作指南",
    "API Reference": "API 参考",
    "Open Source Programs": "开源程序",
    "Core Concepts": "核心概念",
    "Getting Started": "开始使用",
    Guides: "指南",
    "Rust Example": "Rust 示例",
  },
  jp: {
    Overview: "概要",
    "Ephemeral Rollup": "Ephemeral Rollup",
    "Private Ephemeral Rollup": "Private Ephemeral Rollup",
    "Verifiable Randomness": "検証可能なランダム性",
    Templates: "テンプレート",
    Tools: "ツール",
    "Additional Information": "追加情報",
    "How-to-Guide": "ガイド",
    "Reference Material": "参考資料",
    "How it Works": "仕組み",
    "Magic Actions": "Magic Actions",
    "ROUTER API": "ROUTER API",
    "RPC API": "RPC API",
    Methods: "メソッド",
    Introduction: "概要",
    "How-to Guide": "ガイド",
    "API Reference": "API リファレンス",
    "Open Source Programs": "オープンソースプログラム",
    "Core Concepts": "コアコンセプト",
    "Getting Started": "スタートガイド",
    Guides: "ガイド",
    "Rust Example": "Rust 例",
  },
  ko: {
    Overview: "개요",
    "Ephemeral Rollup": "Ephemeral Rollup",
    "Private Ephemeral Rollup": "Private Ephemeral Rollup",
    "Verifiable Randomness": "검증 가능한 랜덤성",
    Templates: "템플릿",
    Tools: "도구",
    "Additional Information": "추가 정보",
    "How-to-Guide": "가이드",
    "Reference Material": "참고 자료",
    "How it Works": "작동 방식",
    "Magic Actions": "Magic Actions",
    "ROUTER API": "ROUTER API",
    "RPC API": "RPC API",
    Methods: "메서드",
    Introduction: "소개",
    "How-to Guide": "가이드",
    "API Reference": "API 레퍼런스",
    "Open Source Programs": "오픈 소스 프로그램",
    "Core Concepts": "핵심 개념",
    "Getting Started": "시작하기",
    Guides: "가이드",
    "Rust Example": "Rust 예제",
  },
};

function parseArgs(argv) {
  const args = {
    prepareOnly: false,
    translate: false,
    langs: ["cn", "jp", "ko"],
    model: DEFAULT_MODEL,
    concurrency: 1,
  };

  for (const arg of argv) {
    if (arg === "--prepare-only") args.prepareOnly = true;
    else if (arg === "--translate") args.translate = true;
    else if (arg.startsWith("--langs=")) {
      args.langs = arg
        .slice("--langs=".length)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    } else if (arg.startsWith("--model=")) {
      args.model = arg.slice("--model=".length).trim();
    } else if (arg.startsWith("--concurrency=")) {
      args.concurrency = Math.max(1, Number(arg.slice("--concurrency=".length)) || 1);
    }
  }

  return args;
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function loadDotEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!(await exists(envPath))) return;

  const raw = await fs.readFile(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function rewriteInternalPaths(content, lang) {
  return content.replace(
    /(["'(=])\/(pages|snippets|api-reference)\//g,
    (_match, prefix, baseDir) => `${prefix}/${lang}/${baseDir}/`,
  );
}

function translateNavLabel(value, lang) {
  return NAV_TRANSLATIONS[lang]?.[value] || value;
}

function localizeTopLevelString(value, lang) {
  const map = {
    name: {
      cn: "MagicBlock 文档",
      jp: "MagicBlock ドキュメント",
      ko: "MagicBlock 문서",
    },
    description: {
      cn: "借助 MagicBlock，想象皆可落地。构建势不可挡的游戏、高速 DeFi 和具备 Web2 体验的 Web3 应用。",
      jp: "MagicBlock を使えば、思い描くものを形にできます。止まらないゲーム、高速な DeFi、そして Web2 のように動作する Web3 アプリを構築できます。",
      ko: "MagicBlock과 함께라면 상상한 모든 것을 구현할 수 있습니다. 멈추지 않는 게임, 고속 DeFi, 그리고 Web2처럼 동작하는 Web3 앱을 구축하세요.",
    },
  };
  return map[value]?.[lang] || value;
}

function localizeNavNode(node, lang) {
  if (Array.isArray(node)) {
    return node.map((item) => localizeNavNode(item, lang));
  }

  if (typeof node === "string") {
    if (node.startsWith("pages/") || node.startsWith("api-reference/")) {
      return `${lang}/${node}`;
    }
    return node;
  }

  if (!node || typeof node !== "object") {
    return node;
  }

  const localized = {};

  for (const [key, value] of Object.entries(node)) {
    if (key === "tab" || key === "group" || key === "anchor") {
      localized[key] = translateNavLabel(String(value), lang);
      continue;
    }

    if (key === "pages" || key === "groups" || key === "tabs") {
      localized[key] = localizeNavNode(value, lang);
      continue;
    }

    localized[key] = localizeNavNode(value, lang);
  }

  return localized;
}

async function updateDocsJson(langs) {
  const raw = await fs.readFile(DOCS_JSON_PATH, "utf8");
  const docsJson = JSON.parse(raw);
  const navigation = docsJson.navigation || {};
  const englishTabs = navigation.tabs || [];
  const globalNav = navigation.global;

  docsJson.navigation = {
    ...(globalNav ? { global: globalNav } : {}),
    languages: [
      { language: "en", tabs: englishTabs },
      ...langs.map((lang) => ({
        language: lang,
        tabs: localizeNavNode(englishTabs, lang),
      })),
    ],
  };

  await fs.writeFile(DOCS_JSON_PATH, `${JSON.stringify(docsJson, null, 2)}\n`);
}

async function collectSourceFiles() {
  const files = [];

  async function walk(dir) {
    const entries = await fs.readdir(path.join(ROOT, dir), { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(relativePath);
      } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
        files.push(relativePath);
      }
    }
  }

  for (const dir of SOURCE_DIRS) {
    if (await exists(path.join(ROOT, dir))) {
      await walk(dir);
    }
  }

  return files.sort();
}

async function prepareLocalizedTrees(langs) {
  const files = await collectSourceFiles();

  for (const lang of langs) {
    for (const relativeFile of files) {
      const sourcePath = path.join(ROOT, relativeFile);
      const targetPath = path.join(ROOT, lang, relativeFile);
      const targetDir = path.dirname(targetPath);
      const source = await fs.readFile(sourcePath, "utf8");
      const rewritten = rewriteInternalPaths(source, lang);
      await fs.mkdir(targetDir, { recursive: true });
      await fs.writeFile(targetPath, rewritten);
    }
  }

  return files;
}

function splitFrontmatter(content) {
  if (!content.startsWith("---\n")) {
    return { frontmatter: "", body: content };
  }

  const end = content.indexOf("\n---\n", 4);
  if (end === -1) {
    return { frontmatter: "", body: content };
  }

  return {
    frontmatter: content.slice(0, end + 5),
    body: content.slice(end + 5),
  };
}

function stripCodeBlocks(content) {
  return content.replace(/```[\s\S]*?```/g, (block, index) => `__CODE_BLOCK_${index}__`);
}

function restoreCodeBlocks(content, original) {
  const blocks = original.match(/```[\s\S]*?```/g) || [];
  return content.replace(/__CODE_BLOCK_(\d+)__/g, (_match, index) => blocks[Number(index)] || "");
}

function cacheKey(model, lang, content) {
  return crypto.createHash("sha256").update(`${model}:${lang}:${content}`).digest("hex");
}

async function callOpenAI({ apiKey, model, lang, sourceText }) {
  const prompt = [
    `Translate this MDX document into ${LANGUAGES[lang].localeName}.`,
    "Preserve valid MDX syntax exactly.",
    "Do not change imports, exports, component names, fenced code blocks, inline code, JSON keys, URLs, file paths, API identifiers, or route prefixes.",
    "Translate all human-readable text, including frontmatter title and description values, headings, paragraphs, lists, table text, captions, labels, callouts, link text, and card text.",
    "Do not translate code examples, command names, SDK/API symbols, or literal config keys.",
    "Keep frontmatter keys unchanged.",
    "Return only the translated MDX document with no markdown fences.",
  ].join(" ");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: "low" },
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: prompt }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: sourceText }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API request failed (${response.status}): ${text}`);
  }

  const payload = await response.json();
  const outputText = payload.output_text;
  if (!outputText || typeof outputText !== "string") {
    throw new Error("OpenAI API response did not include output_text");
  }

  return outputText;
}

async function withConcurrency(items, limit, worker) {
  const queue = [...items];
  const tasks = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item) {
        await worker(item);
      }
    }
  });
  await Promise.all(tasks);
}

async function translateLocalizedTrees({ langs, model, concurrency }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to translate docs with OpenAI.");
  }

  const files = await collectSourceFiles();
  await fs.mkdir(CACHE_DIR, { recursive: true });

  const jobs = [];
  for (const lang of langs) {
    for (const relativeFile of files) {
      jobs.push({ lang, relativeFile });
    }
  }

  await withConcurrency(jobs, concurrency, async ({ lang, relativeFile }) => {
    const localizedPath = path.join(ROOT, lang, relativeFile);
    const current = await fs.readFile(localizedPath, "utf8");
    const masked = stripCodeBlocks(current);
    const key = cacheKey(model, lang, masked);
    const cachePath = path.join(CACHE_DIR, `${key}.mdx`);

    if (await exists(cachePath)) {
      const cached = await fs.readFile(cachePath, "utf8");
      await fs.writeFile(localizedPath, cached);
      return;
    }

    const translated = await callOpenAI({
      apiKey,
      model,
      lang,
      sourceText: masked,
    });

    const restored = restoreCodeBlocks(translated, current);
    const { frontmatter, body } = splitFrontmatter(restored);
    const normalized = `${frontmatter}${body}`.trimEnd() + "\n";
    await fs.writeFile(cachePath, normalized);
    await fs.writeFile(localizedPath, normalized);
    process.stdout.write(`Translated ${lang}/${relativeFile}\n`);
  });
}

async function main() {
  await loadDotEnv();
  const args = parseArgs(process.argv.slice(2));
  const langs = args.langs.filter((lang) => LANGUAGES[lang]);

  if (langs.length === 0) {
    throw new Error("No supported languages selected. Use cn, jp, ko.");
  }

  await prepareLocalizedTrees(langs);
  await updateDocsJson(langs);

  if (args.translate) {
    await translateLocalizedTrees(args);
  }

  if (args.prepareOnly || !args.translate) {
    process.stdout.write(
      `Prepared localized trees for ${langs.join(", ")} and updated docs.json.\n`,
    );
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
