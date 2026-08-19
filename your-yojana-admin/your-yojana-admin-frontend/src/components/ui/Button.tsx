import * as React from "react"
import { cn } from "../../utils/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "link" | "secondary"
  size?: "default" | "sm" | "lg" | "icon"
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const classes = cn(
      "inline-flex items-center justify-center whitespace-nowrap  text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
      {
        "bg-primary text-primary-foreground hover:bg-primary/90": variant === "default",
        "border border-border bg-background hover:bg-muted hover:text-foreground": variant === "outline",
        "bg-secondary text-secondary-foreground hover:bg-secondary/80": variant === "secondary",
        "hover:bg-muted hover:text-foreground": variant === "ghost",
        "text-primary underline-offset-4 hover:underline": variant === "link",
        "h-10 px-4 py-2": size === "default",
        "h-9  px-3": size === "sm",
        "h-12  px-8 text-base": size === "lg",
        "h-10 w-10": size === "icon",
      },
      className
    )

    if (asChild && React.isValidElement(props.children)) {
      return React.cloneElement(props.children as React.ReactElement<any>, {
        className: cn(classes, ((props.children as React.ReactElement<any>).props.className)),
        ref: ref as any,
      })
    }

    return (
      <button
        ref={ref}
        className={classes}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
