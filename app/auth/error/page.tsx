import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Phone, AlertTriangle } from "lucide-react"
import Link from "next/link"

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>
}) {
  const params = await searchParams

  const getErrorMessage = (error: string) => {
    switch (error) {
      case "access_denied":
        return "Access was denied. Please try again or contact support if the problem persists."
      case "server_error":
        return "A server error occurred. Please try again later."
      case "temporarily_unavailable":
        return "The service is temporarily unavailable. Please try again in a few minutes."
      default:
        return "An unexpected error occurred during authentication."
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Phone className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold">PrismAI</span>
          </div>
        </div>

        <Card className="border-2 text-center">
          <CardHeader>
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Authentication Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-md">
              {params?.error ? getErrorMessage(params.error) : "An unspecified error occurred."}
            </div>

            {params?.error && (
              <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                <strong>Error code:</strong> {params.error}
              </div>
            )}

            <div className="space-y-3">
              <Button asChild className="w-full">
                <Link href="/auth/login">Try signing in again</Link>
              </Button>
              <Button variant="outline" asChild className="w-full bg-transparent">
                <Link href="/auth/sign-up">Create a new account</Link>
              </Button>
            </div>

            <div className="text-center space-y-2">
              <Link href="/" className="text-sm text-primary hover:underline block">
                Return to homepage
              </Link>
              <Link href="/contact" className="text-sm text-muted-foreground hover:underline block">
                Contact support
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
