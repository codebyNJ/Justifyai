"use client"

import { Badge } from "@/components/ui/badge"
import { TrendingUp, Calendar, Hash, CheckCircle2, AlertCircle, Clock } from "lucide-react"

// Updated interfaces to match your new API structure
interface FormattedContent {
  concise?: string
  detailed?: string
}

interface GeneratedMedia {
  images?: any[]
}

interface JustifyAIResponse {
  original_query?: string
  session_id?: string
  formatted_content?: FormattedContent
  generated_media?: GeneratedMedia
  proof?: string[]
  processing_timestamp?: number // seconds epoch
  status?: string
}

// New simplified API response structure
interface ApiResponse {
  justifyai_response?: JustifyAIResponse
}

interface MessageFormatterProps {
  content: string
  isUser: boolean
}

function safeParse(content: string): ApiResponse | null {
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}

function isDataUrl(str: string) {
  return typeof str === "string" && /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(str.trim())
}

function normalizeBase64(input: string): string {
  if (!input || typeof input !== "string") return ""
  const trimmed = input.trim()
  if (isDataUrl(trimmed)) return trimmed
  // Remove potential prefixes like "base64," and any whitespace/newlines
  const withoutPrefix = trimmed.replace(/^base64,/i, "")
  const cleaned = withoutPrefix.replace(/\s+/g, "")
  return cleaned
}

function toDataUrl(b64: string, mime = "image/png") {
  const normalized = normalizeBase64(b64)
  if (!normalized) return ""
  return isDataUrl(normalized) ? normalized : `data:${mime};base64,${normalized}`
}

type AnyObject = Record<string, any>

function collectImagesFrom(obj: AnyObject | any[] | unknown): { src: string; mime: string }[] {
  const out: { src: string; mime: string }[] = []
  if (!obj) return out

  const pushMaybe = (value: any, mime?: string) => {
    if (typeof value === "string") {
      const src = toDataUrl(value, mime || "image/png")
      if (src)
        out.push({ src, mime: mime || (isDataUrl(value) ? value.split(";")[0].replace("data:", "") : "image/png") })
    } else if (value && typeof value === "object") {
      const v = value as AnyObject
      const mimeType = v.type || v.mime || v.mimetype || "image/png"
      // Common fields where base64 might live
      if (v.error || v.format === "error") return
      const s = v.base64_data || v.b64 || v.base64 || v.image_base64 || v.data || v.image || v.content
      if (typeof s === "string" && s.trim().length > 0) {
        pushMaybe(s, mimeType)
        return
      }
      if (typeof v.size_bytes === "number" && v.size_bytes === 0) return
      // Some APIs nest base64 under a payload or attributes property
      if (!s && v.payload && typeof v.payload === "object") {
        const p = v.payload as AnyObject
        const ps = p.b64 || p.base64 || p.image_base64 || p.data || p.image || p.content
        if (typeof ps === "string") pushMaybe(ps, p.type || p.mime || mimeType)
      }
    }
  }

  if (Array.isArray(obj)) {
    obj.forEach((item) => pushMaybe(item))
    return out
  }

  const o = obj as AnyObject
  ;["base64_data", "image_base64", "base64", "b64", "data", "image", "content"].forEach((k) => pushMaybe(o[k]))
  ;["images", "generated_media", "media", "items", "results", "outputs"].forEach((k) => {
    if (o[k]) {
      if (Array.isArray(o[k])) o[k].forEach((item: any) => pushMaybe(item))
      else pushMaybe(o[k])
    }
  })

  return out
}

function extractInlineDataUrls(text: string): string[] {
  if (typeof text !== "string") return []
  const matches = text.match(/data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+/g) || []
  return matches
}

// Try to detect raw base64 image payloads embedded in text (without data: prefix)
function extractRawBase64Images(text: string): { src: string; mime: string }[] {
  if (typeof text !== "string") return []
  const out: { src: string; mime: string }[] = []
  const candidates: Array<{ startRegex: RegExp; mime: string }> = [
    { startRegex: /iVBORw0KGgo[\w+/=\s]{50,}/, mime: "image/png" },
    { startRegex: /\/9j\/[\w+/=\s]{50,}/, mime: "image/jpeg" },
    { startRegex: /R0lGOD[\w+/=\s]{50,}/, mime: "image/gif" },
    { startRegex: /UklGR[\w+/=\s]{50,}/, mime: "image/webp" },
  ]
  for (const { startRegex, mime } of candidates) {
    const regex = new RegExp(startRegex.source, "g")
    let m: RegExpExecArray | null
    while ((m = regex.exec(text)) != null) {
      const b64raw = m[0].replace(/\s+/g, "")
      const src = toDataUrl(b64raw, mime)
      if (src) out.push({ src, mime })
    }
  }
  return out
}

