import React, { useEffect, useRef } from 'react';
import type { StudyMaterial, SourceChunk, SourceCitation } from '../../types';

interface SourceChunkViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  material?: StudyMaterial | null;
  selectedChunk?: SourceChunk | SourceCitation | null;
}

export const SourceChunkViewerModal: React.FC<SourceChunkViewerModalProps> = ({
  isOpen,
  onClose,
  material,
  selectedChunk,
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const highlightedRef = useRef<HTMLDivElement>(null);

  // When opening a specific citation or chunk, smoothly scroll to it in the document view
  useEffect(() => {
    if (isOpen && highlightedRef.current) {
      const timer = setTimeout(() => {
        highlightedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, selectedChunk, material]);

  if (!isOpen) return null;

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Determine what chunks to display
  const chunksToDisplay: (SourceChunk | SourceCitation)[] =
    material && material.chunks && material.chunks.length > 0
      ? material.chunks
      : selectedChunk
      ? [selectedChunk]
      : [];

  const title = material
    ? material.title
    : selectedChunk
    ? 'materialTitle' in selectedChunk
      ? selectedChunk.materialTitle
      : 'Source Reference Chunk'
    : 'Course Document Chunks';

  const targetChunkId =
    selectedChunk && 'chunkId' in selectedChunk
      ? selectedChunk.chunkId
      : selectedChunk && 'id' in selectedChunk
      ? selectedChunk.id
      : null;

  const citationAnchor =
    selectedChunk && 'anchorLabel' in selectedChunk
      ? selectedChunk.anchorLabel
      : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="source-inspector-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-background/40 backdrop-blur animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30 bg-surface-container-low">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-primary/10 rounded-xl text-primary shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-xl">menu_book</span>
            </div>
            <div className="min-w-0">
              <h2 id="source-inspector-title" className="text-base font-semibold text-on-surface flex items-center gap-2">
                <span>Source Grounding Inspector</span>
                {citationAnchor && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-semibold">
                    {citationAnchor}
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2 text-xs text-outline mt-0.5 truncate font-label-sm">
                <span className="text-primary font-semibold shrink-0">{material?.courseCode || 'Course Material'}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{title}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Verification banner */}
        <div className="px-6 py-2.5 bg-secondary-container/20 border-b border-secondary/20 flex items-center justify-between text-xs text-secondary font-medium">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">verified</span>
            Strict Verbatim Passage Index — No hallucinated grounding text
          </span>
          <span className="font-mono text-[11px] text-outline">
            {chunksToDisplay.length} passage{chunksToDisplay.length !== 1 ? 's' : ''} indexed
          </span>
        </div>

        {/* Chunks List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-background">
          {chunksToDisplay.length === 0 ? (
            <div className="text-center py-12 text-outline space-y-2">
              <span className="material-symbols-outlined text-4xl text-outline/50">description</span>
              <p className="text-sm">No extracted text chunks available for this source.</p>
            </div>
          ) : (
            chunksToDisplay.map((chunk, index) => {
              const chunkId = 'chunkId' in chunk ? chunk.chunkId : chunk.id;
              const isTarget = targetChunkId && chunkId === targetChunkId;
              const text = 'extractedText' in chunk ? chunk.extractedText : chunk.excerpt;
              const heading = chunk.sectionHeading || `Section ${index + 1}`;
              const anchor =
                chunk.anchorLabel ||
                ('pageNumber' in chunk && chunk.pageNumber
                  ? `Page ${chunk.pageNumber}`
                  : `Chunk ${index + 1}`);

              return (
                <div
                  key={chunkId || index}
                  ref={isTarget ? highlightedRef : null}
                  className={`rounded-xl border p-4 transition-all shadow-xs ${
                    isTarget
                      ? 'bg-secondary-container/20 border-secondary ring-2 ring-secondary/30'
                      : 'bg-surface-container-lowest border-outline-variant/30 hover:border-outline-variant/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-outline-variant/20">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-surface-container text-primary font-mono text-[11px] font-semibold">
                        {anchor}
                      </span>
                      <span className="text-xs font-semibold text-on-surface truncate">
                        {heading}
                      </span>
                      {isTarget && (
                        <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold">
                          Referenced Passage
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleCopy(chunkId || String(index), text)}
                      className="flex items-center gap-1 text-[11px] text-outline hover:text-primary transition-colors cursor-pointer px-2 py-1 rounded bg-surface-container-low hover:bg-surface-container"
                      title="Copy passage text"
                    >
                      <span className="material-symbols-outlined text-xs">
                        {copiedId === (chunkId || String(index)) ? 'check' : 'content_copy'}
                      </span>
                      <span>{copiedId === (chunkId || String(index)) ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <p className="font-body-md text-body-md text-on-surface text-sm leading-relaxed whitespace-pre-wrap">
                    {text}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-outline-variant/30 bg-surface-container-low flex items-center justify-between text-xs text-outline">
          <span>Verifiable attribution powered by StudyMate Grounding Index</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-primary text-on-primary hover:bg-primary-container text-xs font-semibold transition-colors cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
