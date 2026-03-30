# Port-Engineering-Course
Port Engineering Course Website

## Built-in AI Assistant

This website now includes a floating AI assistant for students.

- It appears on all pages as an `AI` button in the bottom-right corner.
- It can answer common questions about lectures, assignments, attendance, and resources using built-in course guidance.
- It loads structured answers from `ai-knowledge.json` (editable by instructor).
- It automatically reads current page headings and key bullet points to ground responses in visible content.
- It can also use external public knowledge (Wikipedia summary lookup) when local course content is insufficient.
- It can call a live AI model through a backend proxy endpoint.

### Edit Course Knowledge

Update `ai-knowledge.json` to customize assistant answers without changing JavaScript code.

Each item supports:
- `topic`
- `keywords` (list of trigger terms)
- `answer`

### Port Engineering Domain Library

The assistant also loads `port-domain.json`, a larger domain Q&A library for general port-engineering questions beyond website content.

- Format per entry:
	- `terms` (keywords/synonyms)
	- `answer` (concise technical explanation)
- This file is intended for editable domain expansion without modifying JavaScript.

### Add Per-Page Exact Facts

Each HTML page can include hidden metadata for exact answers:

```html
<script class="pe-ai-meta" type="application/json">
{
	"page": "assignments",
	"facts": ["..."],
	"deadlines": [{ "label": "...", "due": "...", "status": "..." }],
	"quickAnswers": [
		{ "keywords": ["deadline", "submit"], "answer": "..." }
	],
	"links": [{ "label": "...", "purpose": "..." }]
}
</script>
```

`quickAnswers` has highest priority in offline mode, so use it for strict/official wording.

### Validate Metadata Before Publish

Run:

```bash
node tools/validate-ai-metadata.js
```

PowerShell alternative (no Node required):

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\validate-ai-metadata.ps1
```

The validator checks:
- required pages contain `pe-ai-meta` blocks
- metadata JSON is valid
- key fields (`page`, `quickAnswers`, `deadlines`, `links`) follow expected structure

## Assignment Submission Policy

To prevent cross-assignment submission blocking, each assignment must use its own dedicated Google Form link.

- Assignment 1, Assignment 2, Assignment 3, and Assignment 4 should not share the same form URL.
- If Google Form setting `Limit to 1 response` is enabled, it should apply per assignment form, not across all assignments.
- Keep `assignments.html` links and the page `pe-ai-meta` quick answers in sync whenever a form URL changes.

### Live AI setup with proxy (recommended)

1. Open any page and click the `AI` button.
2. Expand `AI settings (optional)`.
3. Enter your proxy endpoint URL (example: `http://localhost:8787/api/chat`).
4. Optionally set a proxy access token.
5. Set your preferred model (default: `gpt-4o-mini`).
6. Click `Save settings`.

### Local proxy example

This repository includes a sample proxy at `server/proxy-example.js`.

1. Set environment variables:
	- `OPENAI_API_KEY` (required)
	- `AI_PROXY_TOKEN` (optional)
	- `PORT` (optional, default `8787`)
2. Run `node server/proxy-example.js`.
3. In assistant settings, set endpoint to `http://localhost:8787/api/chat`.

Notes:
- Assistant settings are stored in browser `localStorage`.
- API provider keys stay server-side when proxy mode is used.
