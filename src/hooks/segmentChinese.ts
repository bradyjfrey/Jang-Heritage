import nodejieba from 'nodejieba'

// nodejieba 3.x dropped automatic dictionary loading; load() must be called
// before cut/cutForSearch returns word-level tokens. Loading once at module
// init keeps the cost out of every save.
nodejieba.load()

// Matches a contiguous run of CJK characters (Unified ideographs + Compatibility ideographs).
const CJK_RUN = /[㐀-䶿一-鿿豈-﫿]+/g

// Splits text into alternating CJK / non-CJK runs, segments CJK runs with
// nodejieba, leaves Latin / punctuation runs alone, then rejoins with spaces.
//
// Why the split: nodejieba.cutForSearch on mixed-script text (e.g. note bodies
// with English + 中文 inline) returns the English portion character-by-character,
// which destroys word boundaries. Splitting first preserves them.
//
// Limitation: the bundled dictionary is Simplified Chinese. Traditional
// characters fall through to single-char tokens, which still works for
// tsvector indexing but is less precise than proper word segmentation.
// Future option: ship a Traditional dict, or convert via opencc on save.
export function segmentChinese(text: string | null | undefined): string {
  if (!text) return ''
  const parts: string[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  CJK_RUN.lastIndex = 0
  while ((match = CJK_RUN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    parts.push(nodejieba.cutForSearch(match[0]).join(' '))
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}
