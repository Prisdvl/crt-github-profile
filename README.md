# Prisdvl — CRT GitHub Profile

Build a retro terminal-style GitHub profile with configurable SVG generation.

<p align="center">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="assets/terminal-static-enhanced.svg">
    <img src="assets/terminal-enhanced.svg" alt="Prisdvl — Java Backend / AI Systems" width="1000">
  </picture>
</p>

[![Node.js >=22](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

This repository is both a working profile example and a reusable generator. Edit one JSON file, run one command, and get a terminal profile, ASCII portrait, projects card, contribution heatmap, and a ready-to-use Profile README.

## Start

- [Use this template](https://github.com/Prisdvl/crt-github-profile/generate) to create a new independent repository.
- [Fork this repository](https://github.com/Prisdvl/crt-github-profile/fork) to create your own linked copy.
- [Star this repository](https://github.com/Prisdvl/crt-github-profile/stargazers) if it is useful.

## Features

- Animated CRT terminal with typing, scanlines, glow, and vignette.
- Static terminal output for `prefers-reduced-motion`.
- ASCII profile art composed into the terminal layout.
- Config-driven skills, projects, theme, and identity.
- Terminal-styled contribution heatmap with cache and placeholder fallbacks.
- One command for SVG generation and Profile README output.
- Cross-platform local generation on Windows, macOS, and Linux.
- Pinned `svg-terminal` generation dependency; no remote build service is required.

## Quick Start

Requirements: Node.js 22 or newer and npm.

```bash
npm install
npm run generate
```

Before generating, edit [`profile.config.json`](./profile.config.json). It is the only place where personal information should be changed:

```json
{
  "username": "your-github-handle",
  "displayName": "Your Name",
  "headline": "Backend / AI Systems",
  "timezone": "Asia/Shanghai",
  "bio": "Building reliable systems.",
  "availability": "Open to collaboration",
  "projects": [
    {
      "name": "your-project",
      "stack": "Java / Spring Boot",
      "description": "A concise project description",
      "url": "https://github.com/your-github-handle/your-project"
    }
  ]
}
```

Validate the file without generating assets:

```bash
npm run validate:config
```

## Customization

`profile.config.json` supports these fields:

| Field | Purpose |
| --- | --- |
| `username` | GitHub username used by the terminal, links, and contribution fetch. |
| `displayName` | Name shown in titles, captions, and generated README. |
| `headline` | Short technical positioning line. |
| `timezone` | IANA timezone shown in the terminal. |
| `bio` | Short biography shown in the terminal and Profile README. |
| `availability` | Status line such as `Open to collaboration`. |
| `theme` | `background`, `surface`, `text`, `muted`, and `accent` colors. |
| `skills` | Array of `{ "name": "...", "level": 0-100 }` values. |
| `projects` | Array of projects with `name`, `stack`, `description`, and an HTTP(S) `url`. |
| `terminal` | Optional focus, runtime, interests, status, and highlight lines. |
| `options.animatedTerminal` | Generate and reference the animated terminal output. |
| `options.contributionHeatmap` | Generate and reference the contribution heatmap. |
| `options.readmeStyle` | `full` (default) or `svg-only` to emit only the configured terminal SVG in the Profile README. |

Missing `username`, malformed colors, invalid URLs, out-of-range skill levels, invalid timezones, and empty project lists are rejected with field-specific errors. `terminal.yml` is the visual layout template; `npm run generate` resolves it from `profile.config.json` into `.tmp/terminal.generated.yml`, so normal customization does not require JavaScript edits.

## Output and Troubleshooting

The default command writes:

- `assets/terminal-enhanced.svg` and `assets/terminal-static-enhanced.svg`
- `assets/ascii-portrait.svg`
- `assets/projects.svg`
- `assets/contribution.svg` when the heatmap option is enabled
- `dist/PROFILE-README.md`

`npm run generate` honors the two optional output flags: disabling one prevents it from generating or referencing that output. Previously generated files are left in place. The legacy `npm run build:all` entry remains a full compatibility build and can regenerate both optional outputs.

The root `README.md` is this project's introduction. It is not overwritten by the generator. To use the generated profile:

1. Copy `dist/PROFILE-README.md` into your `<username>/<username>` profile repository as `README.md`.
2. Copy the `assets/` files it references into the same profile repository.
3. Commit and push that repository.

Contribution data comes from GitHub's public contribution HTML page. If the request fails, the generator uses the last cached contribution file or writes a clearly marked placeholder. The latest-commit line is optional and also falls back to cache when available. To force a placeholder from the contribution generator directly:

```bash
node scripts/generate-contribution.mjs --placeholder
```

The first `npm install` requires npm registry access. After installation, terminal generation runs locally. GitHub access is only needed for live contribution and activity data; failures do not produce fake contribution counts.

## Contributing

Issues and pull requests are welcome in the [repository](https://github.com/Prisdvl/crt-github-profile/issues). If you change generation behavior, run `npm run validate:config` and `npm run generate` before opening a pull request.

## License

Released under the [MIT License](./LICENSE).
