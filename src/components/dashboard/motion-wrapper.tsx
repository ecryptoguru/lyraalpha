"use client";

import React from "react";

interface ContainerProps {
  className?: string;
  children: React.ReactNode;
}

export function Container({ className, children }: ContainerProps) {
  return (
    <div className={className}>
      {React.Children.map(children, (child, i) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<{ style?: React.CSSProperties }>, {
              style: {
                ...(child.props as { style?: React.CSSProperties }).style,
                animationDelay: `${i * 60 + 20}ms`,
              },
            })
          : child
      )}
    </div>
  );
}

interface ItemProps {
  className?: string;
  children: React.ReactNode;
  hoverScale?: boolean;
  style?: React.CSSProperties;
}

export function Item({ className, children, hoverScale, style }: ItemProps) {
  return (
    <div
      className={`animate-in fade-in slide-in-from-bottom-3 duration-300 fill-mode-both${hoverScale ? " hover:-translate-y-0.5 transition-transform" : ""}${className ? ` ${className}` : ""}`}
      style={style}
    >
      {children}
    </div>
  );
}
