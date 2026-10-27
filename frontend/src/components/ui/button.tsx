import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:bg-disabled disabled:text-disabled-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        inverse:
          "bg-card text-primary-active hover:bg-accent active:bg-secondary",
        default:
          "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active",
        outline:
          "border border-input bg-card text-foreground hover:bg-accent hover:text-accent-foreground active:bg-secondary",
        ghost:
          "text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-secondary",
      },
      size: {
        default: "min-h-11 px-5 py-2",
        lg: "min-h-13 px-6 py-3",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      data-variant={variant ?? "default"}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
export { Button, buttonVariants };
