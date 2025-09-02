"use client"

import { useEffect, useState } from "react"
import { auth, db, listenAuth } from "@/lib/firebase"
import { collection, onSnapshot, orderBy, query, limit } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"

type ChatItem = {
  id: string
  message: string
  response: string
  session_id?: string
  createdAt?: { seconds: number; nanoseconds: number }
}

export default function LeftMenu() {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState(auth.currentUser)
  const [items, setItems] = useState<ChatItem[]>([])

  useEffect(() => {
    const unsub = listenAuth(setUser)
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!user) {
      setItems([])
      return
    }
    const q = query(collection(db, "users", user.uid, "chats"), orderBy("createdAt", "desc"), limit(50))
    const unsub = onSnapshot(q, (snap) => {
      const rows: ChatItem[] = []
      snap.forEach((d) => {
        const data = d.data() as any
        rows.push({
          id: d.id,
          message: data.message || "",
          response: data.response || "",
          session_id: data.session_id,
          createdAt: data.createdAt,
        })
      })
      setItems(rows)
    })
    return () => unsub()
  }, [user])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 rounded-full px-3 text-white/90 hover:text-white bg-white/5 hover:bg-white/10 border border-neutral-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
          aria-label="Open menu"
        >
          Menu
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[320px] sm:w-[380px] bg-black/95 backdrop-blur supports-[backdrop-filter]:bg-black/80 text-white border-l border-neutral-800"
      >
        <SheetHeader>
          <SheetTitle className="text-white">History & Account</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="rounded-md border border-neutral-800 p-3 bg-black/40">
            <div className="text-sm font-medium text-cyan-300">Account</div>
            {user ? (
              <div className="mt-2 text-sm text-white/70">
                <div className="truncate">{user.displayName || "Signed in"}</div>
                <div className="truncate">{user.email}</div>
                <div className="truncate text-xs">UID: {user.uid}</div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-white/70">Sign in to view details.</div>
            )}
          </div>
          <div className="rounded-md border border-neutral-800 bg-black/40">
            <div className="border-b border-neutral-800 px-3 py-2 text-sm font-medium text-cyan-300">Recent chats</div>
            <ScrollArea className="h-[360px]">
              <ul className="p-3 space-y-2">
                {items.length === 0 ? (
                  <li className="text-sm text-white/70">No history.</li>
                ) : (
                  items.map((c) => (
                    <li key={c.id} className="text-sm w-full overflow-hidden">
                      <div className="font-medium line-clamp-1 break-all">{c.message}</div>
                      <div className="text-white/70 line-clamp-1 break-all">{c.response}</div>
                      {c.session_id ? (
                        <div className="text-xs text-cyan-300/70 mt-1">Session: {c.session_id}</div>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
