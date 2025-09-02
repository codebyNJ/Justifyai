"use client"
import { motion } from "framer-motion"

export function ChatHeader() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="w-full max-w-4xl mx-auto mb-6 px-4 sm:px-6"
    >
      <div className="text-center space-y-3">
        <h2
          className="text-2xl sm:text-3xl md:text-4xl font-light text-white italic"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          Justify AI
        </h2>
        <div className="max-w-3xl mx-auto">
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
            <em className="text-cyan-200/80">Ready to decode your financial future?</em> Ask me about
            <span className="text-white font-medium italic"> credit scores</span>,
            <span className="text-white font-medium italic"> loan eligibility</span>,
            <span className="text-white font-medium italic"> financial planning</span>,
            <span className="text-white font-medium italic"> investment strategies</span>, or
            <span className="text-white font-medium italic"> market insights</span>
          </p>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent max-w-md mx-auto" />
      </div>
    </motion.div>
  )
}
