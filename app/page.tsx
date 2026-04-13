"use client"

import { useState } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, MessageSquare, Phone, Clock, Users, Zap, ArrowRight, Bot, Sparkles, Github, Linkedin, Mail } from "lucide-react"
import Link from "next/link"
import { ScrollReveal } from "@/components/scroll-reveal"
import { AnimatedCounter } from "@/components/animated-counter"
import { FloatingElements } from "@/components/floating-elements"
import { AuthModal } from "@/components/auth-modal"

export default function LandingPage() {
  const [isHovered, setIsHovered] = useState(false)
  const { scrollYProgress } = useScroll()
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"])
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [authAction, setAuthAction] = useState<"login" | "register" | null>(null)

  const openModal = (action: "login" | "register") => {
    setAuthAction(action)
    setIsModalOpen(true)
  }

  return (
    <div className="min-h-screen bg-background relative">
      <FloatingElements />

      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      >
        <div className="container flex h-16 items-center justify-between">
          <motion.div className="flex items-center space-x-2" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <motion.div
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary"
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
            >
              <Calendar className="h-4 w-4 text-primary-foreground" />
            </motion.div>
            <span className="text-xl font-bold">ScheduleAI</span>
          </motion.div>

          <div className="flex items-center space-x-2">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button variant="ghost" onClick={() => openModal("login")}>
                Login
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button onClick={() => openModal("register")}>Register</Button>
            </motion.div>
          </div>
        </div>
      </motion.header>

      <section className="container px-4 py-24 mx-auto relative">
        <motion.div style={{ y, opacity }} className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 rounded-3xl" />
        </motion.div>

        <div className="flex flex-col items-center text-center space-y-8">
          <ScrollReveal delay={0.2}>
            <Badge variant="secondary" className="mb-4">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              >
                <Sparkles className="h-3 w-3 mr-1" />
              </motion.div>
              AI-Powered Scheduling
            </Badge>
          </ScrollReveal>

          <ScrollReveal delay={0.4}>
            <h1 className="text-4xl md:text-6xl font-bold text-balance max-w-4xl">
              Schedule Smarter with{" "}
              <motion.span
                className="text-primary"
                animate={{
                  backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                }}
                style={{
                  background: "linear-gradient(90deg, #a16207, #ec4899, #a16207)",
                  backgroundSize: "200% 100%",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
                transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY }}
              >
                AI-Powered
              </motion.span>{" "}
              Conversations
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.6}>
            <p className="text-xl text-muted-foreground text-pretty max-w-2xl">
              Transform your booking experience with intelligent chat and voice assistants. Let AI handle scheduling
              while you focus on what matters most.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.8}>
            <div className="flex justify-center">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  size="lg"
                  className="text-lg px-8 py-6 relative overflow-hidden shadow-lg shadow-primary/20"
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                  onClick={() => openModal("register")}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-primary to-accent"
                    initial={{ x: "-100%" }}
                    animate={{ x: isHovered ? "0%" : "-100%" }}
                    transition={{ duration: 0.3 }}
                  />
                  <span className="relative z-10 font-medium">Get Started Free</span>
                  <motion.div
                    animate={{ x: isHovered ? 5 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="relative z-10"
                  >
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </motion.div>
                </Button>
              </motion.div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <ScrollReveal>
        <section className="container px-4 py-16 mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: 10000, suffix: "+", label: "Happy Users" },
              { value: 50000, suffix: "+", label: "Appointments Booked" },
              { value: 99, suffix: "%", label: "Uptime" },
              { value: 24, suffix: "/7", label: "AI Support" },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className="space-y-2"
              >
                <div className="text-3xl md:text-4xl font-bold text-primary">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </div>
                <p className="text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </section>
      </ScrollReveal>

      <section className="container px-4 py-24 mx-auto">
        <ScrollReveal>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose ScheduleAI?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Experience the future of appointment scheduling with our intelligent platform
            </p>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <ScrollReveal key={feature.title} delay={index * 0.1} direction="up">
              <motion.div
                whileHover={{
                  y: -10,
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                }}
                transition={{ duration: 0.3 }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow duration-300 relative overflow-hidden">
                  {feature.inProgress && (
                    <Badge className="absolute top-4 right-4 bg-green-500 hover:bg-green-600 text-white z-20 shadow-sm border-0 font-medium rounded-full px-3 py-0.5 pointer-events-none">
                      In progress
                    </Badge>
                  )}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0"
                    whileHover={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                  <CardHeader className="relative z-10">
                    <div className="flex items-center space-x-3">
                      <motion.div
                        className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10"
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ duration: 0.2 }}
                      >
                        <feature.icon className="h-6 w-6 text-primary" />
                      </motion.div>
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <CardDescription className="text-base leading-relaxed">{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="bg-muted/30 py-24 relative overflow-hidden">
        <motion.div
          className="absolute inset-0 opacity-5"
          animate={{
            backgroundPosition: ["0% 0%", "100% 100%"],
          }}
          transition={{
            duration: 20,
            repeat: Number.POSITIVE_INFINITY,
            repeatType: "reverse",
          }}
          style={{
            backgroundImage: "radial-gradient(circle, #a16207 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />

        <div className="container px-4 mx-auto relative z-10">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Get started in minutes with our simple three-step process
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <ScrollReveal key={step.title} delay={index * 0.2} direction="up">
                <motion.div className="text-center" whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
                  <div className="flex justify-center mb-6">
                    <motion.div
                      className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold relative"
                      whileHover={{
                        boxShadow: "0 0 20px rgba(161, 98, 7, 0.5)",
                        scale: 1.1,
                      }}
                      animate={{
                        boxShadow: [
                          "0 0 0px rgba(161, 98, 7, 0.5)",
                          "0 0 20px rgba(161, 98, 7, 0.3)",
                          "0 0 0px rgba(161, 98, 7, 0.5)",
                        ],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Number.POSITIVE_INFINITY,
                        delay: index * 0.5,
                      }}
                    >
                      {index + 1}
                    </motion.div>
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                </motion.div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="container px-4 py-24 mx-auto">
        <ScrollReveal>
          <Card className="max-w-4xl mx-auto bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20 relative overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10"
              animate={{
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 3,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
            />
            <CardContent className="p-12 relative z-10">
              <motion.h2
                className="text-3xl md:text-4xl font-bold mb-4 text-center"
                animate={{
                  backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                }}
                style={{
                  background: "linear-gradient(90deg, #a16207, #ec4899, #a16207)",
                  backgroundSize: "200% 100%",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
                transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY }}
              >
                Ready to Transform Your Scheduling?
              </motion.h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto text-center">
                Join thousands of businesses already using ScheduleAI to streamline their booking process
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button size="lg" className="text-lg px-8 py-6" onClick={() => openModal("register")}>
                    Start Free Trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button variant="outline" size="lg" className="text-lg px-8 py-6 bg-transparent">
                    Contact Sales
                  </Button>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>
      </section>

      <footer className="border-t bg-muted/30">
        <div className="container px-4 py-8 mx-auto space-y-8">
          <ScrollReveal>
            <div className="text-center space-y-6">
              <h3 className="text-xl font-bold">Meet our developers</h3>
              <div className="flex justify-center gap-10 md:gap-24">
                <motion.div className="flex flex-col items-center space-y-3" whileHover={{ scale: 1.05 }}>
                  <div className="h-20 w-20 rounded-full bg-muted overflow-hidden border-2 border-primary/20 flex items-center justify-center shadow-sm">
                    <img src="/mayukh.jpg" alt="Mayukh Banerjee" className="object-cover w-full h-full" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden') }} />
                    <Users className="h-8 w-8 text-muted-foreground/50 hidden" />
                  </div>
                  <div className="flex flex-col items-center space-y-2">
                    <span className="font-semibold hover:text-primary transition-colors cursor-default">Mayukh Banerjee</span>
                    <div className="flex space-x-6 text-muted-foreground">
                      <a href="https://github.com/MayukhBanerjee" target="_blank" rel="noreferrer" className="hover:text-primary transition-all hover:scale-110">
                        <Github className="h-4 w-4" />
                      </a>
                      <a href="https://www.linkedin.com/in/mayukh-banerjee" target="_blank" rel="noreferrer" className="hover:text-primary transition-all hover:scale-110">
                        <Linkedin className="h-4 w-4" />
                      </a>
                    </div>
                    <a href="mailto:mayukhbanerjee011@gmail.com" className="text-xs text-muted-foreground hover:text-primary transition-colors mt-1 font-medium">
                      mayukhbanerjee011@gmail.com
                    </a>
                  </div>
                </motion.div>

                <motion.div className="flex flex-col items-center space-y-3" whileHover={{ scale: 1.05 }}>
                  <div className="h-20 w-20 rounded-full bg-muted overflow-hidden border-2 border-primary/20 flex items-center justify-center shadow-sm">
                    <img src="/naif.jpg" alt="Naif Naqeeb" className="object-cover w-full h-full" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden') }} />
                    <Users className="h-8 w-8 text-muted-foreground/50 hidden" />
                  </div>
                  <div className="flex flex-col items-center space-y-2">
                    <span className="font-semibold hover:text-primary transition-colors cursor-default">Naif Naqeeb</span>
                    <div className="flex space-x-6 text-muted-foreground">
                      <a href="https://github.com/naifnaqeeb" target="_blank" rel="noreferrer" className="hover:text-primary transition-all hover:scale-110">
                        <Github className="h-4 w-4" />
                      </a>
                      <a href="https://www.linkedin.com/in/naifnaqeeb/" target="_blank" rel="noreferrer" className="hover:text-primary transition-all hover:scale-110">
                        <Linkedin className="h-4 w-4" />
                      </a>
                    </div>
                    <a href="mailto:naifnaqeeb.123@gmail.com" className="text-xs text-muted-foreground hover:text-primary transition-colors mt-1 font-medium">
                      naifnaqeeb.123@gmail.com
                    </a>
                  </div>
                </motion.div>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-border/50">
              <motion.div className="flex items-center space-x-2 mb-4 md:mb-0" whileHover={{ scale: 1.05 }}>
                <motion.div
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary"
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                >
                  <Calendar className="h-4 w-4 text-primary-foreground" />
                </motion.div>
                <span className="text-xl font-bold">ScheduleAI</span>
              </motion.div>
              <p className="text-muted-foreground">© 2024 ScheduleAI. All rights reserved.</p>
            </div>
          </ScrollReveal>
        </div>
      </footer>

      <AuthModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        action={authAction}
      />
    </div>
  )
}


const features = [
  {
    icon: MessageSquare,
    title: "AI Chat Assistant",
    description:
      "Natural language booking through intelligent chat conversations that understand context and preferences.",
  },
  {
    icon: Phone,
    title: "Voice Booking",
    description: "Call and speak naturally to book appointments. Our AI understands speech and responds in real-time.",
    inProgress: true,
  },
  {
    icon: Calendar,
    title: "Smart Calendar Sync",
    description: "Seamless integration with Google Calendar for both clients and users with real-time synchronization.",
    inProgress: true,
  },
  {
    icon: Clock,
    title: "24/7 Availability",
    description: "Your AI assistant never sleeps. Customers can book appointments anytime, anywhere.",
  },
  {
    icon: Users,
    title: "Dual Dashboard",
    description: "Separate interfaces for customers and businesses with role-based access and features.",
  },
  {
    icon: Zap,
    title: "Instant Confirmations",
    description: "Real-time booking confirmations with automatic calendar updates and notifications.",
  },
]

const steps = [
  {
    title: "Choose Your Role",
    description: "Sign up as a customer looking to book services or as a business offering appointments.",
  },
  {
    title: "Connect Your Calendar",
    description: "Link your Google Calendar for seamless scheduling and automatic synchronization.",
  },
  {
    title: "Start Booking",
    description: "Use chat or voice to book appointments naturally. Our AI handles the rest.",
  },
]