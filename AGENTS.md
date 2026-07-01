- when using TanStack libraries, load skills first.
- use Base UI (<https://base-ui.com/llms.txt>), DaisyUI v5 and TailwindCSS v4.
- Use unplugin-icons and lucide (for general purpose) / simple-icons (for popular brands).
- Streamdown is a React component library that makes rendering streaming Markdown content seamless and beautiful. Built specifically for AI-powered applications, it handles the unique challenges that arise when Markdown is tokenized and streamed in real-time. <https://streamdown.ai/llms.txt>
- Treat the folder `./SillyTavern/` as read-only.

<!-- intent-skills:start -->

## Skill Loading

Before editing files for a substantial task:

- Run `pnpm dlx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.

<!-- intent-skills:end -->
