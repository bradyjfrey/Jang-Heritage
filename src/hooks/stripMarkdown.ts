import { remark } from 'remark'
import strip from 'strip-markdown'

// Removes markdown syntax so the search indexer tokenizes prose, not the
// formatting characters around it. Used on note bodies before nodejieba runs.
export async function stripMarkdown(
  md: string | null | undefined,
): Promise<string> {
  if (!md) return ''
  const result = await remark().use(strip).process(md)
  return String(result).trim()
}
