import React, { useState, useMemo } from 'react';
import katex from 'katex';
import { Copy, Check, Terminal, HelpCircle, Sparkles } from 'lucide-react';

interface FormattedMessageContentProps {
  text: string;
}

/**
 * Checks whether text inside $...$ is genuinely mathematical notation
 * rather than currency or natural language words.
 */
function isMathExpression(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;

  // Pandoc / LaTeX convention: no spaces directly adjacent to delimiters
  if (content.startsWith(' ') || content.endsWith(' ')) {
    return false;
  }

  // Pure numbers (like "$50", "$20.00", "$1,000") are currency, not math expressions
  if (/^\d+(?:,\d+)*(?:\.\d+)?$/.test(trimmed)) {
    return false;
  }

  // If it contains natural prose words (e.g. "$50 and the discount is $20")
  const commonWords = /\b(and|or|the|is|are|was|were|for|with|from|to|by|at|in|of|that|this|these|those|you|your|we|our|can|could|should|would|will|price|cost|fee|dollars|cents|discount|each|per|total)\b/i;
  if (commonWords.test(trimmed)) {
    return false;
  }

  // If it contains LaTeX commands: \frac, \cup, \sqrt, \alpha, \sum, etc.
  if (/\\[a-zA-Z]+/.test(trimmed)) return true;

  // If it contains math relations or operators: =, <, >, \le, \ge, \pm, +, -, *, /, ^, _, |, {, }
  if (/[=<>+\-^_|{}\[\]~]/.test(trimmed)) return true;

  // If it is a mathematical function or variable: e.g. x, y, E(X), P(X=x_i), f(x), n, k
  if (/^[a-zA-Z0-9\s()!.,\x27]+$/.test(trimmed)) {
    return true;
  }

  return true;
}

interface MathRendererProps {
  math: string;
  displayMode?: boolean;
}

/**
 * Safely renders LaTeX mathematical expressions using KaTeX.
 * KaTeX parses and produces secure MathML and HTML spans.
 */
const MathRenderer: React.FC<MathRendererProps> = React.memo(({ math, displayMode = false }) => {
  const renderedHtml = useMemo(() => {
    const cleaned = math.trim();
    if (!cleaned) return null;
    try {
      return katex.renderToString(cleaned, {
        displayMode,
        throwOnError: false,
        errorColor: '#f87171',
        strict: false,
        trust: false,
      });
    } catch {
      return null;
    }
  }, [math, displayMode]);

  if (!renderedHtml) {
    return <span className="font-mono text-xs text-amber-300">{math}</span>;
  }

  if (displayMode) {
    return (
      <div className="my-3 py-3 px-4 overflow-x-auto rounded-lg bg-[#0F172A]/80 border border-slate-800 text-slate-100 flex items-center justify-center shadow-inner">
        <span
          className="katex-display-inner select-text"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      </div>
    );
  }

  return (
    <span
      className="katex-inline-inner inline-block mx-0.5 align-baseline select-text text-indigo-100"
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
});

/**
 * Parses and renders inline content:
 * - Mathematical notation: \( ... \), $ ... $, raw LaTeX commands / set notation
 * - Bold: **bold**
 * - Italic: *italic*
 * - Code: `code`
 * - Plain text (with currency symbols preserved!)
 */
function renderInlineText(text: string): React.ReactNode {
  if (!text) return null;

  const tokens: { type: 'text' | 'math' | 'bold' | 'italic' | 'code'; value: string }[] = [];

  // Regex handles:
  // 1: Escaped dollar: \\\$
  // 2: Explicit LaTeX parens: \\\((.+?)\\\)
  // 3: Inline dollar math: \$([^\$\n]+?)\$
  // 4: Bold: \*\*([^*]+)\*\*
  // 5: Italic: \*([^*]+)\*
  // 6: Code: `([^`]+)`
  // 7: Raw LaTeX command sequence or set notation (e.g. \frac{1}{3}, \vec{n}, \{-1, 0, 1, 2\})
  const inlineRegex = /(\\\$)|(\\\(([\s\S]+?)\\\))|(\$([^\$\n]+?)\$)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\\[a-zA-Z]+(?:\{[^{}\n]*\}|\[[^\[\]\n]*\])*(?:(?:\s*\\[a-zA-Z]+|\s*[\+\-\*\/\=\<\>\_\^\|\cdot]|\s*\{[^{}\n]*\})*))|(\\\{[^{}\n]+\\\})/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      // Escaped dollar
      tokens.push({ type: 'text', value: '$' });
    } else if (match[2]) {
      // Explicit \( ... \)
      tokens.push({ type: 'math', value: match[3] });
    } else if (match[4]) {
      // $ ... $
      const content = match[5];
      if (isMathExpression(content)) {
        tokens.push({ type: 'math', value: content });
      } else {
        // Not math (e.g. currency string like "$50 and $20" where first pair was matched)
        tokens.push({ type: 'text', value: '$' });
        inlineRegex.lastIndex = match.index + 1;
        lastIndex = match.index + 1;
        continue;
      }
    } else if (match[6]) {
      tokens.push({ type: 'bold', value: match[7] });
    } else if (match[8]) {
      tokens.push({ type: 'italic', value: match[9] });
    } else if (match[10]) {
      tokens.push({ type: 'code', value: match[11] });
    } else if (match[12] || match[13]) {
      const mathStr = match[12] || match[13];
      tokens.push({ type: 'math', value: mathStr });
    }

    lastIndex = inlineRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) });
  }

  // Merge adjacent text tokens
  const mergedTokens: { type: 'text' | 'math' | 'bold' | 'italic' | 'code'; value: string }[] = [];
  for (const tok of tokens) {
    if (tok.type === 'text' && mergedTokens.length > 0 && mergedTokens[mergedTokens.length - 1].type === 'text') {
      mergedTokens[mergedTokens.length - 1].value += tok.value;
    } else {
      mergedTokens.push(tok);
    }
  }

  return mergedTokens.map((tok, idx) => {
    switch (tok.type) {
      case 'math':
        return <MathRenderer key={`m-${idx}`} math={tok.value} displayMode={false} />;
      case 'bold':
        return (
          <strong key={`b-${idx}`} className="font-semibold text-slate-100">
            {tok.value}
          </strong>
        );
      case 'italic':
        return (
          <em key={`i-${idx}`} className="italic text-slate-300">
            {tok.value}
          </em>
        );
      case 'code':
        return (
          <code
            key={`c-${idx}`}
            className="px-1.5 py-0.5 rounded bg-[#0B0F19] text-indigo-300 font-mono text-xs border border-slate-800"
          >
            {tok.value}
          </code>
        );
      default:
        return <span key={`t-${idx}`}>{tok.value}</span>;
    }
  });
}

