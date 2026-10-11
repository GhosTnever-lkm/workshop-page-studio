# Changelog

## 0.2.2 - 2026-10-11

- Add unit tests (node:test, 11 cases) for the export logic: BBCode and Markdown generation, link safety (only clean http/https), text escaping, slug and draft validation. The tests evaluate the real inline script from index.html, so the single-file offline design stays unchanged.
- `npm test` runs the tests; `npm run check` now runs static checks and tests together.


## 0.2.1 - 2026-10-11

- Add dependency-free static checks for duplicate IDs, fragment links, and inline JavaScript syntax.
- Add CI to run those checks on pushes and pull requests.
- Refresh the offline download link.

## 0.2.0 - 2026-10-08

- Reject empty or unrelated JSON files instead of reporting them as loaded drafts.
- Limit draft imports to 5 MiB before reading them into memory.
- Keep non-HTTP(S) link schemes as plain text in preview and exported formats.
- Escape Markdown link labels and encode parentheses in destinations.
- Announce the live short-description character count to assistive technology.
- Add GitHub funding metadata for the existing public support channels.

## 0.1.0 - 2026-10-07

- Initial offline-first bilingual workshop-page editor.
- Add live preview, Steam BBCode and Markdown export, JSON drafts, and keyboard-operable output tabs.
