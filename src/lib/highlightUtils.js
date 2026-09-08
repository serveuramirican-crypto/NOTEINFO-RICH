/**
 * Safely escapes HTML special characters.
 */
function escapeHtml(text) {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Checks if a string contains strong RTL characters (Arabic, Hebrew, etc.)
 */
export function isRTL(text) {
  if (!text) return false
  const rtlRegex = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/
  return rtlRegex.test(text)
}

/**
 * Renders inline markdown tokens into HTML:
 * - Timestamps: **(00:00)** or (00:00)
 * - Bold: **text**
 * - Italic: *text* or _text_
 * - Code: `code`
 * - Links: [text](url)
 */
function renderInlineMarkdown(text) {
  if (!text) return ''

  // 1. Timestamps: **(00:00)** or (00:00) or **(01:23:45)**
  let rendered = text.replace(
    /\*\*\(([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)\)\*\*/g,
    '<span class="timestamp-chip">($1)</span>'
  )

  // 2. Bold: **text**
  rendered = rendered.replace(
    /\*\*(.+?)\*\*/g,
    '<strong class="font-bold text-surface-900 dark:text-surface-100">$1</strong>'
  )

  // 3. Italic: *text* or _text_
  rendered = rendered.replace(
    /(^|[^\*])\*([^\*\n]+?)\*([^\*]|$)/g,
    '$1<em class="italic">$2</em>$3'
  )
  rendered = rendered.replace(
    /(^|[^_])_([^_\n]+?)_([^_]|$)/g,
    '$1<em class="italic">$2</em>$3'
  )

  // 4. Inline code: `code`
  rendered = rendered.replace(
    /`([^`\n]+?)`/g,
    '<code class="px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-brand-600 dark:text-brand-400 font-mono text-xs">$1</code>'
  )

  // 5. Links: [label](url)
  rendered = rendered.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-brand-500 underline hover:text-brand-600">$1</a>'
  )

  // 6. Single newline inside block -> <br />
  rendered = rendered.replace(/\n/g, '<br />')

  return rendered
}

/**
 * Parses markdown blocks and returns HTML with proper bidirectional (dir="auto") attributes.
 */
function parseMarkdownToHtml(rawText) {
  if (!rawText) return ''

  // Normalize line endings
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Split by double newlines into block elements
  const blocks = normalized.split(/\n\n+/)
  const htmlBlocks = []

  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue

    // Horizontal Rule: ---, ***, ___
    if (/^(\-{3,}|\*{3,}|\_{3,})$/.test(trimmed)) {
      htmlBlocks.push('<hr class="lesson-hr" />')
      continue
    }

    // Standalone Timestamp: **(00:00)** or (00:00) or **(01:23:45)**
    const timestampMatch = trimmed.match(/^(?:\*\*)?\(?(\d{1,2}:\d{2}(?::\d{2})?)\)?(?:\*\*)?$/)
    if (timestampMatch) {
      htmlBlocks.push(
        `<div dir="auto" class="lesson-timestamp my-3"><span class="timestamp-chip">(${timestampMatch[1]})</span></div>`
      )
      continue
    }

    // Heading 1: # Title
    if (/^#\s+(.+)$/.test(trimmed)) {
      const content = trimmed.replace(/^#\s+/, '')
      htmlBlocks.push(
        `<h1 dir="auto" class="text-2xl font-bold mt-6 mb-3 text-surface-900 dark:text-surface-100">${renderInlineMarkdown(content)}</h1>`
      )
      continue
    }

    // Heading 2: ## Title
    if (/^##\s+(.+)$/.test(trimmed)) {
      const content = trimmed.replace(/^##\s+/, '')
      htmlBlocks.push(
        `<h2 dir="auto" class="text-xl font-bold mt-5 mb-2.5 text-surface-900 dark:text-surface-100">${renderInlineMarkdown(content)}</h2>`
      )
      continue
    }

    // Heading 3: ### Title
    if (/^###\s+(.+)$/.test(trimmed)) {
      const content = trimmed.replace(/^###\s+/, '')
      htmlBlocks.push(
        `<h3 dir="auto" class="text-lg font-bold mt-4 mb-2 text-surface-900 dark:text-surface-100">${renderInlineMarkdown(content)}</h3>`
      )
      continue
    }

    // Blockquote: > Quote
    if (/^>\s+(.+)$/s.test(trimmed)) {
      const content = trimmed.replace(/^>\s+/gm, '')
      htmlBlocks.push(
        `<blockquote dir="auto" class="border-l-4 border-brand-500 pl-4 py-1 my-3 text-surface-600 dark:text-surface-400 italic bg-surface-50 dark:bg-surface-800/40 rounded-r-lg">${renderInlineMarkdown(content)}</blockquote>`
      )
      continue
    }

    // List item lines
    if (/^(\-|\*|\d+\.)\s+/.test(trimmed)) {
      const lines = trimmed.split('\n')
      const listItems = lines.map(line => {
        const itemText = line.replace(/^(\-|\*|\d+\.)\s+/, '')
        return `<li dir="auto" class="my-1">${renderInlineMarkdown(itemText)}</li>`
      }).join('')
      htmlBlocks.push(`<ul class="list-disc list-inside my-3 space-y-1">${listItems}</ul>`)
      continue
    }

    // Regular paragraph
    htmlBlocks.push(
      `<p dir="auto" class="lesson-paragraph">${renderInlineMarkdown(block)}</p>`
    )
  }

  return htmlBlocks.join('\n')
}

/**
 * Applies stored highlights to plain text content and returns HTML.
 * Highlights are sorted by start_offset and rendered as <mark> spans.
 */
export function applyHighlightsToContent(plainText, highlights = []) {
  if (!plainText) return ''

  if (!highlights || highlights.length === 0) {
    return parseMarkdownToHtml(escapeHtml(plainText))
  }

  // Sort by start offset descending so we insert tags from end to start without breaking prior offsets
  const validHighlights = [...highlights]
    .filter(h => h.start_offset !== undefined && h.end_offset !== undefined && h.end_offset > h.start_offset)
    .sort((a, b) => b.start_offset - a.start_offset)

  let markedText = plainText

  for (const hl of validHighlights) {
    const start = Math.max(0, hl.start_offset)
    const end = Math.min(markedText.length, hl.end_offset)
    if (end > start) {
      const before = markedText.slice(0, start)
      const snippet = markedText.slice(start, end)
      const after = markedText.slice(end)
      const markPlaceholder = `___MARK_START_${hl.color}_${hl.id}_${encodeURIComponent(hl.note || '')}___${snippet}___MARK_END___`
      markedText = before + markPlaceholder + after
    }
  }

  // Escape HTML on the text
  let escaped = escapeHtml(markedText)

  // Restore <mark> tags
  escaped = escaped.replace(
    /___MARK_START_([a-z]+)_([a-zA-Z0-9\-]+)_(.*?)___([\s\S]*?)___MARK_END___/g,
    (_, color, id, encodedNote, snippet) => {
      const note = decodeURIComponent(encodedNote || '')
      return `<mark class="hl-${color}" data-hl="${id}" data-color="${color}" title="${escapeHtml(note)}">${snippet}</mark>`
    }
  )

  return parseMarkdownToHtml(escaped)
}

/**
 * Given a DOM Range inside a plain-text content element, 
 * compute character offsets from the element's textContent.
 */
export function getRangeOffsets(range, containerEl) {
  const treeWalker = document.createTreeWalker(
    containerEl,
    NodeFilter.SHOW_TEXT,
    null
  )
  let offset = 0
  let start = 0
  let end = 0
  let node

  while ((node = treeWalker.nextNode())) {
    const len = node.textContent.length
    if (node === range.startContainer) {
      start = offset + range.startOffset
    }
    if (node === range.endContainer) {
      end = offset + range.endOffset
      break
    }
    offset += len
  }

  return { start, end }
}
