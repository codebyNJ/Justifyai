"use client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Brain, Link, Folder, Mic, Send } from "lucide-react"
import { LiquidMetal, PulsingBorder } from "@paper-design/shaders-react"
import { motion } from "framer-motion"
import { useState, useRef, useEffect } from "react"
import { MessageFormatter } from "./message-formatter"
import { auth, db, listenAuth } from "@/lib/firebase"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

export function ChatInterface() {
  const [isFocused, setIsFocused] = useState(false)
  const [textValue, setTextValue] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(auth.currentUser)

  useEffect(() => {
    const unsub = listenAuth(setUser)
    return () => unsub()
  }, [])

  // Updated progress steps to be more generic
  const steps = ["Processing query", "Analyzing content", "Generating response", "Finalizing"]
  const [progressStep, setProgressStep] = useState(0)
  const progressTimer = useRef<number | null>(null)

  const handleSend = async () => {
    if (!textValue.trim() || loading) return
    if (!user) {
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: textValue,
      role: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setTextValue("")
    setLoading(true)

    try {
      setProgressStep(0)
      if (progressTimer.current) {
        clearInterval(progressTimer.current)
      }
      progressTimer.current = window.setInterval(() => {
        setProgressStep((prev) => (prev + 1) % steps.length)
      }, 1200)

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          user_id: user?.uid || `web-${Math.random().toString(36).slice(2, 10)}`,
          generate_image: true,
        }),
      })

      console.log("[v0] /api/chat status:", res.status)
      const ct = (res.headers.get("content-type") || "").toLowerCase()
      console.log("[v0] /api/chat content-type:", ct)

      let data: any = null
      let content = ""
      let sessionId = ""
      let responseTextVal = ""

      try {
        if (ct.includes("application/json")) {
          data = await res.json()
        } else {
          const rawBody = await res.text()
          try {
            data = JSON.parse(rawBody)
          } catch {
            data = {
              justifyai_response: {
                original_query: userMessage.content,
                session_id: "",
                formatted_content: {
                  concise: rawBody || "Empty response from server",
                  detailed: rawBody || "Empty response from server",
                },
                generated_media: { images: [] },
                proof: [],
                processing_timestamp: Date.now() / 1000,
                status: res.ok ? "success" : "error",
              },
            }
          }
        }

        if (!data?.justifyai_response) {
          data = {
            justifyai_response: {
              original_query: userMessage.content,
              session_id: data?.session_id || `session-${Date.now()}`,
              formatted_content: {
                concise:
                  data?.response ||
                  data?.content ||
                  data?.answer ||
                  (typeof data === "string" ? data : JSON.stringify(data)),
                detailed:
                  data?.detailed_response ||
                  data?.response ||
                  data?.content ||
                  data?.answer ||
                  (typeof data === "string" ? data : JSON.stringify(data)),
              },
              generated_media: { images: data?.images || data?.generated_images || [] },
              proof: Array.isArray(data?.sources)
                ? data.sources
                : Array.isArray(data?.proof)
                  ? data.proof
                  : Array.isArray(data?.references)
                    ? data.references
                    : [],
              processing_timestamp: data?.timestamp || Date.now() / 1000,
              status: data?.status || (res.ok ? "success" : "error"),
            },
          }
        }

        content = JSON.stringify(data)
        sessionId = data.justifyai_response?.session_id || ""
        responseTextVal =
          data.justifyai_response?.formatted_content?.detailed ||
          data.justifyai_response?.formatted_content?.concise ||
          ""
      } catch (parseError) {
        console.error("[v0] Failed to parse API response:", parseError)
        const errorText =
          parseError instanceof Error && parseError.message
            ? `Failed to parse API response: ${parseError.message}`
            : "Failed to parse API response"

        data = {
          justifyai_response: {
            original_query: userMessage.content,
            session_id: "",
            formatted_content: {
              concise: errorText,
              detailed: errorText,
            },
            generated_media: { images: [] },
            proof: [],
            processing_timestamp: Date.now() / 1000,
            status: "error",
          },
        }
        content = JSON.stringify(data)
        sessionId = ""
        responseTextVal = errorText
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content,
        role: "assistant",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])

      if (user) {
        try {
          const generatedImages = data?.justifyai_response?.generated_media?.images
          const generatedImagesCount = Array.isArray(generatedImages) ? generatedImages.length : 0
          const flatPayload = {
            original_query: data?.justifyai_response?.original_query || userMessage.content,
            session_id: sessionId,
            status: data?.justifyai_response?.status || (res.ok ? "success" : "error"),
            processing_timestamp: data?.justifyai_response?.processing_timestamp || Date.now() / 1000,
            formatted_content_concise: data?.justifyai_response?.formatted_content?.concise || "",
            formatted_content_detailed: data?.justifyai_response?.formatted_content?.detailed || "",
            generated_images_count: generatedImagesCount,
            proof_sources: Array.isArray(data?.justifyai_response?.proof) ? data.justifyai_response.proof : [],
          }
          await addDoc(collection(db, "users", user.uid, "chats"), {
            message: userMessage.content,
            response: responseTextVal,
            session_id: sessionId,
            ...flatPayload,
            createdAt: serverTimestamp(),
          })
        } catch (dbErr) {
          console.error("[v0] Firestore write failed (non-fatal):", dbErr)
        }
      }
    } catch (err) {
      console.error("[v0] Network error:", err)
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        content: JSON.stringify({
          justifyai_response: {
            original_query: userMessage.content,
            session_id: "",
            formatted_content: {
              concise: "We hit a snag connecting to the server. Please try again.",
              detailed: "We hit a snag connecting to the server. Please try again.",
            },
            generated_media: { images: [] },
            proof: [],
            processing_timestamp: Date.now() / 1000,
            status: "network_error",
          },
        }),
        role: "assistant",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])

      if (user) {
        try {
          await addDoc(collection(db, "users", user.uid, "chats"), {
            message: userMessage.content,
            response: "Network error occurred",
            session_id: "",
            status: "network_error",
            original_query: userMessage.content,
            processing_timestamp: Date.now() / 1000,
            formatted_content_concise: "We hit a snag connecting to the server. Please try again.",
            formatted_content_detailed: "We hit a snag connecting to the server. Please try again.",
            generated_images_count: 0,
            proof_sources: [],
            createdAt: serverTimestamp(),
          })
        } catch (dbErr) {
          console.error("[v0] Firestore write failed (non-fatal):", dbErr)
        }
      }
    } finally {
      if (progressTimer.current) {
        clearInterval(progressTimer.current)
        progressTimer.current = null
      }
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-stretch justify-start w-full overflow-x-hidden">
      <div className="w-full max-w-3xl md:max-w-4xl lg:max-w-5xl mx-auto relative px-4 sm:px-6 md:px-8 pt-24">
        {messages.length > 0 ? (
          <div className="mb-6 space-y-4 max-h-[65vh] sm:max-h-[70vh] overflow-y-auto overflow-x-hidden pr-2 -mr-2 scrollbar-none overscroll-contain">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] break-words formatted-content ${
                    message.role === "user"
                      ? "bg-cyan-600/20 border-cyan-500/40 text-cyan-50 rounded-2xl p-4 border backdrop-blur-sm"
                      : "bg-transparent text-white p-0"
                  }`}
                >
                  <MessageFormatter content={message.content} isUser={message.role === "user"} />
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  {steps.map((label, idx) => (
                    <div key={label} className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          idx <= progressStep ? "bg-cyan-400 animate-pulse" : "bg-zinc-600"
                        }`}
                        aria-hidden="true"
                      />
                      <span className={idx === progressStep ? "text-cyan-300" : ""}>{label}</span>
                      {idx < steps.length - 1 && <span className="text-zinc-600">›</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row items-center sm:items-center mb-4 sm:mb-2 gap-3 sm:gap-0">
              <motion.div
                id="circle-ball"
                className="relative flex items-center justify-center z-10 flex-shrink-0"
                animate={{
                  y: isFocused ? 50 : 0,
                  opacity: isFocused ? 0 : 100,
                  filter: isFocused ? "blur(4px)" : "blur(0px)",
                  rotation: isFocused ? 180 : 0,
                }}
                transition={{
                  duration: 0.5,
                  type: "spring",
                  stiffness: 200,
                  damping: 20,
                }}
              >
                <div className="z-10 absolute bg-white/5 h-9 w-9 rounded-full backdrop-blur-[3px]">
                  <div className="h-[2px] w-[2px] bg-white rounded-full absolute top-3 left-3  blur-[1px]" />
                  <div className="h-[2px] w-[2px] bg-white rounded-full absolute top-2 left-6  blur-[0.8px]" />
                  <div className="h-[2px] w-[2px] bg-white rounded-full absolute top-6 left-2  blur-[1px]" />
                  <div className="h-[2px] w-[2px] bg-white rounded-full absolute top-4 left-7 blur-[0.8px]" />
                  <div className="h-[2px] w-[2px] bg-white rounded-full absolute top-5 left-5  blur-[1px]" />
                </div>
                <LiquidMetal
                  style={{ height: 60, width: 60, filter: "blur(12px)", position: "absolute" }}
                  colorBack="hsl(0, 0%, 0%, 0)"
                  colorTint="hsl(190, 80%, 50%)"
                  repetition={4}
                  softness={0.5}
                  shiftRed={0.3}
                  shiftBlue={0.3}
                  distortion={0.1}
                  contour={1}
                  shape="circle"
                  offsetX={0}
                  offsetY={0}
                  scale={0.58}
                  rotation={50}
                  speed={5}
                />
                <LiquidMetal
                  style={{ height: 60, width: 60 }}
                  colorBack="hsl(0, 0%, 0%, 0)"
                  colorTint="hsl(190, 80%, 50%)"
                  repetition={4}
                  softness={0.5}
                  shiftRed={0.3}
                  shiftBlue={0.3}
                  distortion={0.1}
                  contour={1}
                  shape="circle"
                  offsetX={0}
                  offsetY={0}
                  scale={0.58}
                  rotation={50}
                  speed={5}
                />
              </motion.div>

              <motion.p
                className="text-white/40 text-sm sm:text-sm font-light z-10 text-center sm:text-left sm:ml-4 font-brand"
                style={{ fontFamily: "var(--font-cormorant)" }}
                animate={{
                  y: isFocused ? 50 : 0,
                  opacity: isFocused ? 0 : 100,
                  filter: isFocused ? "blur(4px)" : "blur(0px)",
                }}
                transition={{
                  duration: 0.5,
                  type: "spring",
                  stiffness: 200,
                  damping: 20,
                }}
              >
                <em>Hey there!</em> I'm your intelligent AI companion —{" "}
                <em className="text-cyan-300/60">ready to help with any question or task</em>
              </motion.p>
            </div>
          </>
        )}

        <div className="relative">
          <motion.div
            className="absolute inset-0 z-0 overflow-hidden pointer-events-none flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: isFocused ? 1 : 0 }}
            transition={{ duration: 0.8 }}
          >
            <PulsingBorder
              style={{ height: "100%", width: "100%" }}
              colorBack="hsl(0, 0%, 0%)"
              roundness={0.18}
              thickness={0}
              softness={0}
              intensity={0.3}
              bloom={2}
              spots={2}
              spotSize={0.25}
              pulse={0}
              smoke={0.35}
              smokeSize={0.4}
              scale={0.9}
              rotation={0}
              offsetX={0}
              offsetY={0}
              speed={1}
              colors={[
                "hsl(29, 70%, 37%)",
                "hsl(32, 100%, 83%)",
                "hsl(4, 32%, 30%)",
                "hsl(25, 60%, 50%)",
                "hsl(0, 100%, 10%)",
              ]}
            />
          </motion.div>

          <motion.div
            className="relative bg-[#040404] rounded-2xl p-3 sm:p-4 z-10 overflow-hidden"
            animate={{
              borderColor: isFocused ? "#22D3EE" : "#3D3D3D",
            }}
            transition={{
              duration: 0.6,
              delay: 0.1,
            }}
            style={{
              borderWidth: "1px",
              borderStyle: "solid",
            }}
          >
            <div className="relative mb-4">
              {!user ? (
                <div className="text-white/40 text-sm sm:text-sm font-light z-10 text-center sm:text-left sm:ml-4 font-brand">
                  Please sign in to start chatting.
                </div>
              ) : (
                <Textarea
                  placeholder="Ask me anything! I can help with research, analysis, creative tasks, problem-solving, and more..."
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  aria-busy={loading}
                  className={`resize-none bg-transparent border-none text-white text-base sm:text-lg placeholder:text-zinc-500 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none [&:focus]:ring-0 [&:focus]:outline-none [&:focus-visible]:ring-0 [&:focus-visible]:outline-none transition-all duration-300 ${
                    textValue.length > 100 ? "min-h-[120px]" : textValue.length > 50 ? "min-h-[80px]" : "min-h-[60px]"
                  }`}
                  style={{ fontFamily: "var(--font-cormorant)" }}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  disabled={loading || !user}
                />
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
              <div className="flex items-center gap-2 order-2 sm:order-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-zinc-400 hover:text-white hover:bg-white/10"
                  disabled={!user}
                >
                  <Link className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-zinc-400 hover:text-white hover:bg-white/10"
                  disabled={!user}
                >
                  <Folder className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-zinc-400 hover:text-white hover:bg-white/10"
                  disabled={!user}
                >
                  <Mic className="h-3 w-3" />
                </Button>
              </div>

              <div className="order-1 sm:order-2">
                <Select defaultValue="justify-ai-pro">
                  <SelectTrigger className="w-32 h-7 text-xs bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    <SelectItem value="justify-ai-pro" className="text-white hover:bg-zinc-800">
                      <div className="flex items-center gap-2">
                        <Brain className="h-3 w-3" />
                        Justify AI Pro
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="order-3">
                <Button
                  onClick={handleSend}
                  disabled={!textValue.trim() || loading || !user}
                  size="sm"
                  className="h-7 px-3 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-200 border border-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="h-3 w-3 mr-1" />
                  {loading ? "Sending..." : "Send"}
                </Button>
              </div>
            </div>
          </motion.div>
          {!user && (
            <div className="mt-2 text-xs text-cyan-200/70">
              Sign in with Google from the top-right to start chatting.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
