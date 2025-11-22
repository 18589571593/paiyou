import React, { useState } from 'react';
import { Button } from './Button';
import { TextProcessState } from '../types';

interface TranscriptionResultProps {
  text: string;
  isLoading: boolean;
  error: string | null;
  
  correctionState: TextProcessState;
  rewriteState: TextProcessState;
  
  onCorrection: () => void;
  onRewrite: (intensity: number) => void;
}

type ResultTab = 'original' | 'correction' | 'rewrite';

export const TranscriptionResult: React.FC<TranscriptionResultProps> = ({ 
  text, 
  isLoading, 
  error, 
  correctionState,
  rewriteState,
  onCorrection,
  onRewrite
}) => {
  const [activeTab, setActiveTab] = useState<ResultTab>('original');
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [rewriteIntensity, setRewriteIntensity] = useState<number>(5);

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopySuccess("已复制！");
    setTimeout(() => setCopySuccess(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="mt-8 p-8 border border-slate-200 rounded-2xl bg-white shadow-sm flex flex-col items-center justify-center min-h-[200px] text-center animate-pulse">
        <div className="h-12 w-12 text-blue-500 mb-4">
           <svg className="animate-spin w-full h-full" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">正在转录媒体内容...</h3>
        <p className="text-slate-500 max-w-md">
          这可能需要一些时间，具体取决于内容的长度。Gemini 2.5 Flash 正在处理您的请求。
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 p-6 border border-red-100 rounded-2xl bg-red-50 text-red-700 flex items-start gap-4">
        <svg className="w-6 h-6 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <h3 className="font-semibold mb-1">转录失败</h3>
          <p className="text-sm opacity-90">{error}</p>
        </div>
      </div>
    );
  }

  if (!text) return null;

  const getActiveContent = () => {
    switch (activeTab) {
      case 'original': return text;
      case 'correction': return correctionState.text;
      case 'rewrite': return rewriteState.text;
      default: return text;
    }
  };

  const renderTabButton = (id: ResultTab, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`
        flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2
        ${activeTab === id 
          ? 'border-blue-500 text-blue-600 bg-blue-50/50' 
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
        }
      `}
    >
      {icon}
      {label}
    </button>
  );

  const getIntensityLabel = (val: number) => {
    if (val <= 3) return "保守微调 (仅同义词替换)";
    if (val <= 7) return "平衡润色 (优化语序和结构)";
    return "深度改写 (重塑风格和措辞)";
  };

  return (
    <div className="mt-8 border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden flex flex-col">
      {/* Header & Tabs */}
      <div className="flex flex-col border-b border-slate-100">
        <div className="px-6 py-4 flex items-center justify-between bg-slate-50/30">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            文本结果
          </h3>
          <div className="flex gap-2">
             {getActiveContent() && (
               <Button variant="ghost" size="sm" onClick={() => handleCopy(getActiveContent()!)}>
                 {copySuccess ? (
                    <span className="text-green-600 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                        {copySuccess}
                    </span>
                 ) : (
                   <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    复制内容
                   </>
                 )}
               </Button>
             )}
          </div>
        </div>
        <div className="flex px-2 bg-slate-50/30">
          {renderTabButton('original', '原始结果', 
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" /></svg>
          )}
          {renderTabButton('correction', 'AI 智能纠错', 
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          )}
          {renderTabButton('rewrite', 'AI 仿写洗稿', 
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-6 min-h-[300px] max-h-[600px] overflow-y-auto bg-slate-50 relative">
        
        {/* Tab: Original */}
        {activeTab === 'original' && (
          <div className="prose prose-slate max-w-none whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-700 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            {text}
          </div>
        )}

        {/* Tab: Correction */}
        {activeTab === 'correction' && (
          <div className="h-full">
            {!correctionState.text && !correctionState.isProcessing && !correctionState.error ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                 <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                 </div>
                 <h4 className="text-lg font-medium text-slate-900 mb-2">智能文本纠错</h4>
                 <p className="text-slate-500 max-w-sm mb-6">AI 将自动修复标点符号、断句和错别字，让文本更加通顺。</p>
                 <Button onClick={onCorrection}>开始纠错</Button>
              </div>
            ) : correctionState.isProcessing ? (
              <div className="flex flex-col items-center justify-center h-full py-12 animate-pulse">
                 <div className="h-8 w-8 mb-4">
                    <svg className="animate-spin w-full h-full text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 </div>
                 <p className="text-slate-600 font-medium">AI 正在分析并修正文本...</p>
              </div>
            ) : correctionState.error ? (
               <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-100">
                 <p>{correctionState.error}</p>
                 <Button variant="ghost" onClick={onCorrection} className="mt-2 text-red-600 hover:bg-red-100">重试</Button>
               </div>
            ) : (
              <div className="prose prose-slate max-w-none whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-700 bg-white p-6 rounded-xl border border-yellow-200 shadow-sm">
                {correctionState.text}
              </div>
            )}
          </div>
        )}

        {/* Tab: Rewrite */}
        {activeTab === 'rewrite' && (
          <div className="h-full">
            {!rewriteState.text && !rewriteState.isProcessing && !rewriteState.error ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                 <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                 </div>
                 <h4 className="text-lg font-medium text-slate-900 mb-2">AI 智能仿写洗稿</h4>
                 <p className="text-slate-500 max-w-sm mb-6">AI 将通过同义词替换和语序调整，重新组织语言，生成一篇意思相同但表述不同的文章。</p>
                 
                 {/* Intensity Slider */}
                 <div className="w-full max-w-xs mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">洗稿强度</span>
                      <span className="text-sm font-bold text-purple-600">{rewriteIntensity}</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      step="1"
                      value={rewriteIntensity} 
                      onChange={(e) => setRewriteIntensity(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                    <p className="text-xs text-slate-500 mt-2 text-left">
                      {getIntensityLabel(rewriteIntensity)}
                    </p>
                 </div>

                 <Button onClick={() => onRewrite(rewriteIntensity)} className="bg-purple-600 hover:bg-purple-700 focus:ring-purple-500">开始洗稿</Button>
              </div>
            ) : rewriteState.isProcessing ? (
              <div className="flex flex-col items-center justify-center h-full py-12 animate-pulse">
                 <div className="h-8 w-8 mb-4">
                    <svg className="animate-spin w-full h-full text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 </div>
                 <p className="text-slate-600 font-medium">AI 正在重新组织语言...</p>
              </div>
            ) : rewriteState.error ? (
               <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-100">
                 <p>{rewriteState.error}</p>
                 <Button variant="ghost" onClick={() => onRewrite(rewriteIntensity)} className="mt-2 text-red-600 hover:bg-red-100">重试</Button>
               </div>
            ) : (
              <div className="flex flex-col h-full">
                 {/* Show controls even after generation so user can regenerate */}
                 <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-100 flex items-center gap-4 justify-between">
                    <div className="flex-1">
                       <div className="flex justify-between text-xs mb-1 text-purple-800">
                          <span>调整强度重新生成</span>
                          <span>{rewriteIntensity} - {getIntensityLabel(rewriteIntensity)}</span>
                       </div>
                       <input 
                          type="range" 
                          min="1" 
                          max="10" 
                          value={rewriteIntensity} 
                          onChange={(e) => setRewriteIntensity(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        />
                    </div>
                    <Button size="sm" onClick={() => onRewrite(rewriteIntensity)} className="bg-purple-600 hover:bg-purple-700 text-xs px-3 py-1 h-auto">
                      重新洗稿
                    </Button>
                 </div>
                 <div className="prose prose-slate max-w-none whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-700 bg-white p-6 rounded-xl border border-purple-200 shadow-sm flex-1">
                   {rewriteState.text}
                 </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};