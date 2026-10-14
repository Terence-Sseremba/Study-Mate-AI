import React from 'react';

interface StructuredMarkdownViewProps {
  content: string;
  className?: string;
}

/**
 * Parses inline formatting: bold, italic, bold-italic, inline code, math notation, and anchors.
 * Returns an array of ReactNodes without using dangerouslySetInnerHTML.
 */
function renderInlineContent(text: string): React.ReactNode[] {
  if (!text) return [];

  const nodes: React.ReactNode[] = [];
  // Tokenize regex for inline code (`...`), bold-italic (***...***), bold (**...**), italic (*...*), math ($...$)
  const tokenRegex = /(`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|\$[^$]+\$|\[[^\]]+\])/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `inline-${match.index}-${token.slice(0, 10)}`;

    if (token.startsWith('`') && token.endsWith('`')) {
      const code = token.slice(1, -1);
      nodes.push(
        <code
          key={key}
          className="font-mono text-[11px] sm:text-xs px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-indigo-300 font-medium"
        >
          {code}
        </code>
      );
    } else if (token.startsWith('***') && token.endsWith('***')) {
      const inner = token.slice(3, -3);
      nodes.push(
        <strong key={key} className="font-bold text-slate-100">
          <em className="italic">{inner}</em>
        </strong>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      const inner = token.slice(2, -2);
      nodes.push(
        <strong key={key} className="font-semibold text-slate-100">
          {inner}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      const inner = token.slice(1, -1);
      nodes.push(
        <em key={key} className="italic text-slate-300">
          {inner}
        </em>
      );
    } else if (token.startsWith('$') && token.endsWith('$')) {
      const math = token.slice(1, -1);
      nodes.push(
        <span
          key={key}
          className="font-mono text-xs px-1.5 py-0.5 rounded bg-amber-950/30 border border-amber-900/40 text-amber-200"
        >
          {math}
        </span>
      );
    } else if (token.startsWith('[') && token.endsWith(']')) {
      const inner = token.slice(1, -1);
      nodes.push(
        <span
          key={key}
          className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/50 text-indigo-300 font-medium inline-block"
        >
          {inner}
        </span>
      );
    } else {
      nodes.push(token);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

/**
 * Structured Markdown Parser & Renderer.
 * Turns raw model Markdown (###, **, -, 1., `, >) into clean, visually polished educational components.
 * Guarantees zero XSS risks and zero raw markdown artifacts.
 */
export const StructuredMarkdownView: React.FC<StructuredMarkdownViewProps> = ({
  content,
  className = '',
}) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLang = '';

  let listBuffer: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let paragraphBuffer: string[] = [];

  const flushParagraph = (idxKey: number) => {
    if (paragraphBuffer.length > 0) {
      const pText = paragraphBuffer.join(' ').trim();
      if (pText) {
        elements.push(
          <p
            key={`p-${idxKey}`}
            className="text-xs sm:text-sm text-slate-200 leading-relaxed my-1.5 font-sans"
          >
            {renderInlineContent(pText)}
          </p>
        );
      }
      paragraphBuffer = [];
    }
  };

  const flushList = (idxKey: number) => {
    if (listBuffer && listBuffer.items.length > 0) {
      if (listBuffer.type === 'ul') {
        elements.push(
          <ul key={`ul-${idxKey}`} className="space-y-1.5 my-2 pl-1">
            {listBuffer.items.map((item, itemIdx) => (
              <li
                key={`li-${idxKey}-${itemIdx}`}
                className="flex items-start gap-2 text-xs sm:text-sm text-slate-200 leading-snug"
              >
                <span className="text-indigo-400 mt-1 shrink-0 text-xs select-none">
                  •
                </span>
                <span className="flex-1">{renderInlineContent(item)}</span>
              </li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`ol-${idxKey}`} className="space-y-1.5 my-2 pl-1">
            {listBuffer.items.map((item, itemIdx) => (
              <li
                key={`oli-${idxKey}-${itemIdx}`}
                className="flex items-start gap-2 text-xs sm:text-sm text-slate-200 leading-snug"
              >
                <span className="font-mono text-xs font-semibold text-indigo-400 mt-0.5 shrink-0 select-none">
                  {itemIdx + 1}.
                </span>
                <span className="flex-1">{renderInlineContent(item)}</span>
              </li>
            ))}
          </ol>
        );
      }
      listBuffer = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 1. Code Block Delimiters
    if (trimmed.startsWith('```')) {
      flushParagraph(i);
      flushList(i);

      if (inCodeBlock) {
        // End code block
        elements.push(
          <div
            key={`code-block-${i}`}
            className="my-2.5 rounded-xl bg-[#080C14] border border-slate-800 p-3 overflow-x-auto text-xs font-mono text-indigo-200"
          >
            {codeLang && (
              <div className="text-[10px] uppercase font-mono text-slate-500 mb-1 border-b border-slate-800/80 pb-1">
                {codeLang}
              </div>
            )}
            <pre className="whitespace-pre">{codeBuffer.join('\n')}</pre>
          </div>
        );
        codeBuffer = [];
        inCodeBlock = false;
        codeLang = '';
      } else {
        // Start code block
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine);
      continue;
    }

    // 2. Horizontal Rule (--- or ***)
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      flushParagraph(i);
      flushList(i);
      elements.push(
        <hr key={`hr-${i}`} className="border-slate-800/80 my-3" />
      );
      continue;
    }

    // 3. Headings (####, ###, ##, #)
    if (trimmed.startsWith('#')) {
      flushParagraph(i);
      flushList(i);

      if (trimmed.startsWith('#### ')) {
        const title = trimmed.slice(5).trim();
        elements.push(
          <h4
            key={`h4-${i}`}
            className="text-xs font-semibold text-slate-200 mt-3 mb-1"
          >
            {renderInlineContent(title)}
          </h4>
        );
      } else if (trimmed.startsWith('### ')) {
        const title = trimmed.slice(4).trim();
        elements.push(
          <h3
            key={`h3-${i}`}
            className="text-xs sm:text-sm font-bold uppercase tracking-wider text-indigo-400 mt-3.5 mb-1.5"
          >
            {renderInlineContent(title)}
          </h3>
        );
      } else if (trimmed.startsWith('## ')) {
        const title = trimmed.slice(3).trim();
        elements.push(
          <h2
            key={`h2-${i}`}
            className="text-sm sm:text-base font-bold text-slate-100 mt-3.5 mb-1.5"
          >
            {renderInlineContent(title)}
          </h2>
        );
      } else if (trimmed.startsWith('# ')) {
        const title = trimmed.slice(2).trim();
        elements.push(
          <h1
            key={`h1-${i}`}
            className="text-base sm:text-lg font-bold text-slate-100 mt-4 mb-2"
          >
            {renderInlineContent(title)}
          </h1>
        );
      }
      continue;
    }

    // 4. Blockquotes (> ...)
    if (trimmed.startsWith('>')) {
      flushParagraph(i);
      flushList(i);
      const quoteText = trimmed.replace(/^>\s*/, '').trim();
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className="border-l-2 border-indigo-500/70 pl-3 py-1 my-2 bg-indigo-950/20 rounded-r text-xs sm:text-sm text-slate-300 italic"
        >
          {renderInlineContent(quoteText)}
        </blockquote>
      );
      continue;
    }

    // 5. Unordered List Items (- , * , • )
    const bulletMatch = /^[*\-•]\s+(.*)$/.exec(trimmed);
    if (bulletMatch) {
      flushParagraph(i);
      if (!listBuffer || listBuffer.type !== 'ul') {
        flushList(i);
        listBuffer = { type: 'ul', items: [] };
      }
      listBuffer.items.push(bulletMatch[1]);
      continue;
    }

    // 6. Ordered List Items (1. , 2. , etc.)
    const orderedMatch = /^\d+\.\s+(.*)$/.exec(trimmed);
    if (orderedMatch) {
      flushParagraph(i);
      if (!listBuffer || listBuffer.type !== 'ol') {
        flushList(i);
        listBuffer = { type: 'ol', items: [] };
      }
      listBuffer.items.push(orderedMatch[1]);
      continue;
    }

    // 7. Empty lines (paragraph break)
    if (!trimmed) {
      flushParagraph(i);
      flushList(i);
      continue;
    }

    // 8. Normal paragraph lines
    paragraphBuffer.push(trimmed);
  }

  // Flush remaining buffers
  flushParagraph(lines.length);
  flushList(lines.length);

  return <div className={`space-y-1 ${className}`}>{elements}</div>;
};
