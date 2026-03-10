import * as React from "react";
import { cn } from "@/lib/utils";

export interface AnimatedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Base text & border color (any CSS color value) */
  color?: string;
  /** Text color on hover */
  hoverColor?: string;
  /** Background fill color for the wave animation (defaults to `color`) */
  fillColor?: string;
  /** Initial background color of the button */
  bg?: string;
  /** Whether to render a border (defaults to true) */
  bordered?: boolean;
  /** Render as child element — merges props & injects spans into the child */
  asChild?: boolean;
}

const waveFillSpans = (
  <>
    <span className="animated-btn__span" aria-hidden />
    <span className="animated-btn__span" aria-hidden />
    <span className="animated-btn__span" aria-hidden />
    <span className="animated-btn__span" aria-hidden />
  </>
);

const AnimatedButton = React.forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  (
    {
      className,
      color = "goldenrod",
      hoverColor = "#000",
      fillColor,
      bg,
      bordered = true,
      asChild = false,
      children,
      style,
      ...props
    },
    ref,
  ) => {
    const cssVars = {
      "--btn-color": color,
      "--btn-hover-color": hoverColor,
      "--btn-fill-color": fillColor || color,
      ...(bg && { "--btn-bg": bg }),
    } as React.CSSProperties;

    const mergedClassName = cn(
      "animated-btn inline-flex items-center justify-center gap-2 px-8 py-4 text-base rounded-xl font-bold tracking-wider select-none",
      bordered && "animated-btn--bordered",
      className,
    );

    const mergedStyle = { ...cssVars, ...style };

    // asChild: clone the single child element, inject spans + merge props
    if (asChild) {
      const child = React.Children.only(children) as React.ReactElement<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any
      >;
      return React.cloneElement(
        child,
        {
          className: cn(mergedClassName, child.props.className),
          style: { ...mergedStyle, ...child.props.style },
          ref,
        },
        <>
          {waveFillSpans}
          {child.props.children}
        </>,
      );
    }

    return (
      <button
        ref={ref}
        className={mergedClassName}
        style={mergedStyle}
        {...props}
      >
        {waveFillSpans}
        {children}
      </button>
    );
  },
);

AnimatedButton.displayName = "AnimatedButton";

export { AnimatedButton };
