import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Share2, ExternalLink, Save } from 'lucide-react';
import { cn } from '../lib/utils';

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  title: string;
  fileName: string;
}

export default function PDFPreviewModal({ isOpen, onClose, pdfUrl, title, fileName }: PDFPreviewModalProps) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = fileName;
    link.click();
  };

  const handleExport = async () => {
    try {
      if ('showSaveFilePicker' in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'PDF Document',
            accept: { 'application/pdf': ['.pdf'] },
          }],
        });
        const writable = await handle.createWritable();
        const response = await fetch(pdfUrl);
        const blob = await response.blob();
        await writable.write(blob);
        await writable.close();
      } else {
        handleDownload();
      }
    } catch (err) {
      // If user cancels or something goes wrong, we don't necessarily want to force a download
      // but AbortError is expected if user closes the dialog.
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Export failed:', err);
        handleDownload();
      }
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        const response = await fetch(pdfUrl);
        const blob = await response.blob();
        const file = new File([blob], fileName, { type: 'application/pdf' });
        await navigator.share({
          files: [file],
          title: title,
          text: 'Check out this document',
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      handleDownload();
    }
  };

  const handleOpenNewTab = () => {
    // For blob URLs, sometimes direct window.open can be blocked or empty
    const win = window.open();
    if (win) {
      win.document.write(
        `<iframe src="${pdfUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`
      );
      win.document.title = title;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose} 
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.9, y: 20 }} 
            className="relative w-full h-full max-w-5xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 md:p-8 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{title}</h2>
                <p className="text-xs text-slate-500 font-bold tracking-widest uppercase mt-1">{fileName}</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleOpenNewTab}
                  className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title="Full screen view"
                >
                  <ExternalLink size={20} />
                </button>
                <button 
                  onClick={onClose} 
                  className="p-3 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Viewer */}
            <div className="flex-1 bg-slate-100 dark:bg-slate-800 p-2 md:p-4 overflow-hidden flex flex-col items-center justify-center relative">
               <iframe 
                src={pdfUrl} 
                className="w-full h-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white shadow-inner"
                title="PDF Preview"
                key={pdfUrl}
               />
               <div className="absolute inset-0 pointer-events-none flex items-center justify-center -z-10">
                 <div className="flex flex-col items-center gap-4 text-slate-400">
                    <div className="w-12 h-12 border-4 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
                    <p className="font-bold text-sm uppercase tracking-widest">Rendering PDF...</p>
                 </div>
               </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 md:p-8 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                    <button 
                      onClick={handleDownload}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
                    >
                      <Download size={18} />
                      Download PDF
                    </button>
                    <button 
                      onClick={handleExport}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
                    >
                      <Save size={18} />
                      Export to PC
                    </button>
                </div>
                
                <button 
                  onClick={handleShare}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                >
                  <Share2 size={18} />
                  Share Document
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
