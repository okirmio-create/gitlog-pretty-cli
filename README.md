# gitlog-pretty-cli

Beautiful git log viewer with colors and formatting.

## Install

```bash
npm install -g gitlog-pretty-cli
```

## Usage

```bash
# Default pretty log (last 20 commits)
gitlog-pretty

# Compact one-line view
gitlog-pretty --oneline

# ASCII branch graph
gitlog-pretty --graph

# Filter by date range
gitlog-pretty --since "2024-01-01" --until "2024-12-31"

# Filter by author
gitlog-pretty --author "John"

# Limit number of commits
gitlog-pretty --limit 50

# Output formats: compact, detailed, changelog
gitlog-pretty --format detailed
gitlog-pretty --format changelog

# JSON output
gitlog-pretty --json
```

## Options

| Option | Description |
|---|---|
| `--oneline` | Compact one-line per commit |
| `--graph` | Show ASCII branch graph |
| `--since <date>` | Show commits after date |
| `--until <date>` | Show commits before date |
| `--author <name>` | Filter by author |
| `--limit <n>` | Number of commits (default: 20) |
| `--format <type>` | Output format: compact, detailed, changelog |
| `--json` | Output as JSON |

## Formats

- **compact** (default) -- hash, author, date, message on one line
- **detailed** -- full commit info with body
- **changelog** -- groups commits by conventional commit type (feat, fix, refactor, etc.)

## License

MIT
