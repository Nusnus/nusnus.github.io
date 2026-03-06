# Obsidian-Style Markdown Features

This document demonstrates the new Obsidian-style markdown features added to the AI chat markdown renderer.

## Wikilinks

Wikilinks allow you to reference pages using double brackets:

- Basic wikilink: `[[Page Name]]` → [[Page Name]]
- Wikilink with custom display: `[[actual-page|Custom Text]]` → [[actual-page|Custom Text]]

Wikilinks are rendered as styled badges with tooltips showing the target page.

## Callouts

Callouts are styled information boxes that draw attention to important content.

### Note Callout

```
> [!note]
> This is a note callout
> It can span multiple lines
```

> [!note]
> This is a note callout
> It can span multiple lines

### Tip Callout

```
> [!tip] Pro Tip
> Here's a helpful tip for better results
```

> [!tip] Pro Tip
> Here's a helpful tip for better results

### Warning Callout

```
> [!warning]
> Be careful with this operation
```

> [!warning]
> Be careful with this operation

### Danger Callout

```
> [!danger]
> This action cannot be undone
```

> [!danger]
> This action cannot be undone

### Info Callout

```
> [!info]
> Additional information here
```

> [!info]
> Additional information here

### Success Callout

```
> [!success]
> Operation completed successfully
```

> [!success]
> Operation completed successfully

### Question Callout

```
> [!question]
> Did you know this feature exists?
```

> [!question]
> Did you know this feature exists?

## Markdown Tables

Tables are now rendered with proper styling and support alignment.

### Basic Table

| Feature | Status | Priority |
| --- | --- | --- |
| Wikilinks | ✅ Complete | High |
| Callouts | ✅ Complete | High |
| Tables | ✅ Complete | Medium |

### Table with Alignment

| Left Aligned | Center Aligned | Right Aligned |
| :--- | :---: | ---: |
| Text | Text | Text |
| More | More | More |

### Table with Inline Formatting

| Feature | Description | Example |
| --- | --- | --- |
| **Bold** | Make text bold | `**text**` |
| *Italic* | Make text italic | `*text*` |
| `Code` | Inline code | `` `code` `` |
| [Links](url) | Hyperlinks | `[text](url)` |

## Combined Example

Here's an example combining multiple features:

> [!tip] Using Wikilinks
> Check out [[Documentation]] and [[API Reference|the API docs]] for more details.

| Component | Status | Notes |
| --- | --- | --- |
| Renderer | ✅ | See [[markdown.tsx]] |
| Tests | ✅ | All passing |
| Docs | ✅ | You're reading them! |

> [!success]
> All Obsidian-style features are now supported!

## Implementation Notes

- Wikilinks are rendered as styled badges (not actual links, as this is for AI chat)
- Callouts support 7 types: note, tip, warning, danger, info, success, question
- Tables support left, center, and right alignment via `:---`, `:---:`, and `---:`
- All features work with existing markdown (bold, italic, code, links, etc.)
- Performance is maintained through efficient regex parsing and caching

