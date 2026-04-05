#!/usr/bin/env node

import { execSync } from "node:child_process";
import { Command } from "commander";
import chalk from "chalk";

interface Commit {
  hash: string;
  author: string;
  email: string;
  date: string;
  timestamp: number;
  message: string;
  body: string;
  refs: string;
  graph?: string;
}

const COMMIT_TYPE_COLORS: Record<string, (s: string) => string> = {
  feat: chalk.green,
  fix: chalk.red,
  refactor: chalk.cyan,
  docs: chalk.blue,
  test: chalk.magenta,
  chore: chalk.gray,
  style: chalk.yellow,
  perf: chalk.greenBright,
  ci: chalk.blueBright,
  build: chalk.yellowBright,
  revert: chalk.redBright,
};

function relativeDate(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  if (diffWeek < 5) return `${diffWeek} week${diffWeek === 1 ? "" : "s"} ago`;
  if (diffMonth < 12) return `${diffMonth} month${diffMonth === 1 ? "" : "s"} ago`;
  return `${diffYear} year${diffYear === 1 ? "" : "s"} ago`;
}

function parseCommitType(message: string): { type: string; scope: string; rest: string } {
  const match = message.match(/^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.*)/);
  if (match) {
    return { type: match[1], scope: match[2] || "", rest: match[4] };
  }
  return { type: "", scope: "", rest: message };
}

function colorizeMessage(message: string): string {
  const { type, scope, rest } = parseCommitType(message);
  if (!type) return message;

  const colorFn = COMMIT_TYPE_COLORS[type] || chalk.white;
  const prefix = scope ? `${type}(${scope})` : type;
  return `${colorFn(prefix)}: ${rest}`;
}

function getGitLog(options: {
  limit: number;
  since?: string;
  until?: string;
  author?: string;
  graph?: boolean;
}): Commit[] {
  const separator = "---GIT-LOG-SEP---";
  const fieldSep = "---FIELD---";

  const formatParts = ["%h", "%an", "%ae", "%aI", "%at", "%s", "%b", "%D"];
  const format = formatParts.join(fieldSep);

  const args: string[] = ["git", "log", `--max-count=${options.limit}`, `--format=${format}`];

  if (options.since) args.push(`--since="${options.since}"`);
  if (options.until) args.push(`--until="${options.until}"`);
  if (options.author) args.push(`--author="${options.author}"`);

  let graphLines: string[] = [];
  if (options.graph) {
    try {
      const graphOutput = execSync(
        `git log --max-count=${options.limit} --graph --oneline --decorate${options.since ? ` --since="${options.since}"` : ""}${options.until ? ` --until="${options.until}"` : ""}${options.author ? ` --author="${options.author}"` : ""}`,
        { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
      ).trim();
      graphLines = graphOutput.split("\n");
    } catch {
      // ignore graph errors
    }
  }

  try {
    const output = execSync(args.join(" "), {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024,
    }).trim();

    if (!output) return [];

    const entries = output.split(`\n${separator}\n`).length > 1
      ? output.split(`\n${separator}\n`)
      : output.split("\n").filter(Boolean);

    const commits: Commit[] = [];
    const rawEntries = output.split("\n");

    let currentEntry = "";
    const parsedEntries: string[] = [];

    for (const line of rawEntries) {
      if (currentEntry && line.includes(fieldSep) && line.match(/^[0-9a-f]{7,}/)) {
        parsedEntries.push(currentEntry.trim());
        currentEntry = line;
      } else {
        currentEntry += (currentEntry ? "\n" : "") + line;
      }
    }
    if (currentEntry) parsedEntries.push(currentEntry.trim());

    for (let i = 0; i < parsedEntries.length; i++) {
      const entry = parsedEntries[i];
      const fields = entry.split(fieldSep);
      if (fields.length < 6) continue;

      commits.push({
        hash: fields[0],
        author: fields[1],
        email: fields[2],
        date: fields[3],
        timestamp: parseInt(fields[4], 10),
        message: fields[5],
        body: (fields[6] || "").trim(),
        refs: (fields[7] || "").trim(),
        graph: graphLines[i] || undefined,
      });
    }

    return commits;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("not a git repository")) {
      console.error(chalk.red("Error: Not a git repository"));
    } else {
      console.error(chalk.red(`Error reading git log: ${msg}`));
    }
    process.exit(1);
  }
}

function formatOneline(commits: Commit[]): void {
  for (const c of commits) {
    const hash = chalk.yellow(c.hash);
    const refs = c.refs ? chalk.red(` (${c.refs})`) : "";
    const msg = colorizeMessage(c.message);
    console.log(`${hash}${refs} ${msg}`);
  }
}

