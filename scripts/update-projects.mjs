import { readFileSync, writeFileSync } from "node:fs";

const USERNAME = "Netflibata";
const README_PATH = new URL("../README.md", import.meta.url);
const START_MARKER = "<!-- AUTO-PROJECTS:START -->";
const END_MARKER = "<!-- AUTO-PROJECTS:END -->";
const FEATURED_REPOSITORIES = new Set([
  "YOLO26-Violation-Behavior-Recognition",
  "weixin-program-order",
]);

function escapeMarkdown(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r?\n/g, " ")
    .trim();
}

const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "Netflibata-Profile-Updater",
};

if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

const response = await fetch(
  `https://api.github.com/users/${USERNAME}/repos?type=owner&sort=pushed&direction=desc&per_page=100`,
  { headers },
);

if (!response.ok) {
  throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
}

const repositories = (await response.json())
  .filter(
    (repository) =>
      !repository.fork &&
      !repository.archived &&
      repository.name !== USERNAME &&
      !FEATURED_REPOSITORIES.has(repository.name),
  )
  .sort((left, right) => Date.parse(right.pushed_at) - Date.parse(left.pushed_at))
  .slice(0, 6);

let generatedContent;

if (repositories.length === 0) {
  generatedContent =
    "> 此区域由 GitHub Actions 自动维护。新上传的公开项目会自动显示在这里。";
} else {
  const rows = repositories.map((repository) => {
    const name = escapeMarkdown(repository.name);
    const description =
      escapeMarkdown(repository.description) || "A public project by Netflibata";
    const language = escapeMarkdown(repository.language) || "—";
    const updated = repository.pushed_at.slice(0, 10);
    const stars = Number(repository.stargazers_count) || 0;

    return `| [**${name}**](${repository.html_url}) | ${description} | ${language} | ⭐ ${stars} · ${updated} |`;
  });

  generatedContent = [
    "> 此区域每 6 小时自动刷新，按最近推送时间展示最多 6 个公开项目。",
    "",
    "| Project | Description | Main Language | Activity |",
    "|:---|:---|:---:|:---:|",
    ...rows,
  ].join("\n");
}

const readme = readFileSync(README_PATH, "utf8");
const startIndex = readme.indexOf(START_MARKER);
const endIndex = readme.indexOf(END_MARKER);

if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
  throw new Error("Automatic project markers are missing or malformed in README.md.");
}

const replacement = `${START_MARKER}\n${generatedContent}\n${END_MARKER}`;
const updatedReadme =
  readme.slice(0, startIndex) + replacement + readme.slice(endIndex + END_MARKER.length);

if (updatedReadme !== readme) {
  writeFileSync(README_PATH, updatedReadme, "utf8");
  console.log(`Updated README.md with ${repositories.length} automatic project entries.`);
} else {
  console.log("README.md is already up to date.");
}