function getStatusIcon(status?: string) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="w-3 h-3 text-green-400" />
    case 'error':
      return <AlertCircle className="w-3 h-3 text-red-400" />
    case 'timeout':
      return <Clock className="w-3 h-3 text-yellow-400" />
    default:
      return <TrendingUp className="w-3 h-3" />
  }
}

function getStatusColor(status?: string) {
  switch (status) {
    case 'success':
      return 'bg-green-500/10 border-green-500/20 text-green-300'
    case 'error':
      return 'bg-red-500/10 border-red-500/20 text-red-300'
    case 'timeout':
      return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300'
    default:
      return 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300'
  }
}

export function MessageFormatter({ content, isUser }: MessageFormatterProps) {
  console.log('MessageFormatter received content:', content)
  console.log('MessageFormatter isUser:', isUser)
  
  const data = safeParse(content)
  console.log('MessageFormatter parsed data:', data)
  
  if (isUser) {
    return <div className="text-sm text-cyan-50 leading-relaxed whitespace-pre-wrap break-words">{content}</div>
  }

  // Debug: Check if we have justifyai_response
  if (!data) {
    console.log('No parsed data, showing fallback')
    return <div className="text-sm text-white leading-relaxed whitespace-pre-wrap break-words">{content}</div>
  }

  if (!data.justifyai_response) {
    console.log('No justifyai_response found, showing fallback. Data keys:', Object.keys(data))
    return <div className="text-sm text-white leading-relaxed whitespace-pre-wrap break-words">{content}</div>
  }

  const response = data.justifyai_response
  console.log('Processing justifyai_response:', response)
  
  const sessionId = response.session_id || ""
  const originalQuery = response.original_query || ""
  const status = response.status || "unknown"
  
  console.log('Extracted values:', { sessionId, originalQuery, status })
  
  // Convert processing_timestamp (seconds) to Date
  const tsDate = response.processing_timestamp 
    ? new Date(response.processing_timestamp * 1000)
    : new Date()
  const tsDisplay = isNaN(tsDate.getTime()) ? new Date().toLocaleString() : tsDate.toLocaleString()

  // Get response text from formatted_content and normalize to string
  let responseTextRaw: unknown = response.formatted_content?.detailed || response.formatted_content?.concise || ""
  const responseText =
    typeof responseTextRaw === "string"
      ? responseTextRaw
      : responseTextRaw == null
        ? ""
        : (() => {
            try {
              return JSON.stringify(responseTextRaw)
            } catch {
              return String(responseTextRaw)
            }
          })()
  console.log('Response text:', responseText)
  console.log('Response text length:', responseText.length)
  
  const proofs = Array.isArray(response.proof) ? response.proof : []
  console.log('Proofs:', proofs)

  // Extract images from generated_media
  const images: { src: string; mime: string }[] = [
    ...collectImagesFrom(response.generated_media?.images as any),
    ...collectImagesFrom(response.generated_media as any),
  ]
  console.log('Images found:', images.length)
  
  // Also check if response text contains images
  extractInlineDataUrls(responseText).forEach((src) => {
    images.push({ src, mime: src.split(";")[0].replace("data:", "") })
  })
  extractRawBase64Images(responseText).forEach((img) => {
    images.push(img)
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 mb-1">
        <Badge variant="outline" className="text-xs bg-white/5 border-white/10 text-white/80">
          <Hash className="w-3 h-3 mr-1" />
          {sessionId ? `${sessionId.slice(0, 8)}...` : "session"}
        </Badge>
        
        <Badge variant="outline" className={`text-xs ${getStatusColor(status)}`}>
          {getStatusIcon(status)}
          <span className="ml-1">{status}</span>
        </Badge>
        
        <Badge variant="outline" className="text-xs bg-white/5 border-white/10 text-white/80">
          <Calendar className="w-3 h-3 mr-1" />
          {tsDisplay}
        </Badge>
      </div>

      {originalQuery && (
        <div className="text-xs text-zinc-400 italic mb-2">
          Query: "{originalQuery}"
        </div>
      )}

      {/* Debug: Always show something to confirm component is rendering */}
      <div className="text-xs text-yellow-300 mb-2 border border-yellow-500/30 p-2 rounded">
        Debug: Response text exists: {responseText ? 'YES' : 'NO'} | Length: {responseText.length}
      </div>

      <div className="formatted-content overflow-x-auto scrollbar-none">
        {responseText ? (
          <div
            className="prose prose-invert prose-sm max-w-none
              prose-headings:text-white prose-headings:font-brand
              prose-p:text-white prose-p:leading-relaxed
              prose-strong:text-white prose-strong:font-semibold
              prose-a:text-cyan-300 hover:prose-a:text-cyan-200 underline-offset-4
              prose-table:text-white prose-th:text-white prose-td:text-white
              prose-td:border-white/10 prose-th:border-white/20
              prose-ul:text-white prose-li:text-white"
            dangerouslySetInnerHTML={{ __html: formatMarkdownContent(responseText) }}
          />
        ) : (
          <div className="text-white">No response text found</div>
        )}
      </div>

      {images.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-white/90 mb-3">Generated Images</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {images.map((img, i) => (
              <div
                key={`${img.src.slice(0, 32)}-${i}`}
                className="rounded-lg overflow-hidden border border-white/10 bg-white/5 backdrop-blur-sm"
              >
                <img
                  src={img.src || "/placeholder.svg"}
                  alt={`Generated image ${i + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="block w-full h-auto"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {proofs.length > 0 && (
        <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3">
          <h4 className="text-sm font-medium text-white/90 mb-2">Sources & Proof</h4>
          <ul className="space-y-2">
            {proofs.map((url, index) => {
              let label = url
              try {
                const u = new URL(url)
                label = u.hostname.replace(/^www\./, "") + u.pathname.substring(0, 40) + (u.pathname.length > 40 ? "…" : "")
              } catch {
                // keep original label if URL parsing fails
              }
              return (
                <li key={`${url}-${index}`} className="text-xs">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-300 hover:text-cyan-200 underline decoration-cyan-400/60 underline-offset-4 break-all"
                  >
                    {label}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function formatMarkdownContent(content: string): string {
  if (!content || typeof content !== 'string') {
    console.log('formatMarkdownContent received invalid content:', content)
    return ""
  }
  
  console.log('formatMarkdownContent processing:', content.substring(0, 100))
  
  // Markdown links: [text](url)
  content = content.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline decoration-cyan-400/60 hover:text-cyan-300">$1</a>',
  )
  content = linkifyPreservingAnchors(content)
  
  // Convert markdown tables to HTML
  content = content.replace(/\|(.+)\|/g, (match, row) => {
    const cells = row
      .split("|")
      .map((cell: string) => cell.trim())
      .filter((cell: string) => cell)
    return `<tr>${cells.map((cell: string) => `<td class="px-3 py-2 align-top">${cell}</td>`).join("")}</tr>`
  })

  // Wrap tables
  content = content.replace(
    /(<tr>[\s\S]*<\/tr>)/g,
    '<table class="w-full table-fixed border-collapse border border-white/10 rounded-lg overflow-hidden my-4"><tbody>$1</tbody></table>',
  )

  // Convert markdown formatting
  content = content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
  content = content.replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-6 mb-3 text-white font-brand">$1</h3>')
  content = content.replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-6 mb-4 text-white font-brand">$1</h2>')
  content = content.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-6 mb-4 text-white font-brand">$1</h1>')

  // Convert bullet points
  content = content.replace(/^\* (.*$)/gm, '<li class="ml-4 mb-1">• $1</li>')
  content = content.replace(/(<li[\s\S]*<\/li>)/g, '<ul class="space-y-1 my-3">$1<\/ul>')

  // Convert line breaks - but preserve existing content
  content = content.replace(/\n\n/g, '</p><p class="mb-3">')
  if (content.trim()) {
    content = `<p class="mb-3">${content}</p>`
  }

  console.log('formatMarkdownContent result:', content.substring(0, 200))
  return content
}

function linkifyPreservingAnchors(html: string): string {
  const parts = html.split(/(<a [^>]+>[\s\S]*?<\/a>)/gi)
  return parts
    .map((part) => {
      if (/^<a\s/i.test(part)) return part
      return part.replace(
        /(https?:\/\/[^\s<)]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer" class="underline decoration-cyan-400/60 hover:text-cyan-300">$1<\/a>',
      )
    })
    .join("")
}