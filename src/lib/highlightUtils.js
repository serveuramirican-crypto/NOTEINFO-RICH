/**
 * Safely escapes HTML special characters.
 */
export function escapeHtml(text) {
  if (!text) return ''
  return String(text)
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
export function parseMarkdownToHtml(rawText) {
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
        `<h1 dir="auto" class="text-2xl font-bold mt-6 mb-3 text-surface-900 dark:text-surface-100">${renderInlineMarkdown(escapeHtml(content))}</h1>`
      )
      continue
    }

    // Heading 2: ## Title
    if (/^##\s+(.+)$/.test(trimmed)) {
      const content = trimmed.replace(/^##\s+/, '')
      htmlBlocks.push(
        `<h2 dir="auto" class="text-xl font-bold mt-5 mb-2.5 text-surface-900 dark:text-surface-100">${renderInlineMarkdown(escapeHtml(content))}</h2>`
      )
      continue
    }

    // Heading 3: ### Title
    if (/^###\s+(.+)$/.test(trimmed)) {
      const content = trimmed.replace(/^###\s+/, '')
      htmlBlocks.push(
        `<h3 dir="auto" class="text-lg font-bold mt-4 mb-2 text-surface-900 dark:text-surface-100">${renderInlineMarkdown(escapeHtml(content))}</h3>`
      )
      continue
    }

    // Blockquote: > Quote
    if (/^>\s+(.+)$/s.test(trimmed)) {
      const content = trimmed.replace(/^>\s+/gm, '')
      htmlBlocks.push(
        `<blockquote dir="auto" class="border-l-4 border-brand-500 pl-4 py-1 my-3 text-surface-600 dark:text-surface-400 italic bg-surface-50 dark:bg-surface-800/40 rounded-r-lg">${renderInlineMarkdown(escapeHtml(content))}</blockquote>`
      )
      continue
    }

    // List item lines
    if (/^(\-|\*|\d+\.)\s+/.test(trimmed)) {
      const lines = trimmed.split('\n')
      const listItems = lines.map(line => {
        const itemText = line.replace(/^(\-|\*|\d+\.)\s+/, '')
        return `<li dir="auto" class="my-1">${renderInlineMarkdown(escapeHtml(itemText))}</li>`
      }).join('')
      htmlBlocks.push(`<ul class="list-disc list-inside my-3 space-y-1">${listItems}</ul>`)
      continue
    }

    // Regular paragraph
    htmlBlocks.push(
      `<p dir="auto" class="lesson-paragraph">${renderInlineMarkdown(escapeHtml(block))}</p>`
    )
  }

  return htmlBlocks.join('\n')
}

/**
 * Given a DOM Range inside a container, compute character offsets from container.textContent.
 */
export function getRangeOffsets(range, containerEl) {
  if (!range || !containerEl) return { start: 0, end: 0 }

  try {
    const preRange = range.cloneRange()
    preRange.selectNodeContents(containerEl)
    preRange.setEnd(range.startContainer, range.startOffset)
    const start = preRange.toString().length
    const end = start + range.toString().length
    return { start, end }
  } catch {
    return { start: 0, end: 0 }
  }
}

/**
 * Applies a single highlight onto a DOM container (e.g. root element in DOMParser).
 */
