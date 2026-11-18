import GithubSlugger from "github-slugger";
import Link from "next/link";
import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { Diagram } from "./diagrams";
import { CodeBlock } from "./code-block";

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

/** Renders a doc body with anchored headings, internal links through next/link and cocoa code blocks. */
export function Markdown({ source }: { source: string }) {
  const slugger = new GithubSlugger();
  const heading = (Tag: "h2" | "h3") =>
    function Heading({ children }: { children?: ReactNode }) {
      const id = slugger.slug(textOf(Children.toArray(children)));
      return (
        <Tag id={id} className="group">
          <a href={`#${id}`} className="!font-[inherit] !text-inherit !no-underline">
            {children}
          </a>
        </Tag>
      );
    };

  const components: Components = {
    h1: heading("h2"),
    h2: heading("h2"),
    h3: heading("h3"),
    a: ({ href = "", children }) =>
      href.startsWith("/") ? (
        <Link href={href}>{children}</Link>
      ) : href.startsWith("#") ? (
        <a href={href}>{children}</a>
      ) : (
        <a href={href} target="_blank" rel="noreferrer">
          {children}
        </a>
      ),
    table: ({ children }) => (
      <div className="-mx-1 overflow-x-auto px-1">
        <table>{children}</table>
      </div>
    ),
    // A diagram fence renders a responsive flow or chart instead of a code block.
    pre: ({ children }) => {
      const child = Children.toArray(children)[0];
      if (isValidElement<{ className?: string; children?: ReactNode }>(child) && child.props.className?.includes("language-diagram")) {
        return <Diagram name={textOf(child.props.children)} />;
      }
      const language = isValidElement<{ className?: string }>(child)
        ? child.props.className?.match(/language-([\w-]+)/)?.[1] ?? ""
        : "";
      return <CodeBlock code={textOf(children)} language={language}>{children}</CodeBlock>;
    },
  };

  return (
    <div className="doc-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
