import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-muted-foreground">That route does not exist in ScheduleAI.</p>
      <Button asChild>
        <Link href="/">Back home</Link>
      </Button>
    </div>
  )
}
