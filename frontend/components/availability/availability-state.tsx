import { AlertCircle, LoaderCircle } from "lucide-react";

export function AvailabilityState({
  loading = false,
  message,
}: {
  loading?: boolean;
  message: string;
}) {
  const Icon = loading ? LoaderCircle : AlertCircle;

  return (
    <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed bg-white p-8 text-center">
      <div>
        <Icon
          className={`mx-auto size-6 text-muted-foreground ${loading ? "animate-spin" : ""}`}
        />
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
