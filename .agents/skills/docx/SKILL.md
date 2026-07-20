---
name: docx
description: "Create, read, edit, and validate Word (.docx) files / 创建、读取、编辑与校验 Word（.docx）文件。Use for Markdown-to-Word conversion, template filling, Chinese typography, docx-js generation, OOXML patching, tracked changes, and comments. Trigger: Word document, .docx, Word report, Markdown to Word, md 转 docx, 模板套用, Word 修订, Word 批注, OOXML. Not for: PDF, spreadsheet, Google Docs, or unrelated coding work."
---

# DOCX Operations

## Language / 语言

Follow the user's language: reply in Chinese for Chinese requests and English for English requests. Provide both only when requested; preserve code, commands, paths, API names, identifiers, and quoted source text exactly.

Use the smallest path that preserves the requested document. Keep final output separate from the user's brief: compose reader-facing content first, then render it. Only render a supplied Markdown file unchanged when the user explicitly requests an exact conversion.

## Route The Task

| Request | Use |
|---|---|
| Brief or content -> new document | Markdown pipeline |
| Existing Markdown -> Word | Markdown pipeline without composition |
| `{{token}}` template | Template fill |
| Custom layout | `docx-js` generation |
| Existing `.docx`, revisions, or comments | OOXML patch path |
| Read or extract text | `pandoc` or unpack path |

Read the detailed instructions only for the selected path:

- Markdown rendering and validation: [pipeline.md](reference/pipeline.md)
- Templates and placeholders: [templates.md](reference/templates.md)
- `docx-js`, OOXML, tracked changes, comments, and all legacy examples: [legacy-complete-guide.md](reference/legacy-complete-guide.md)

## Standard Workflow

1. Read the request and identify audience, content, language, template, and expected output path.
2. Compose a clean Markdown body containing only final document content. Do not pass a requirement brief, layout instructions, or meta-commentary to a renderer.
3. Run `python scripts/doctor.py` once to select the available renderer.
4. Render with `scripts/md_to_docx.py`; use `scripts/md_to_docx.mjs --cjk` only when Pandoc is unavailable.
5. Run `python scripts/office/validate.py <output.docx>`.
6. For multi-page or table-heavy documents, run `python scripts/preview.py <output.docx> --pages 1,2,last` when LibreOffice is available and inspect the images.

Use a supplied reference template with `--reference`. For literal placeholders, use `scripts/fill_template.py`; it writes a new output file and must not modify the template in place.

## Chinese Documents

Pass `--cjk` to the Node renderer or use `scripts/styles/zh-cn.js` in custom code. Declare an East Asian font explicitly; do not rely on a Latin font fallback. Use 1.5 line spacing and a two-character first-line indent for body text unless the user specifies a different house style.

## Existing Document Changes

For structural edits, tracked changes, or comments, use this order:

1. `python scripts/office/unpack.py input.docx unpacked/`
2. Edit the required XML under `unpacked/word/`.
3. `python scripts/office/pack.py unpacked/ output.docx --original input.docx`
4. Validate the result and preview when appearance matters.

Do not splice revision tags into an existing run. Replace complete `<w:r>` blocks, preserve run properties, and use `<w:delText>` for deleted text. The exact XML patterns are in [legacy-complete-guide.md](reference/legacy-complete-guide.md).

## Completion Evidence

Report the output path and the validation result. Layout correctness requires visual inspection; XML validation alone is not sufficient evidence for appearance-sensitive documents.
