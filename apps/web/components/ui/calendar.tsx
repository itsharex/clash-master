"use client"

import * as React from "react"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      navLayout={props.navLayout ?? "around"}
      className={cn("p-3", className)}
      classNames={{
        root: "w-fit",
        months: "relative flex flex-col gap-4",
        month: "relative space-y-4",
        nav: "absolute inset-x-0 top-1 flex items-center justify-between px-1",
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "absolute left-1 top-1 h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100",
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "absolute right-1 top-1 h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100",
        ),
        month_caption: "relative flex h-9 items-center justify-center px-8 pt-1",
        caption_label: "text-sm font-medium",
        dropdowns: "flex items-center gap-1",
        dropdown_root:
          "relative has-focus:border-ring has-focus:ring-ring/50 border border-input shadow-xs has-focus:ring-[3px] rounded-md",
        dropdown: "absolute inset-0 opacity-0",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: "relative h-9 w-9 p-0 text-center text-sm",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
        ),
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        today: "bg-accent text-accent-foreground",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className, ...props }) => {
          if (orientation === "left") {
            return <ChevronLeft className={cn("h-4 w-4", className)} {...props} />
          }
          if (orientation === "right") {
            return <ChevronRight className={cn("h-4 w-4", className)} {...props} />
          }
          return <ChevronDown className={cn("h-4 w-4", className)} {...props} />
        },
      }}
      {...props}
    />
  )
}

export { Calendar }
