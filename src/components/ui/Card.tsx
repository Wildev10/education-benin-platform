import { type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "article";
  padding?: "sm" | "md" | "lg";
  highlight?: "none" | "danger" | "warning" | "success";
}

const highlightCls = {
  none: "border-border bg-surface",
  danger: "border-red-200 bg-red-50",
  warning: "border-amber-200 bg-amber-50",
  success: "border-emerald-200 bg-emerald-50",
};

const paddingCls = {
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
};

export function Card({
  as: Tag = "div",
  padding = "md",
  highlight = "none",
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <Tag
      {...props}
      className={[
        "rounded-[14px] border shadow-sm",
        highlightCls[highlight],
        paddingCls[padding],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}
