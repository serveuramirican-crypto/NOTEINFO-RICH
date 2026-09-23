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

  return htmlBlocks.join('')
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
 * Handles small text, big text spanning multiple lines/paragraphs, blockquotes, and formatting tags.
 */
function applySingleHighlight(root, hl) {
  if (!hl || !hl.text_snippet) return
  const snippet = hl.text_snippet.trim()
  if (!snippet) return

  const doc = root.ownerDocument
  const treeWalker = doc.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    null
  )

  const textNodes = []
  let node
  while ((node = treeWalker.nextNode())) {
    // Skip if already inside a mark for the same highlight
    if (node.parentElement?.closest(`mark[data-hl="${hl.id}"]`)) continue
    textNodes.push(node)
  }

  if (textNodes.length === 0) return

  // Build character-level mapping of non-whitespace characters across all text nodes
  const nonWsChars = []
  textNodes.forEach((tNode, nodeIdx) => {
    const text = tNode.textContent
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (/\S/.test(ch)) {
        nonWsChars.push({
          nodeIdx,
          offset: i,
          char: ch,
        })
      }
    }
  })

  if (nonWsChars.length === 0) return

  const docNonWs = nonWsChars.map(c => c.char).join('')
  const snippetNonWs = snippet.replace(/\s+/g, '')
  if (!snippetNonWs) return

  // Find all matches of snippetNonWs in docNonWs
  let matches = []
  let pos = docNonWs.indexOf(snippetNonWs)
  while (pos !== -1) {
    matches.push(pos)
    pos = docNonWs.indexOf(snippetNonWs, pos + 1)
  }

  // Fallback 1: Unicode NFC normalization
  if (matches.length === 0) {
    const normDoc = docNonWs.normalize('NFC')
    const normSnippet = snippetNonWs.normalize('NFC')
    let nPos = normDoc.indexOf(normSnippet)
    while (nPos !== -1) {
      matches.push(nPos)
      nPos = normDoc.indexOf(normSnippet, nPos + 1)
    }
  }

  // Fallback 2: Normalize quotes, Arabic diacritics, and special punctuation
  if (matches.length === 0) {
    const cleanStr = (s) => s.replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
                             .replace(/[\u2018\u2019]/g, "'")
                             .replace(/[\u064B-\u065F\u0670]/g, '') // remove Arabic tashkeel
    const cleanDoc = cleanStr(docNonWs)
    const cleanSnippet = cleanStr(snippetNonWs)
    let cPos = cleanDoc.indexOf(cleanSnippet)
    while (cPos !== -1) {
      matches.push(cPos)
      cPos = cleanDoc.indexOf(cleanSnippet, cPos + 1)
    }
  }

  if (matches.length === 0) return

  // If multiple occurrences, pick the one closest to hl.start_offset
  let matchStartNonWs = matches[0]
  if (matches.length > 1 && typeof hl.start_offset === 'number' && hl.start_offset >= 0) {
    matches.sort((a, b) => {
      const offA = nonWsChars[a].offset
      const offB = nonWsChars[b].offset
      return Math.abs(offA - hl.start_offset) - Math.abs(offB - hl.start_offset)
    })
    matchStartNonWs = matches[0]
  }

  const startEntry = nonWsChars[matchStartNonWs]
  const endEntry = nonWsChars[matchStartNonWs + snippetNonWs.length - 1]
  if (!startEntry || !endEntry) return

  const startNodeIdx = startEntry.nodeIdx
  const endNodeIdx = endEntry.nodeIdx

  const createMark = (text) => {
    const mark = doc.createElement('mark')
    mark.className = `hl-${hl.color || 'yellow'}`
    mark.setAttribute('data-hl', hl.id || '')
    mark.setAttribute('data-color', hl.color || 'yellow')
    if (hl.note) {
      mark.setAttribute('title', hl.note)
    }
    mark.textContent = text
    return mark
  }

  if (startNodeIdx === endNodeIdx) {
    // Single text node (e.g. small text)
    const targetNode = textNodes[startNodeIdx]
    if (!targetNode || !targetNode.parentNode) return

    const fullText = targetNode.textContent
    const startOff = startEntry.offset
    const endOff = endEntry.offset + 1

    const before = fullText.substring(0, startOff)
    const matched = fullText.substring(startOff, endOff)
    const after = fullText.substring(endOff)

    const parent = targetNode.parentNode
    if (before) parent.insertBefore(doc.createTextNode(before), targetNode)
    parent.insertBefore(createMark(matched), targetNode)
    if (after) parent.insertBefore(doc.createTextNode(after), targetNode)
    parent.removeChild(targetNode)
  } else {
    // Spans multiple text nodes (e.g. big text across lines, paragraphs, blockquotes)
    // 1. First node
    const firstNode = textNodes[startNodeIdx]
    if (firstNode && firstNode.parentNode) {
      const firstFull = firstNode.textContent
      const firstStartOff = startEntry.offset
      const firstBefore = firstFull.substring(0, firstStartOff)
      const firstMatched = firstFull.substring(firstStartOff)

      const firstParent = firstNode.parentNode
      if (firstBefore) firstParent.insertBefore(doc.createTextNode(firstBefore), firstNode)
      firstParent.insertBefore(createMark(firstMatched), firstNode)
      firstParent.removeChild(firstNode)
    }

    // 2. Middle nodes (entire node text is highlighted)
    for (let i = startNodeIdx + 1; i < endNodeIdx; i++) {
      const midNode = textNodes[i]
      if (midNode && midNode.parentNode) {
        const midParent = midNode.parentNode
        midParent.insertBefore(createMark(midNode.textContent), midNode)
        midParent.removeChild(midNode)
      }
    }

    // 3. Last node
    const lastNode = textNodes[endNodeIdx]
    if (lastNode && lastNode.parentNode) {
      const lastFull = lastNode.textContent
      const lastEndOff = endEntry.offset + 1
      const lastMatched = lastFull.substring(0, lastEndOff)
      const lastAfter = lastFull.substring(lastEndOff)

      const lastParent = lastNode.parentNode
      lastParent.insertBefore(createMark(lastMatched), lastNode)
      if (lastAfter) lastParent.insertBefore(doc.createTextNode(lastAfter), lastNode)
      lastParent.removeChild(lastNode)
    }
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

