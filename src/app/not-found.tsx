import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-lg w-full text-center space-y-8">
        {/* Background decorative element */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 text-[20vw] font-bold text-primary/5 select-none pointer-events-none tracking-tighter hidden lg:block">
          404
        </div>
        
        <div className="relative z-10">
          <div className="flex justify-center mb-6">
            <div className="p-5 bg-muted/50 rounded-2xl">
              <Search className="w-16 h-16 text-muted-foreground" />
            </div>
          </div>
          
          <h1 className="text-5xl font-bold tracking-tight mb-4">Page Not Found</h1>
          
          <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
            The page you&apos;re looking for doesn&apos;t exist or has been moved. Check the URL or navigate back to the dashboard.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors"
            >
              <Home className="w-5 h-5" />
              Go to Dashboard
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-muted text-foreground rounded-xl font-semibold hover:bg-muted/80 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
        
        <div className="pt-8 border-t border-border/20">
          <p className="text-xs font-bold tracking-[0.2em] text-muted-foreground uppercase opacity-40">
            Alpha Terminal System | 404 Error
          </p>
        </div>
      </div>
    </div>
  );
}
