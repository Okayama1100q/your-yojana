import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Smartphone, ArrowRight, ShieldCheck } from "lucide-react"
import { Button } from "./ui/Button"
import { Input } from "./ui/Input"
import { Label } from "./ui/Label"
import { useUser } from "../hooks/useUser"

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { login } = useUser()
  const [step, setStep] = useState<"mobile" | "otp">("mobile")
  const [mobile, setMobile] = useState("9876543210")
  const [otp, setOtp] = useState("123456")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleMobileSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mobile.length < 10) {
      setError("Please enter a valid 10-digit mobile number")
      return
    }
    setError("")
    setStep("otp")
  }

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    
    const success = await login(mobile, otp)
    setLoading(false)
    
    if (success) {
      onClose()
      // reset state after closing
      setTimeout(() => setStep("mobile"), 300)
    } else {
      setError("Invalid OTP. Try 123456")
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] p-4"
          >
            <div className="bg-card text-card-foreground border border-border shadow-lg rounded-2xl overflow-hidden">
              <div className="relative p-6">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-4 top-4"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </Button>

                <div className="mb-8">
                  <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold">Welcome Back</h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    Sign in to access your personalized support dashboard.
                  </p>
                </div>

                {step === "mobile" ? (
                  <form onSubmit={handleMobileSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="mobile">Mobile Number</Label>
                      <div className="relative">
                        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="mobile"
                          type="tel"
                          placeholder="Enter your 10-digit number"
                          className="pl-10"
                          value={mobile}
                          onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                          maxLength={10}
                        />
                      </div>
                      {error && <p className="text-sm text-danger">{error}</p>}
                    </div>
                    <Button type="submit" className="w-full">
                      Continue <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <p className="text-xs text-center text-muted-foreground mt-4">
                      Demo Note: Use 9876543210 for testing.
                    </p>
                  </form>
                ) : (
                  <form onSubmit={handleOtpSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="otp">Enter OTP</Label>
                      <Input
                        id="otp"
                        type="text"
                        placeholder="6-digit OTP"
                        className="text-center text-lg tracking-widest"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        maxLength={6}
                        autoFocus
                      />
                      {error && <p className="text-sm text-danger">{error}</p>}
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Verifying..." : "Verify & Sign In"}
                    </Button>
                    <div className="text-center mt-4 text-sm">
                      <button type="button" onClick={() => setStep("mobile")} className="text-primary hover:underline">
                        Change mobile number
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
