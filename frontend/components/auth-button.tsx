"use client"

import { useEffect, useState } from "react"
import { auth, listenAuth, signInWithGoogle, signOutGoogle } from "@/lib/firebase"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function AuthButton() {
  const [user, setUser] = useState(auth.currentUser)

  useEffect(() => {
    const unsub = listenAuth(setUser)
    return () => unsub()
  }, [])

  if (!user) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="border border-white/20 bg-white/10 hover:bg-white/20 text-white backdrop-blur-md rounded-2xl"
        onClick={() => signInWithGoogle()}
      >
        Sign in with Google
      </Button>
    )
  }

  const initials = (
    user.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2) ||
    user.email?.[0] ||
    "U"
  ).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="outline-none">
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.photoURL || ""} alt={user.displayName || user.email || "Account"} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="max-w-[220px]">
          <div className="font-medium truncate">{user.displayName || "Account"}</div>
          <div className="text-xs text-muted-foreground truncate">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOutGoogle()}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
