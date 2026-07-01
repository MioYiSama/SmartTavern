import { createCjkPlugin } from "@streamdown/cjk";
import { createCodePlugin } from "@streamdown/code";
import { createMathPlugin } from "@streamdown/math";
import { createMermaidPlugin } from "@streamdown/mermaid";
import { Streamdown, StreamdownProps } from "streamdown";

const code = createCodePlugin({ themes: ["github-light", "github-dark"] });
const mermaid = createMermaidPlugin();
const math = createMathPlugin({ singleDollarTextMath: true });
const cjk = createCjkPlugin();

export default function Markdown({
  content,
  mode,
}: {
  content: string;
  mode?: StreamdownProps["mode"];
}) {
  return (
    <Streamdown mode={mode} plugins={{ code, mermaid, math, cjk }}>
      {content}
    </Streamdown>
  );
}
