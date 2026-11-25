import type { AnchorHTMLAttributes, ReactNode } from "react";
import { router } from "../router";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode };

export default function Link({ href, onClick, children, ...rest }: Props) {
  return (
    <a
      href={href}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        router.ga(href);
      }}
    >
      {children}
    </a>
  );
}
