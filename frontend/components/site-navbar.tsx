/* eslint-disable @next/next/no-img-element */
"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Menu, History, Settings } from "lucide-react"
import AuthButton from "@/components/auth-button"
import { auth, db, listenAuth, signOutGoogle } from "@/lib/firebase"
import { collection, onSnapshot, orderBy, query, limit, deleteDoc, doc } from "firebase/firestore"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ChatItem } from "@/types/chat-item" // Import ChatItem type from a separate file
import type { User } from "firebase/auth" // Import User type from firebase/auth

/**
- Fixed at top, full-width, high z-index so it shows on all screens
- Uses your provided logo at /images/portal-logo.png
- Chat history and Account settings open popups
- CTA is "Sign in with Google" (via existing AuthButton)
- Fonts are unchanged (layout.tsx controls fonts)
*/
export default function SiteNavbar() {
  const [openHistory, setOpenHistory] = React.useState(false)
  const [openSettings, setOpenSettings] = React.useState(false)
  const [chatHistory, setChatHistory] = React.useState<ChatItem[]>([])
  const [userSettings, setUserSettings] = React.useState<User | null>(null)

  React.useEffect(() => {
    const unsubscribeAuth = listenAuth((user) => {
      if (user) {
        const chatHistoryRef = collection(db, "users", user.uid, "chatHistory")
        const chatHistoryQuery = query(chatHistoryRef, orderBy("timestamp", "desc"), limit(10))
        const unsubscribeHistory = onSnapshot(chatHistoryQuery, (snapshot) => {
          const historyData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
          setChatHistory(historyData as ChatItem[])
        })

        const userSettingsRef = doc(db, "users", user.uid)
        onSnapshot(userSettingsRef, (doc) => {
          setUserSettings(doc.data() as User)
        })

        return () => {
          unsubscribeHistory()
          unsubscribeAuth()
        }
      }
    })
  }, [])

  const handleSignOut = () => {
    signOutGoogle()
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto w-full max-w-6xl px-3 md:px-4 pt-2">
        <nav
          className="font-navbar flex h-12 md:h-14 items-center justify-between glass-soft px-3 md:px-4 rounded-md md:rounded-4xl"
          aria-label="Global"
        >
          {/* Left: Brand */}
          <Link href="/" className="flex items-center gap-2" aria-label="Justify AI Home">
            <img
              src="/images/portal-logo.png"
              alt="Justify AI logo"
              width={32}
              height={32}
              className="h-7 w-7 md:h-8 md:w-8 select-none"
            />
            <span className="hidden sm:inline text-sm md:text-[15px] font-semibold tracking-wide">Justify AI</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            <Button
              variant="ghost"
              className="text-sm text-white/90 hover:text-white glass-hover rounded-4xl"
              onClick={() => setOpenHistory(true)}
              aria-haspopup="dialog"
              aria-controls="chat-history-dialog"
            >
              <History className="mr-2 h-4 w-4" />
              Chat history
            </Button>
            <Button
              variant="ghost"
              className="text-sm text-white/90 hover:text-white glass-hover rounded-4xl"
              onClick={() => setOpenSettings(true)}
              aria-haspopup="dialog"
              aria-controls="account-settings-dialog"
            >
              <Settings className="mr-2 h-4 w-4" />
              Account settings
            </Button>
          </div>

          {/* Right: Auth + Mobile menu */}
          <div className="flex items-center gap-1">
            <AuthButton />
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden text-white/90 hover:text-white glass-hover"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 glass-soft">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <img
                      src="/images/portal-logo.png"
                      alt="Justify AI logo"
                      width={20}
                      height={20}
                      className="h-5 w-5"
                    />
                    Justify AI
                  </SheetTitle>
                </SheetHeader>

                <div className="mt-4 grid gap-2">
                  <Button
                    variant="ghost"
                    className="justify-start glass-hover"
                    onClick={() => setOpenHistory(true)}
                    aria-haspopup="dialog"
                    aria-controls="chat-history-dialog"
                  >
                    <History className="mr-2 h-4 w-4" />
                    Chat history
                  </Button>
                  <Button
                    variant="ghost"
                    className="justify-start glass-hover"
                    onClick={() => setOpenSettings(true)}
                    aria-haspopup="dialog"
                    aria-controls="account-settings-dialog"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Account settings
                  </Button>

                  <div className="pt-2">
                    <AuthButton />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </div>

      {/* Dialogs (shared across desktop & mobile) */}
      <Dialog open={openHistory} onOpenChange={setOpenHistory}>
        <DialogContent id="chat-history-dialog" className="sm:max-w-lg glass-soft">
          <DialogHeader>
            <DialogTitle>Chat history</DialogTitle>
          </DialogHeader>
          <ChatHistoryList chatHistory={chatHistory} /> {/* Use the renamed component */}
        </DialogContent>
      </Dialog>

      <Dialog open={openSettings} onOpenChange={setOpenSettings}>
        <DialogContent id="account-settings-dialog" className="sm:max-w-lg glass-soft">
          <DialogHeader>
            <DialogTitle>Account settings</DialogTitle>
          </DialogHeader>
          <AccountSettings /> {/* Use the renamed component */}
        </DialogContent>
      </Dialog>
    </header>
  )
}