function formatCompact(commits: Commit[]): void {
  for (const c of commits) {
    const hash = chalk.yellow(c.hash);
    const author = chalk.blue(c.author);
    const date = chalk.green(relativeDate(c.date));
    const refs = c.refs ? chalk.red(` (${c.refs})`) : "";
    const msg = colorizeMessage(c.message);
    const graph = c.graph ? chalk.gray(c.graph.replace(/[0-9a-f]{7,}.*/, "").trimEnd()) + " " : "";

    console.log(`${graph}${hash} - ${msg}${refs}`);
    console.log(`${" ".repeat(graph.length)}  ${author} ${chalk.dim("|")} ${date}`);
    console.log();
  }
}

function formatDetailed(commits: Commit[]): void {
  for (const c of commits) {
    console.log(chalk.yellow(`commit ${c.hash}`) + (c.refs ? chalk.red(` (${c.refs})`) : ""));
    console.log(`Author: ${chalk.blue(c.author)} <${chalk.dim(c.email)}>`);
    console.log(`Date:   ${chalk.green(c.date)} (${relativeDate(c.date)})`);
    console.log();
    console.log(`    ${colorizeMessage(c.message)}`);
    if (c.body) {
      for (const line of c.body.split("\n")) {
        console.log(`    ${chalk.dim(line)}`);
      }
    }
    console.log();
    console.log(chalk.dim("─".repeat(60)));
    console.log();
  }
}

function formatChangelog(commits: Commit[]): void {
  const groups: Record<string, Commit[]> = {};
  const ungrouped: Commit[] = [];

  for (const c of commits) {
    const { type } = parseCommitType(c.message);
    if (type && COMMIT_TYPE_COLORS[type]) {
      if (!groups[type]) groups[type] = [];
      groups[type].push(c);
    } else {
      ungrouped.push(c);
    }
  }

  const typeLabels: Record<string, string> = {
    feat: "Features",
    fix: "Bug Fixes",
    refactor: "Refactoring",
    docs: "Documentation",
    test: "Tests",
    chore: "Chores",
    style: "Styles",
    perf: "Performance",
    ci: "CI/CD",
    build: "Build",
    revert: "Reverts",
  };

  const order = ["feat", "fix", "perf", "refactor", "docs", "test", "style", "build", "ci", "chore", "revert"];

  console.log(chalk.bold.white("# Changelog\n"));

  for (const type of order) {
    const items = groups[type];
    if (!items || items.length === 0) continue;

    const colorFn = COMMIT_TYPE_COLORS[type] || chalk.white;
    const label = typeLabels[type] || type;
    console.log(colorFn(`## ${label}\n`));

    for (const c of items) {
      const { scope, rest } = parseCommitType(c.message);
      const scopeStr = scope ? chalk.dim(`(${scope}) `) : "";
      console.log(`  - ${scopeStr}${rest} ${chalk.dim(`(${c.hash})`)}`);
    }
    console.log();
  }

  if (ungrouped.length > 0) {
    console.log(chalk.dim("## Other\n"));
    for (const c of ungrouped) {
      console.log(`  - ${c.message} ${chalk.dim(`(${c.hash})`)}`);
    }
    console.log();
  }
}

function formatGraph(commits: Commit[]): void {
  for (const c of commits) {
    const hash = chalk.yellow(c.hash);
    const refs = c.refs ? chalk.red(` (${c.refs})`) : "";
    const msg = colorizeMessage(c.message);
    const date = chalk.green(relativeDate(c.date));
    const author = chalk.blue(c.author);

    if (c.graph) {
      const graphPrefix = c.graph.replace(/[0-9a-f]{7,}.*/, "").trimEnd();
      console.log(`${chalk.gray(graphPrefix)} ${hash}${refs} ${msg} - ${author} ${date}`);
    } else {
      console.log(`${hash}${refs} ${msg} - ${author} ${date}`);
    }
  }
}

const program = new Command();

program
  .name("gitlog-pretty")
  .description("Beautiful git log viewer with colors and formatting")
  .version("1.0.0")
  .option("--oneline", "compact one-line output")
  .option("--graph", "show ASCII branch graph")
  .option("--since <date>", "show commits after date")
  .option("--until <date>", "show commits before date")
  .option("--author <name>", "filter by author name")
  .option("--limit <n>", "number of commits to show", "20")
  .option("--format <type>", "output format: compact, detailed, changelog", "compact")
  .option("--json", "output as JSON")
  .action((opts) => {
    const limit = parseInt(opts.limit, 10) || 20;

    const commits = getGitLog({
      limit,
      since: opts.since,
      until: opts.until,
      author: opts.author,
      graph: opts.graph,
    });

    if (commits.length === 0) {
      console.log(chalk.yellow("No commits found."));
      return;
    }

    if (opts.json) {
      console.log(JSON.stringify(commits, null, 2));
      return;
    }

    if (opts.oneline) {
      formatOneline(commits);
      return;
    }

    if (opts.graph) {
      formatGraph(commits);
      return;
    }

    switch (opts.format) {
      case "detailed":
        formatDetailed(commits);
        break;
      case "changelog":
        formatChangelog(commits);
        break;
      case "compact":
      default:
        formatCompact(commits);
        break;
    }
  });

program.parse();
