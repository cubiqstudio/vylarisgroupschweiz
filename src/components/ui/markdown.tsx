import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isOwnImageSrc } from "@/lib/markdown-safe";
import { cn } from "@/lib/utils";

function MarkdownImage({ src, alt }: { src?: string | Blob; alt?: string }) {
  if (!isOwnImageSrc(src)) return <span>{alt ?? ""}</span>;
  // eslint-disable-next-line @next/next/no-img-element -- Inhalt aus Markdown, Grösse unbekannt
  return <img src={src} alt={alt ?? ""} loading="lazy" />;
}

/** Rendert Markdown sicher (kein rohes HTML, keine Bilder von fremden Servern). Externe Links öffnen mit rel=noopener. */
export function Markdown({ children, className, size }: { children: string; className?: string; size?: "sm" }) {
  return (
    <div className={cn("prose-vgs", size === "sm" && "prose-vgs-sm", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Fremde Bilder werden nicht geladen (Datenschutz): stattdessen erscheint der Alternativtext.
          img: ({ src, alt }) => <MarkdownImage src={src} alt={alt} />,
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
