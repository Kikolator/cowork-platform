import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

export default function StoreSuccess() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
          <CheckCircle className="size-8 text-emerald-600 dark:text-emerald-400" />
        </div>

        <h1 className="text-2xl font-semibold">Payment Successful!</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Your purchase has been confirmed.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Button render={<Link href="/store" />} variant="outline">
            Back to Store
          </Button>
          <Button render={<Link href="/dashboard" />}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
