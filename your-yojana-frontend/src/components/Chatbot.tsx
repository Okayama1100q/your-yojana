import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MessageSquare, X, Send } from "lucide-react"
import { Button } from "./ui/Button"
import { Input } from "./ui/Input"
import { cn } from "../utils/utils"

const SUGGESTED_PROMPTS = [
  "What schemes can I apply for?",
  "What documents do I need?",
  "How long does verification take?"
]

const MOCK_RESPONSES: Record<string, string> = {
  "What schemes can I apply for?": "You can find schemes by taking our personalized questionnaire in the 'Welfare Schemes' section.",
  "What documents do I need?": "Generally, you need your Aadhaar, Income Certificate, and Domicile. Exact documents depend on the scheme.",
  "How do I apply?": "Once you find a scheme you're eligible for, click 'Proceed to Apply' on the scheme details page to start your Saarthi enrollment.",
  "How long does verification take?": "Verification usually takes 15-30 days depending on the scheme and department.",
  "What does verification pending mean?": "It means your documents have been submitted and are currently being reviewed by the concerned authority.",
  "How do I track my application?": "You can track your application status in the 'My Dashboard' section.",
}

interface Message {
  id: string
  text: string
  sender: "user" | "bot"
}

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", text: "Hello! I am your Yojana Assistant. How can I help you today?", sender: "bot" }
  ])
  const [input, setInput] = useState("")

  const handleSend = (text: string = input) => {
    if (!text.trim()) return

    const userMsg: Message = { id: Date.now().toString(), text, sender: "user" }
    setMessages(prev => [...prev, userMsg])
    setInput("")

    // Mock response
    setTimeout(() => {
      let botText = "I'm a demo assistant. Please try one of the suggested prompts or visit our Help Center."
      if (MOCK_RESPONSES[text]) {
        botText = MOCK_RESPONSES[text]
      }
      const botMsg: Message = { id: (Date.now() + 1).toString(), text: botText, sender: "bot" }
      setMessages(prev => [...prev, botMsg])
    }, 800)
  }

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              size="icon"
              className="h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 text-primary-foreground border-4 border-background"
              onClick={() => setIsOpen(true)}
            >
              <MessageSquare className="h-6 w-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-[90vw] sm:w-[400px] h-[600px] max-h-[85vh] bg-background border-2 border-foreground shadow-none flex flex-col overflow-hidden rounded-none"
          >
            {/* Header */}
            <div className="bg-foreground text-background p-4 flex items-center justify-between z-10 border-b-2 border-foreground">
              <div className="flex items-center gap-3">
                <div className="bg-background text-foreground p-2">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-erode font-black text-lg uppercase tracking-wider">SUPPORT</h3>
                  <p className="text-xs uppercase tracking-widest opacity-80">HELP DESK</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-background hover:bg-background/20 rounded-none" onClick={() => setIsOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex", msg.sender === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[80%] px-4 py-3 text-sm border-2 font-medium",
                    msg.sender === "user" 
                      ? "bg-foreground text-background border-foreground" 
                      : "bg-card text-foreground border-foreground"
                  )}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Suggested Prompts */}
            {messages.length < 3 && (
              <div className="p-3 bg-card flex gap-2 overflow-x-auto no-scrollbar border-t-2 border-foreground">
                {SUGGESTED_PROMPTS.map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    className="whitespace-nowrap text-xs font-bold uppercase tracking-wider bg-background text-foreground border-2 border-foreground hover:bg-foreground hover:text-background px-3 py-2 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-4 bg-background border-t-2 border-foreground">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex items-center gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="TYPE MESSAGE..."
                  className="rounded-none bg-background border-2 border-foreground focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground uppercase tracking-widest font-bold text-sm"
                />
                <Button type="submit" size="icon" className="rounded-none shrink-0 border-2 border-foreground" disabled={!input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
