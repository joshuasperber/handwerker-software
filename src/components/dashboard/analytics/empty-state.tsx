import { Inbox } from "lucide-react";

export function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
      <Inbox className="h-8 w-8 text-muted-foreground/40" />
      <p>{message}</p>
    </div>
  );
}
