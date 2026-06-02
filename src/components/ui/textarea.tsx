import * as React from "react"

import { cn } from "@/lib/utils"

const textareaClasses =
  "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"

function Textarea({
  className,
  label,
  error,
  id,
  ...props
}: React.ComponentProps<"textarea"> & {
  label?: React.ReactNode
  error?: string
}) {
  const generatedId = React.useId()
  const textareaId = id ?? generatedId
  const hasError = Boolean(error)

  const textareaEl = (
    <textarea
      id={textareaId}
      data-slot="textarea"
      aria-invalid={hasError || undefined}
      className={cn(textareaClasses, label || hasError ? undefined : className)}
      {...props}
    />
  )

  if (!label && !hasError) return textareaEl

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label
          htmlFor={textareaId}
          className="text-sm font-medium text-foreground"
        >
          {label}
        </label>
      )}
      {textareaEl}
      {hasError && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export { Textarea }
