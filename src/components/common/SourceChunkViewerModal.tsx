import React from 'react';
import { X, BookOpen, FileText, CheckCircle2, Copy, Check } from 'lucide-react';
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
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Determine what chunks to display
  const chunksToDisplay = material ? material.chunks : selectedChunk ? [selectedChunk] : [];
  const title = material
    ? material.title
    : selectedChunk
    ? 'materialTitle' in selectedChunk
      ? selectedChunk.materialTitle
      : 'Source Reference Chunk'
    : 'Course Document Chunks';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="source-inspector-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#0F172A] border border-slate-800 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#131B2E]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-950/60 border border-indigo-800/40 rounded-lg text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 id="source-inspector-title" className="text-base font-semibold text-slate-100">
                Source Grounding Inspector
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span className="font-mono text-indigo-400">{material?.courseCode || 'Course Material'}</span>
                <span aria-hidden="true">·</span>
                <span>{title}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational Subheader */}
        <div className="px-6 py-3 bg-slate-900/60 border-b border-slate-800/70 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              All citations link to verifiable text passages extracted from your course materials.
            </span>
          </div>
          <span className="text-slate-400 font-mono text-[11px]">
            {chunksToDisplay.length} {chunksToDisplay.length === 1 ? 'passage' : 'passages'} available
          </span>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {chunksToDisplay.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No extracted chunks indexed for this document yet.</p>
            </div>
          ) : (
            chunksToDisplay.map((chunk, idx) => {
              const text = 'extractedText' in chunk ? chunk.extractedText : chunk.excerpt;
              const heading = chunk.sectionHeading || `Section Anchor #${idx + 1}`;
              
              // Compute honest source anchor label without inventing fake page numbers
              let anchorDisplay = '';
              const docType = material?.fileType || ('documentType' in chunk ? chunk.documentType : undefined);
              const pNum = 'pageNumber' in chunk ? chunk.pageNumber : undefined;
              const sNum = 'slideNumber' in chunk ? chunk.slideNumber : undefined;

              if (docType === 'pdf' || (pNum !== undefined && !sNum)) {
                anchorDisplay = `Page ${pNum ?? chunk.pageOrSlideNumber ?? idx + 1}`;
              } else if (docType === 'pptx' || (sNum !== undefined)) {
                anchorDisplay = `Slide ${sNum ?? chunk.pageOrSlideNumber ?? idx + 1}`;
              } else {
                // Word, Markdown, Plain Text: use honest section/chunk anchor
                anchorDisplay =
                  ('anchorLabel' in chunk && chunk.anchorLabel)
                    ? chunk.anchorLabel
                    : `Section / Chunk ${idx + 1}`;
              }

              const docFilename =
                material?.filename ||
                ('filename' in chunk && chunk.filename) ||
                material?.title ||
                'Course Material';

              return (
                <div
                  key={'id' in chunk ? chunk.id : idx}
                  className="bg-[#0B0F19] border border-slate-800/90 rounded-lg p-4 transition-all hover:border-slate-700"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800/60">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-indigo-300">{heading}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-slate-300 font-mono font-medium">
                        {anchorDisplay}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-slate-400 font-mono text-[11px] truncate max-w-xs">
                        {docFilename}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopy(text)}
                      className="self-end sm:self-auto flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-300 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 transition-colors"
                      title="Copy excerpt text"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-sm text-slate-300 leading-relaxed font-sans font-normal whitespace-pre-wrap">
                    {text}
                  </p>

                  <div className="mt-3 pt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Source passage: Verbatim extracted text</span>
                    <span className="font-mono">
                      {'tokenEstimate' in chunk && chunk.tokenEstimate
                        ? `~${chunk.tokenEstimate} tokens`
                        : `${text.length} characters`}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-[#131B2E] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