function applySingleHighlight(root, hl) {
  if (!hl || !hl.text_snippet) return
  const snippet = hl.text_snippet

  // Collect text nodes and their cumulative text offsets
  const treeWalker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    null
  )

  const textNodes = []
  let cumulative = 0
  let node
  while ((node = treeWalker.nextNode())) {
    // Skip if already inside a mark for the same highlight
    if (node.parentElement?.closest(`mark[data-hl="${hl.id}"]`)) continue

    const len = node.textContent.length
    textNodes.push({
      node,
      start: cumulative,
      end: cumulative + len,
      length: len,
      text: node.textContent,
    })
    cumulative += len
  }

  const fullDocText = textNodes.map(t => t.text).join('')
  if (!fullDocText) return

  // Find the match position in fullDocText
  let matchStart = -1

  // 1. Check if snippet matches at hl.start_offset
  if (typeof hl.start_offset === 'number' && hl.start_offset >= 0) {
    if (fullDocText.substring(hl.start_offset, hl.start_offset + snippet.length) === snippet) {
      matchStart = hl.start_offset
    }
  }

  // 2. If not matched at exact start_offset, find all occurrences of snippet in fullDocText
  if (matchStart === -1) {
    const indices = []
    let pos = fullDocText.indexOf(snippet)
    while (pos !== -1) {
      indices.push(pos)
      pos = fullDocText.indexOf(snippet, pos + 1)
    }

    if (indices.length > 0) {
      if (typeof hl.start_offset === 'number' && hl.start_offset >= 0) {
        // Pick the occurrence closest to hl.start_offset
        indices.sort((a, b) => Math.abs(a - hl.start_offset) - Math.abs(b - hl.start_offset))
        matchStart = indices[0]
      } else {
        matchStart = indices[0]
      }
    }
  }

  // 3. Fallback: normalized search (ignoring excessive whitespace/newlines)
  if (matchStart === -1) {
    const cleanSnippet = snippet.trim().replace(/\s+/g, ' ')
    const cleanDoc = fullDocText.replace(/\s+/g, ' ')
    const cleanPos = cleanDoc.indexOf(cleanSnippet)
    if (cleanPos !== -1) {
      matchStart = cleanPos
    }
  }

  if (matchStart === -1) return

  const matchEnd = matchStart + snippet.length

  // Find overlapping text nodes and wrap matched portions
  const nodesToProcess = textNodes.filter(t => t.end > matchStart && t.start < matchEnd)

  for (const entry of nodesToProcess) {
    const { node: currNode, start: nodeStart, length: nodeLen, text: nodeText } = entry
    if (!currNode.parentNode) continue

    const sliceStart = Math.max(0, matchStart - nodeStart)
    const sliceEnd = Math.min(nodeLen, matchEnd - nodeStart)

    if (sliceStart >= sliceEnd) continue

    const beforeText = nodeText.substring(0, sliceStart)
    const matchedText = nodeText.substring(sliceStart, sliceEnd)
    const afterText = nodeText.substring(sliceEnd)

    const doc = root.ownerDocument
    const mark = doc.createElement('mark')
    mark.className = `hl-${hl.color || 'yellow'}`
    mark.setAttribute('data-hl', hl.id || '')
    mark.setAttribute('data-color', hl.color || 'yellow')
    if (hl.note) {
      mark.setAttribute('title', hl.note)
    }
    mark.textContent = matchedText

    const parent = currNode.parentNode
    if (beforeText) {
      parent.insertBefore(doc.createTextNode(beforeText), currNode)
    }
    parent.insertBefore(mark, currNode)
    if (afterText) {
      parent.insertBefore(doc.createTextNode(afterText), currNode)
    }
    parent.removeChild(currNode)
  }
}

/**
 * Applies stored highlights to plain text content and returns safe HTML.
 */
export function applyHighlightsToContent(plainText, highlights = []) {
  if (!plainText) return ''

  const baseHtml = parseMarkdownToHtml(plainText)
  if (!highlights || highlights.length === 0) {
    return baseHtml
  }

  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return baseHtml
  }

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div id="__hl_root">${baseHtml}</div>`, 'text/html')
    const hlRoot = doc.getElementById('__hl_root')
    if (!hlRoot) return baseHtml

    // Apply highlights
    const validHighlights = [...highlights].filter(
      h => h && h.text_snippet && h.text_snippet.trim().length > 0
    )

    for (const hl of validHighlights) {
      applySingleHighlight(hlRoot, hl)
    }

    return hlRoot.innerHTML
  } catch (err) {
    console.error('Error applying highlights:', err)
    return baseHtml
  }
}

