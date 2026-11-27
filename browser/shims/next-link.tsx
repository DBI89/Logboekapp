import type { AnchorHTMLAttributes, ReactNode } from "react";
import { router } from "../router";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode; scroll?: boolean; prefetch?: boolean };

export default function Link({ href, onClick, children, scroll: _scroll, prefetch: _prefetch, ...rest }: Props) {
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
