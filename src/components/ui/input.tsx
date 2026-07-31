import * as React from "react"

import { cn } from "@/lib/utils"

const inputClasses =
  "h-10 w-full min-w-0 max-w-full rounded-2xl border border-input bg-transparent px-3.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&[type=date]]:min-w-0 [&[type=time]]:min-w-0 [&[type=datetime-local]]:min-w-0 [&[type=month]]:min-w-0 [&[type=date]]:appearance-none [&[type=time]]:appearance-none [&[type=datetime-local]]:appearance-none [&::-webkit-calendar-picker-indicator]:opacity-60"

function Input({
  className,
  type,
  label,
  error,
  id,
  ...props
}: React.ComponentProps<"input"> & {
  label?: React.ReactNode
  error?: string
}) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  const hasError = Boolean(error)

  const inputEl = (
    <input
      type={type}
      id={inputId}
      data-slot="input"
      aria-invalid={hasError || undefined}
      className={cn(inputClasses, label || hasError ? undefined : className)}
      {...props}
    />
  )

  if (!label && !hasError) return inputEl

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      {inputEl}
      {hasError && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export { Input }
