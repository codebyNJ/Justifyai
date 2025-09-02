"use client"
import { useState } from "react"
import { AnimatePresence } from "framer-motion"
import { ChatInterface } from "@/components/chat-interface"
import { IntroScreen } from "@/components/intro-screen"

export default function Home() {
  const [showIntro, setShowIntro] = useState(true)

  return (
    <div className="min-h-screen bg-black overflow-hidden">
      {/* Removed duplicate <TopBar /> - already included globally */}
      <AnimatePresence mode="wait">
        {showIntro ? (
          <IntroScreen key="intro" onComplete={() => setShowIntro(false)} />
        ) : (
          <main key="chat" className="min-h-screen bg-black">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-10">
              <div className="mx-auto w-full max-w-3xl">
                <ChatInterface />
              </div>
            </div>
          </main>
        )}
      </AnimatePresence>
    </div>
  )
}
