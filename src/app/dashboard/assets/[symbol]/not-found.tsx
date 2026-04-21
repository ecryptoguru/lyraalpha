import Link from "next/link";
import { Search, ArrowLeft } from "lucide-react";

export default function AssetNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-4 bg-muted/50 rounded-full">
            <Search className="w-12 h-12 text-muted-foreground" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold tracking-tight">Asset Not Found</h1>
        
        <p className="text-muted-foreground">
          We couldn&apos;t locate the asset you&apos;re looking for. It may have been removed, renamed, or the symbol might be incorrect.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard/assets"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Browse Assets
          </Link>
        </div>
      </div>
    </div>
  );
}
