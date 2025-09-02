"use client"
import { motion } from "framer-motion"
import { useState, useEffect } from "react"

interface IntroScreenProps {
  onComplete: () => void
}

export function IntroScreen({ onComplete }: IntroScreenProps) {
  const [showTagline, setShowTagline] = useState(false)

  useEffect(() => {
    const timer1 = setTimeout(() => setShowTagline(true), 1500)
    const timer2 = setTimeout(() => onComplete(), 4000)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [onComplete])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black overflow-hidden"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1, ease: "easeInOut" }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-900/20 to-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(186,148,101,0.1),transparent_70%)]" />
        <div className="absolute inset-0 backdrop-blur-3xl bg-black/40" />
      </div>

      <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 w-full max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="mb-8"
        >
          <h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light text-white leading-tight"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            <span className="block italic">Justify AI</span>
            <motion.span
              className="block text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-zinc-400 mt-2 sm:mt-4 font-normal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.8 }}
            >
              India's first <em className="text-cyan-300/80">Agentic</em> credit intelligence
            </motion.span>
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: showTagline ? 1 : 0, y: showTagline ? 0 : 20 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative"
        >
          <div className="inline-block px-6 py-3 rounded-full bg-white/5 backdrop-blur-md border border-white/10">
            <p
              className="text-lg sm:text-xl md:text-2xl text-zinc-300 font-light tracking-wide italic"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              Don't Guess, <em className="text-cyan-200/90 not-italic font-medium">Know.</em>
            </p>
          </div>

          {/* Subtle glow effect */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/5 to-transparent blur-xl" />
        </motion.div>

        {/* Loading indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5, duration: 0.5 }}
          className="mt-12 flex justify-center"
        >
          <div className="flex space-x-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-cyan-400/60 rounded-full"
                animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, delay: i * 0.2 }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
