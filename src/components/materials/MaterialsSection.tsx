import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  AlertCircle,
  BookOpen,
  Search,
  Trash2,
  Eye,
  Info,
  PlusCircle,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { StudyMaterial, DocumentType } from '../../types';
import {
  processUploadedDocument,
  classifyUploadedFile,
} from '../../lib/documentExtraction';

interface MaterialsSectionProps {
  materials: StudyMaterial[];
  onAddMaterial: (material: StudyMaterial) => void;
  onDeleteMaterial: (materialId: string) => void;
  onInspectMaterial: (material: StudyMaterial) => void;
  onSelectMaterialForTutor: (material: StudyMaterial) => void;
}

export const MaterialsSection: React.FC<MaterialsSectionProps> = ({
  materials,
  onAddMaterial,
  onDeleteMaterial,
  onInspectMaterial,
  onSelectMaterialForTutor,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndProcessFile = async (file: File) => {
    setUploadError(null);

    // 1. Real file-type classification
    const classification = classifyUploadedFile(file);
    if (!classification.isSupported) {
      setUploadError(
        classification.unsupportedReason ||
          `Unsupported file type "${file.name}". StudyMate AI accepts PDF (.pdf), Word (.docx), PowerPoint (.pptx), Markdown (.md), and Text (.txt).`
      );
      return;
    }

    // 2. Empty file check
    if (file.size === 0) {
      setUploadError('The uploaded file is empty (0 bytes). Please upload a valid course document.');
      return;
    }

    // 3. File size ceiling (30MB)
    if (file.size > 30 * 1024 * 1024) {
      setUploadError(
        `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the 30MB limit. Please upload a smaller document.`
      );
      return;
    }

    // 4. Real extraction pipeline
    setIsProcessing(true);
    setProcessingStage('Reading binary document...');

    try {
      const newMaterial = await processUploadedDocument(file, (stage) => {
        setProcessingStage(stage);
      });

      onAddMaterial(newMaterial);
      setUploadError(null);
    } catch (err: any) {
      console.error('Document processing error:', err);
      setUploadError(
        err?.message || 'Failed to extract text from document. Please verify the file is not corrupted.'
      );
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const courses = Array.from(new Set(materials.map((m) => m.courseCode)));

  const filteredMaterials = materials.filter((m) => {
    const matchesCourse = selectedCourse === 'all' || m.courseCode === selectedCourse;
    const matchesSearch =
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.courseCode.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCourse && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Study Materials</h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Upload your course PDFs, lecture slides, and notes. The AI tutor only answers using these indexed chunks.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="font-mono text-slate-200 font-bold">{materials.length}</span>
          <span>documents indexed</span>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center transition-all ${
          dragActive
            ? 'border-indigo-500 bg-indigo-950/20'
            : 'border-slate-800 bg-[#0F172A] hover:border-slate-700'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.pptx,.ppt,.txt,.md,.markdown"
          className="hidden"
          onChange={handleFileChange}
        />

        {isProcessing ? (
          <div className="py-4 space-y-3">
            <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div className="text-sm font-semibold text-slate-200">
              Processing Document & Extracting Passages
            </div>
            <p className="text-xs text-indigo-400 font-mono animate-pulse">
              {processingStage}
            </p>
            <p className="text-[11px] text-slate-400">
              Performing genuine text extraction and anchoring source locations...
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-950/70 border border-indigo-800/40 text-indigo-400 mx-auto flex items-center justify-center">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
              >
                Click to browse
              </button>{' '}
              <span className="text-sm text-slate-300">or drag & drop your course documents here</span>
            </div>
            <p className="text-xs text-slate-400">
              Supported formats: PDF (.pdf), Word (.docx), PowerPoint (.pptx), Markdown (.md), Plain Text (.txt) — up to 30MB
            </p>
          </div>
        )}

        {uploadError && (
          <div className="mt-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2 max-w-lg mx-auto">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="text-left">{uploadError}</p>
          </div>
        )}
      </div>

      {/* Grounding Info Notice */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3.5 flex items-start gap-3 text-xs text-slate-400">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-medium text-slate-300">Verifiable Grounding Guarantee:</span>
          <p>
            Click <strong className="text-slate-200">"Inspect Chunks"</strong> on any material to read the verbatim text passages, page numbers, and slide anchors extracted from your uploaded file. Grounding only cites text actually present in your document.
          </p>
        </div>
      </div>

      {/* Materials List or Empty State */}
      {materials.length === 0 ? (
        /* Empty State */
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-8 sm:p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-950/60 border border-indigo-800/40 text-indigo-400 mx-auto flex items-center justify-center shadow-inner">
            <FileText className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-base sm:text-lg font-bold text-slate-100">
              No study materials uploaded yet
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Upload your lecture slides (PDF/PPTX), Word documents (.docx), textbook chapters, or Markdown/TXT notes to build your grounded study space.
              StudyMate AI will extract real passages so your tutor and assessments are strictly grounded.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-all inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Upload your first material</span>
            </button>
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400 font-mono">
            <span>PDF Textbooks</span>
            <span aria-hidden="true">·</span>
            <span>Word Documents</span>
            <span aria-hidden="true">·</span>
            <span>PPTX Slides</span>
            <span aria-hidden="true">·</span>
            <span>Markdown Notes</span>
            <span aria-hidden="true">·</span>
            <span>Plain Text</span>
          </div>
        </div>
      ) : (
        /* Populated Materials Table & Filters */
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            {/* Course Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setSelectedCourse('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                  selectedCourse === 'all'
                    ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                All Documents ({materials.length})
              </button>
              {courses.map((course) => (
                <button
                  key={course}
                  onClick={() => setSelectedCourse(course)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                    selectedCourse === course
                      ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/60'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {course}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search documents or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0F172A] border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
            </div>
          </div>

          {/* Materials Cards */}
          <div className="space-y-3">
            {filteredMaterials.length === 0 ? (
              <div className="text-center py-12 bg-[#0F172A] border border-slate-800 rounded-xl space-y-2">
                <FileText className="w-10 h-10 mx-auto text-slate-400" />
                <div className="text-sm font-semibold text-slate-300">No matching documents found</div>
                <p className="text-xs text-slate-400">
                  Try adjusting your search query or uploading another course file.
                </p>
              </div>
            ) : (
              filteredMaterials.map((material) => {
                // Determine normalized document label & badge styling
                let docTypeLabel = 'Document';
                let docBadgeClass = 'bg-slate-800 text-slate-300 border-slate-700';

                if (material.fileType === 'pdf') {
                  docTypeLabel = 'PDF';
                  docBadgeClass = 'bg-rose-950/60 text-rose-300 border-rose-800/60';
                } else if (material.fileType === 'docx') {
                  docTypeLabel = 'Word Document';
                  docBadgeClass = 'bg-blue-950/60 text-blue-300 border-blue-800/60';
                } else if (material.fileType === 'pptx' || material.fileType === 'slides') {
                  docTypeLabel = 'PowerPoint';
                  docBadgeClass = 'bg-amber-950/60 text-amber-300 border-amber-800/60';
                } else if (material.fileType === 'md') {
                  docTypeLabel = 'Markdown';
                  docBadgeClass = 'bg-purple-950/60 text-purple-300 border-purple-800/60';
                } else if (material.fileType === 'txt' || material.fileType === 'notes') {
                  docTypeLabel = 'Plain Text';
                  docBadgeClass = 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60';
                }

                // Determine honest unit string (pages for PDF, slides for PPTX, none for DOCX/MD/TXT)
                let unitString: string | null = null;
                if (material.fileType === 'pdf' && material.pageCount !== undefined) {
                  unitString = `${material.pageCount} ${material.pageCount === 1 ? 'page' : 'pages'}`;
                } else if (
                  (material.fileType === 'pptx' || material.fileType === 'slides') &&
                  material.slideCount !== undefined
                ) {
                  unitString = `${material.slideCount} ${material.slideCount === 1 ? 'slide' : 'slides'}`;
                }

                const isFailed = material.processingStatus === 'failed';
                const isPartial = material.processingStatus === 'partially_extracted';

                return (
                  <div
                    key={material.id}
                    className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-indigo-400 shrink-0 mt-0.5">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono text-indigo-400 font-semibold">
                            {material.courseCode}
                          </span>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${docBadgeClass}`}>
                            {docTypeLabel}
                          </span>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className="text-slate-400">{material.fileSizeFormatted}</span>
                          {isFailed && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-950 text-rose-300 border border-rose-800/70">
                              Extraction Failed
                            </span>
                          )}
                          {isPartial && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950 text-amber-300 border border-amber-800/70">
                              Partial Text
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-semibold text-slate-200">{material.title}</h3>
                        <div className="text-xs text-slate-400 font-mono flex flex-wrap items-center gap-2">
                          <span>{material.filename}</span>
                          {unitString && (
                            <>
                              <span aria-hidden="true" className="text-slate-600">·</span>
                              <span>{unitString}</span>
                            </>
                          )}
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          {isFailed ? (
                            <span className="text-rose-400">0 chunks indexed</span>
                          ) : (
                            <span className="text-emerald-400">{material.chunksCount} chunks indexed</span>
                          )}
                        </div>

                        {material.extractionError ? (
                          <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-start gap-2 mt-1">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                            <p>{material.extractionError}</p>
                          </div>
                        ) : (
                          material.statusMessage && (
                            <p className="text-[11px] text-slate-400">{material.statusMessage}</p>
                          )
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                      <button
                        onClick={() => onInspectMaterial(material)}
                        disabled={material.chunksCount === 0}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 text-xs font-medium border border-slate-800 transition-colors flex items-center gap-1.5"
                        title={material.chunksCount === 0 ? 'No chunks extracted from this document' : 'Inspect verbatim extracted passages and source citations'}
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Inspect Chunks</span>
                      </button>

                      <button
                        onClick={() => onSelectMaterialForTutor(material)}
                        disabled={material.chunksCount === 0}
                        className="px-3 py-1.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900/80 disabled:opacity-40 disabled:cursor-not-allowed text-indigo-300 text-xs font-medium border border-indigo-800/40 transition-colors flex items-center gap-1.5"
                        title={material.chunksCount === 0 ? 'Upload a document with extractable text to tutor' : 'Ask questions specifically about this material'}
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Ask Tutor</span>
                      </button>

                      <button
                        onClick={() => onDeleteMaterial(material.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
                        title="Delete document"
                        aria-label={`Delete ${material.title}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