function ChatHistoryList({ chatHistory }: { chatHistory: ChatItem[] }) {
  const [user, setUser] = React.useState(auth.currentUser)
  const [items, setItems] = React.useState<ChatItem[]>([])
  const [busyId, setBusyId] = React.useState<string | null>(null)

  React.useEffect(() => {
    const unsub = listenAuth(setUser)
    return () => unsub()
  }, [])

  React.useEffect(() => {
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

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {}
  }

  const remove = async (id: string) => {
    if (!user) return
    try {
      setBusyId(id)
      await deleteDoc(doc(db, "users", user.uid, "chats", id))
    } finally {
      setBusyId(null)
    }
  }

  if (!user) {
    return <div className="text-sm text-white/70">Sign in to view your chat history.</div>
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-white/60">Showing your last 50 conversations.</div>
      <ScrollArea className="h-[380px]">
        <ul className="space-y-2">
          {items.length === 0 ? (
            <li className="text-sm text-white/70">No history yet.</li>
          ) : (
            items.map((c) => (
              <li key={c.id} className="rounded-md border border-neutral-800/70 p-2 bg-black/40 w-full overflow-hidden">
                <div className="text-sm font-medium text-white line-clamp-1 break-all">{c.message}</div>
                <div className="mt-1 text-xs text-white/70 line-clamp-1 break-all">{c.response}</div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copy(c.message)}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white"
                    aria-label="Copy prompt"
                  >
                    Copy prompt
                  </button>
                  <button
                    type="button"
                    onClick={() => copy(c.response)}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white"
                    aria-label="Copy response"
                  >
                    Copy reply
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    disabled={busyId === c.id}
                    className="ml-auto text-[11px] px-2 py-0.5 rounded-md bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 disabled:opacity-50"
                    aria-label="Delete conversation"
                  >
                    {busyId === c.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </ScrollArea>
    </div>
  )
}

function AccountSettings() {
  const [user, setUser] = React.useState(auth.currentUser)

  React.useEffect(() => {
    const unsub = listenAuth(setUser)
    return () => unsub()
  }, [])

  if (!user) {
    return <div className="text-sm text-white/70">Please sign in with Google to access account settings.</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={user.photoURL || "/placeholder.svg?height=40&width=40&query=user%20avatar"}
          alt="User avatar"
          className="h-10 w-10 rounded-full border border-white/10 object-cover"
        />
        <div className="min-w-0">
          <div className="font-medium text-white truncate">{user.displayName || "Account"}</div>
          <div className="text-xs text-white/70 truncate">{user.email}</div>
        </div>
      </div>

      <div className="rounded-md border border-white/10 p-3 bg-white/5">
        <div className="text-xs text-white/60">User ID</div>
        <div className="text-xs text-white/80 mt-1 break-all">{user.uid}</div>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => signOutGoogle()}
          className="px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
