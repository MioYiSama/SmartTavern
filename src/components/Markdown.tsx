import { createCjkPlugin } from "@streamdown/cjk";
import { createCodePlugin } from "@streamdown/code";
import { createMathPlugin } from "@streamdown/math";
import { createMermaidPlugin } from "@streamdown/mermaid";
import { Streamdown, StreamdownProps, type Components } from "streamdown";

const code = createCodePlugin({ themes: ["github-light", "github-dark"] });
const mermaid = createMermaidPlugin();
const math = createMathPlugin({ singleDollarTextMath: true });
const cjk = createCjkPlugin();

// Streamdown wraps images in a <div> and adds a download <button>. Inside a
// paragraph (<p><img></p>) or a link (<a><img></a>) that produces invalid HTML
// (<div> in <p>, <button> in <button>) and hydration errors. Render a plain
// <img> instead, keeping Streamdown's default image styling.
const components: Components = {
  img: ({ node: _node, alt, ...props }) => (
    <img alt={alt} className="my-4 max-w-full rounded-lg" {...props} />
  ),
};

export default function Markdown({
  content,
  mode,
}: {
  content: string;
  mode?: StreamdownProps["mode"];
}) {
  return (
    <Streamdown mode={mode} components={components} plugins={{ code, mermaid, math, cjk }}>
      {content}
    </Streamdown>
  );
}
