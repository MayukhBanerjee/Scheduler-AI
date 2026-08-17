"use client"

import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { X, Users, Bot, ArrowRight } from "lucide-react"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  action: "login" | "register" | null
}

export function AuthModal({ isOpen, onClose, action }: AuthModalProps) {

const getHref = (role: "user" | "provider") => {
  if (action === "login") {
    return `/login?type=${role}`;
  }
  return `/signup?role=${role}`;
};

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.4 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl"
          >
            <Card className="p-8 shadow-2xl border-2 relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="absolute top-4 right-4 hover:bg-accent/50 rounded-full h-8 w-8"
              >
                <X className="w-4 h-4" />
              </Button>

              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2">
                  {action === "login" ? "Welcome Back!" : "Join ScheduleAI"}
                </h2>
                <p className="text-muted-foreground text-lg">How would you like to continue?</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Link href={getHref("user")} onClick={onClose}>
                  <motion.div
                    whileHover={{ scale: 1.03, y: -5 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <Card className="p-6 cursor-pointer border-2 hover:border-primary/50 transition-colors h-full flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mb-4">
                        <Users className="w-8 h-8 text-blue-600 dark:text-blue-300" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">I'm a Customer</h3>
                      <p className="text-sm text-muted-foreground flex-1 mb-4">
                        Book appointments and effortlessly manage my schedule.
                      </p>
                      <div className="flex items-center text-primary font-medium">
                        Continue <ArrowRight className="w-4 h-4 ml-2" />
                      </div>
                    </Card>
                  </motion.div>
                </Link>

                <Link href={getHref("provider")} onClick={onClose}>
                  <motion.div
                    whileHover={{ scale: 1.03, y: -5 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <Card className="p-6 cursor-pointer border-2 hover:border-primary/50 transition-colors h-full flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mb-4">
                        <Bot className="w-8 h-8 text-green-600 dark:text-green-300" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">I'm a Business</h3>
                      <p className="text-sm text-muted-foreground flex-1 mb-4">
                        Manage my calendar and provide services to customers.
                      </p>
                      <div className="flex items-center text-primary font-medium">
                        Continue <ArrowRight className="w-4 h-4 ml-2" />
                      </div>
                    </Card>
                  </motion.div>
                </Link>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}