interface CodeBlockProps {
  language: string;
  code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  return (
    <div className="my-2.5 rounded-lg overflow-hidden border border-slate-800 bg-[#0B0F19]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5 font-mono text-xs text-indigo-400">
          <Terminal className="w-3.5 h-3.5" />
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-300 transition-colors px-1.5 py-0.5 rounded hover:bg-slate-800"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs font-mono text-slate-200 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};

export const FormattedMessageContent: React.FC<FormattedMessageContentProps> = ({ text }) => {
  if (!text) return null;

  // Split top-level content into major blocks:
  // 1. Code blocks: ```...```
  // 2. Display math blocks: $$...$$ or \[...\] or \begin{...}...\end{...}
  const blockRegex = /(```[\s\S]*?```|\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\begin\{[a-zA-Z*]+\}[\s\S]*?\\end\{[a-zA-Z*]+\})/g;
  const parts = text.split(blockRegex);

  return (
    <div className="space-y-3 font-sans text-xs sm:text-sm text-slate-200 leading-relaxed">
      {parts.map((part, partIdx) => {
        if (!part) return null;

        // Code block
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          const firstLine = lines[0].trim();
          const language = /^[a-zA-Z0-9_-]+$/.test(firstLine) ? firstLine : '';
          const codeContent = language ? lines.slice(1).join('\n') : lines.join('\n');

          return (
            <CodeBlock
              key={`cb-${partIdx}`}
              language={language}
              code={codeContent}
            />
          );
        }

        // Display math block $$ ... $$
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const math = part.slice(2, -2).trim();
          return (
            <MathRenderer
              key={`dm-${partIdx}`}
              math={math}
              displayMode={true}
            />
          );
        }

        // Display math block \[ ... \]
        if (part.startsWith('\\[') && part.endsWith('\\]')) {
          const math = part.slice(2, -2).trim();
          return (
            <MathRenderer
              key={`dm-${partIdx}`}
              math={math}
              displayMode={true}
            />
          );
        }

        // Display math environment \begin{...}...\end{...}
        if (part.startsWith('\\begin{') && part.includes('\\end{')) {
          return (
            <MathRenderer
              key={`dm-${partIdx}`}
              math={part.trim()}
              displayMode={true}
            />
          );
        }

        // Standard markdown blocks (paragraphs, headings, lists, blockquotes)
        const lines = part.split('\n');
        const renderedElements: React.ReactNode[] = [];
        let currentListItems: { type: 'bullet' | 'number'; number?: string; content: string }[] = [];

        const flushList = (key: string) => {
          if (currentListItems.length === 0) return;

          const isNumbered = currentListItems[0].type === 'number';
          if (isNumbered) {
            renderedElements.push(
              <ol key={`list-${key}`} className="space-y-1.5 my-2 pl-1">
                {currentListItems.map((item, idx) => (
                  <li key={`li-${idx}`} className="flex items-start gap-2">
                    <span className="font-mono text-xs font-semibold text-indigo-400 shrink-0 select-none">
                      {item.number || `${idx + 1}.`}
                    </span>
                    <span className="flex-1 leading-relaxed text-slate-200">
                      {renderInlineText(item.content)}
                    </span>
                  </li>
                ))}
              </ol>
            );
          } else {
            renderedElements.push(
              <ul key={`list-${key}`} className="space-y-1.5 my-2 pl-1">
                {currentListItems.map((item, idx) => (
                  <li key={`li-${idx}`} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 shrink-0 select-none" />
                    <span className="flex-1 leading-relaxed text-slate-200">
                      {renderInlineText(item.content)}
                    </span>
                  </li>
                ))}
              </ul>
            );
          }

          currentListItems = [];
        };

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmed = line.trim();

          // Empty line
          if (!trimmed) {
            flushList(`empty-${i}`);
            continue;
          }

          // Bullet list item (- or * or •)
          const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
          if (bulletMatch) {
            if (currentListItems.length > 0 && currentListItems[0].type !== 'bullet') {
              flushList(`bullet-switch-${i}`);
            }
            currentListItems.push({ type: 'bullet', content: bulletMatch[1] });
            continue;
          }

          // Numbered list item (1. or 2.)
          const numberMatch = trimmed.match(/^(\d+[\.\)])\s+(.+)$/);
          if (numberMatch) {
            if (currentListItems.length > 0 && currentListItems[0].type !== 'number') {
              flushList(`number-switch-${i}`);
            }
            currentListItems.push({
              type: 'number',
              number: numberMatch[1],
              content: numberMatch[2],
            });
            continue;
          }

          // Flush any pending list before handling headings, quotes, or regular text
          flushList(`flush-${i}`);

          // Headings
          if (trimmed.startsWith('### ')) {
            renderedElements.push(
              <h4
                key={`h4-${i}`}
                className="text-xs sm:text-sm font-bold text-slate-100 mt-3 pt-1 text-indigo-300 flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                {renderInlineText(trimmed.slice(4))}
              </h4>
            );
            continue;
          }

          if (trimmed.startsWith('## ')) {
            renderedElements.push(
              <h3
                key={`h3-${i}`}
                className="text-sm sm:text-base font-bold text-slate-100 mt-3.5 pb-1 border-b border-slate-800 text-indigo-200"
              >
                {renderInlineText(trimmed.slice(3))}
              </h3>
            );
            continue;
          }

          if (trimmed.startsWith('# ')) {
            renderedElements.push(
              <h2
                key={`h2-${i}`}
                className="text-base sm:text-lg font-bold text-slate-100 mt-4 pb-1 border-b border-slate-700"
              >
                {renderInlineText(trimmed.slice(2))}
              </h2>
            );
            continue;
          }

          // Blockquotes (> )
          if (trimmed.startsWith('> ')) {
            renderedElements.push(
              <blockquote
                key={`bq-${i}`}
                className="border-l-2 border-indigo-500/70 bg-indigo-950/20 px-3 py-2 rounded-r-md text-slate-300 italic text-xs sm:text-sm my-2"
              >
                {renderInlineText(trimmed.slice(2))}
              </blockquote>
            );
            continue;
          }

          // Horizontal rule
          if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
            renderedElements.push(
              <hr key={`hr-${i}`} className="border-slate-800 my-2.5" />
            );
            continue;
          }

          // Pedagogical callout card: Comprehension Check / Knowledge Check / Guided Inquiry
          const isCheckCallout =
            trimmed.toLowerCase().includes('comprehension check') ||
            trimmed.toLowerCase().includes('knowledge check') ||
            trimmed.toLowerCase().includes('guided inquiry');

          if (isCheckCallout) {
            renderedElements.push(
              <div
                key={`check-${i}`}
                className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-800/50 my-2 text-indigo-200 flex items-start gap-2.5"
              >
                <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs sm:text-sm leading-relaxed">
                  {renderInlineText(trimmed)}
                </div>
              </div>
            );
            continue;
          }

          // Standalone formula line (e.g. A \cup B = \{-1,0,1,2,3\} or \sqrt{x - 3} < 2)
          // If a line is pure LaTeX formula without markdown or english prose
          if (
            !trimmed.startsWith('#') &&
            !trimmed.startsWith('-') &&
            !trimmed.startsWith('*') &&
            (/\\[a-zA-Z]+/.test(trimmed) || /\\\{[^{}]+\\\}/.test(trimmed)) &&
            !/\b(the|is|and|or|are|this|that|with|for|you|your|we|our|can)\b/i.test(trimmed)
          ) {
            renderedElements.push(
              <MathRenderer
                key={`solo-math-${i}`}
                math={trimmed.replace(/^\$+|\$+$/g, '').trim()}
                displayMode={true}
              />
            );
            continue;
          }

          // Standard paragraph line
          renderedElements.push(
            <p key={`p-${i}`} className="leading-relaxed text-slate-200">
              {renderInlineText(trimmed)}
            </p>
          );
        }

        flushList('final');

        return <div key={`std-${partIdx}`} className="space-y-2">{renderedElements}</div>;
      })}
    </div>
  );
};
