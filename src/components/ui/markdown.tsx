import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** Rendert Markdown sicher (kein rohes HTML). Externe Links öffnen mit rel=noopener. */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose-vgs", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: c }) => {
            const external = typeof href === "string" && /^https?:\/\//.test(href);
            return (
              <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {c}
              </a>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
