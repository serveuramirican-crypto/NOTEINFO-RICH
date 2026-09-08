/**
 * Applies stored highlights to plain text content and returns HTML.
 * Highlights are sorted by start_offset and rendered as <mark> spans.
 */
export function applyHighlightsToContent(plainText, highlights) {
  if (!plainText) return ''
  if (!highlights || highlights.length === 0) {
    return textToHtml(plainText)
  }

  // Sort by start offset, deduplicate overlaps
  const sorted = [...highlights].sort((a, b) => a.start_offset - b.start_offset)

  let html = ''
  let cursor = 0

  for (const hl of sorted) {
    const start = Math.max(0, hl.start_offset || 0)
    const end = Math.min(plainText.length, hl.end_offset || 0)

    if (start > cursor) {
      // Text before this highlight
      html += escapeHtml(plainText.slice(cursor, start))
    }

    if (end > start) {
      const snippet = plainText.slice(start, end)
      html += `<mark class="hl-${hl.color}" data-hl="${hl.id}" data-color="${hl.color}" title="${hl.note ? hl.note : ''}">${escapeHtml(snippet)}</mark>`
      cursor = end
    }
  }

  // Remaining text after last highlight
  if (cursor < plainText.length) {
    html += escapeHtml(plainText.slice(cursor))
  }

  // Convert newlines to <br>/<p>
  return wrapParagraphs(html)
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function textToHtml(text) {
  return wrapParagraphs(escapeHtml(text))
}

function wrapParagraphs(html) {
  // Split on double newlines for paragraphs, single for <br>
  return html
    .split(/\n\n+/)
    .map(p => `<p style="margin-bottom:1.25em">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('')
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
