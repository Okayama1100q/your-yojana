import React, { createContext, useContext, useState, useEffect } from "react"
import type { UserProfile } from "../types"

interface User {
  name: string
  mobile: string
  profile?: UserProfile
}

interface UserContextType {
  user: User | null
  login: (mobile: string, otp: string) => Promise<boolean>
  logout: () => void
  updateProfile: (profile: UserProfile) => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("youryojana-user")
    if (saved) return JSON.parse(saved)
    return null
  })

  useEffect(() => {
    if (user) {
      localStorage.setItem("youryojana-user", JSON.stringify(user))
    } else {
      localStorage.removeItem("youryojana-user")
    }
  }, [user])

  const login = async (mobile: string, otp: string) => {
    // Mock network delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    if (mobile === "9876543210" && otp === "123456") {
      setUser({ name: "Prajan", mobile })
      return true
    }
    return false
  }

  const logout = () => {
    setUser(null)
  }

  const updateProfile = (profile: UserProfile) => {
    if (user) {
      setUser({ ...user, profile })
    }
  }

  return (
    <UserContext.Provider value={{ user, login, logout, updateProfile }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => {
  const context = useContext(UserContext)
  if (context === undefined) throw new Error("useUser must be used within a UserProvider")
  return context
}
