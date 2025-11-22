import React, { useState, useRef, useEffect } from 'react';
import { Button } from './components/Button';
import { Tabs } from './components/Tabs';
import { TranscriptionResult } from './components/TranscriptionResult';
import { transcribeMedia, correctText, rewriteText } from './services/geminiService';
import { fileToBase64, formatTime, getMimeType, extractAudioFromVideo } from './utils/fileHelpers';
import { AudioSourceType, TranscriptionState, TextProcessState, MediaFile, RecordingStatus } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>(AudioSourceType.FILE);
  const [fileData, setFileData] = useState<MediaFile>({ file: null, previewUrl: null, type: null });
  
  // Main Transcription State
  const [transcription, setTranscription] = useState<TranscriptionState>({
    text: '',
    isProcessing: false,
    error: null
  });

  // Additional AI Features State
  const [correction, setCorrection] = useState<TextProcessState>({
    text: null,
    isProcessing: false,
    error: null
  });

  const [rewrite, setRewrite] = useState<TextProcessState>({
    text: null,
    isProcessing: false,
    error: null
  });

  // Recording State
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  
  // UX Status message for extra processing (extracting audio)
  const [statusMessage, setStatusMessage] = useState<string>('');

  // PWA Install Prompt State
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null); 
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Store the mime type used for the current recording
  const recordingMimeTypeRef = useRef<string>('');

  // Cleanup on unmount & PWA Install Listener
  useEffect(() => {
    // PWA Install Listener
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      stopMediaTracks();
      if (fileData.previewUrl) URL.revokeObjectURL(fileData.previewUrl);
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    // Show the install prompt
    installPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const stopMediaTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const type = file.type.startsWith('video') ? 'video' : 'audio';
      setFileData({
        file,
        previewUrl: URL.createObjectURL(file),
        type
      });
      resetResultStates();
    }
  };

  const resetResultStates = () => {
    setTranscription({ text: '', isProcessing: false, error: null });
    setCorrection({ text: null, isProcessing: false, error: null });
    setRewrite({ text: null, isProcessing: false, error: null });
  };

  const startRecording = async (source: 'mic' | 'system') => {
    try {
      resetResultStates();
      let stream: MediaStream;
      let mimeType = '';
      
      if (source === 'system') {
        // Capture system audio AND video via display media
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true, 
          audio: true
        });
        
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          stream.getTracks().forEach(track => track.stop());
          throw new Error("未共享系统音频。请确保在弹出的窗口中勾选“分享音频”选项。");
        }
        
        streamRef.current = stream;
        
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            stopRecording();
          };
        }

        // Prioritize MP4 if supported
        if (MediaRecorder.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
          mimeType = 'video/webm;codecs=vp9';
        } else {
          mimeType = 'video/webm';
        }

      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        mimeType = 'audio/webm;codecs=opus';
      }

      recordingMimeTypeRef.current = mimeType;
      const options = { mimeType };

      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Use the stored mimeType to create the Blob
        const blob = new Blob(chunksRef.current, {
          type: recordingMimeTypeRef.current
        });
        setRecordedBlob(blob);
        stopMediaTracks();
        if (timerRef.current) clearInterval(timerRef.current);
        setRecordingStatus('idle');
        setRecordingTime(0);
      };

      mediaRecorder.start(1000);
      setRecordingStatus('recording');
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error("录制错误:", err);
      let errorMessage = err.message || "无法开始录制。请检查权限设置。";
      if (err.name === 'NotAllowedError') {
        errorMessage = "您取消了录制或拒绝了权限请求。";
      } else if (err.message.includes('permission')) {
        errorMessage = "权限被拒绝。请检查浏览器设置。";
      }

      setTranscription({
        ...transcription,
        error: errorMessage
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleDownloadVideo = () => {
    if (!recordedBlob) return;
    
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    
    // Dynamically determine extension based on the actual blob type
    let ext = 'webm';
    if (recordedBlob.type.includes('mp4')) {
      ext = 'mp4';
    } else if (recordedBlob.type.includes('webm')) {
      ext = 'webm';
    }
    
    const date = new Date().toISOString().slice(0, 19).replace(/[-:]/g, "");
    a.download = `PaiYou_Recording_${date}.${ext}`;
    
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const handleTranscribe = async () => {
    let blobToProcess: Blob | null = null;
    let isVideo = false;

    if (activeTab === AudioSourceType.FILE) {
      blobToProcess = fileData.file;
      isVideo = fileData.type === 'video';
    } else {
      blobToProcess = recordedBlob;
      isVideo = activeTab === AudioSourceType.SYSTEM;
    }

    if (!blobToProcess) return;

    // Reset previous auxiliary results
    setCorrection({ text: null, isProcessing: false, error: null });
    setRewrite({ text: null, isProcessing: false, error: null });
    setTranscription({ text: '', isProcessing: true, error: null });
    setStatusMessage('');

    try {
      let finalBlob = blobToProcess;
      let mimeType = '';

      if (isVideo) {
        setStatusMessage('正在从视频中提取音频以加快处理速度...');
        await new Promise(r => setTimeout(r, 100));
        
        try {
          finalBlob = await extractAudioFromVideo(blobToProcess);
          mimeType = 'audio/wav';
        } catch (e) {
          console.warn("Audio extraction failed, falling back to full video upload.", e);
          mimeType = blobToProcess.type || 'video/webm';
        }
      } else {
         if (activeTab === AudioSourceType.FILE) {
            mimeType = blobToProcess.type || getMimeType('file.mp3');
         } else {
            mimeType = 'audio/webm';
         }
      }

      setStatusMessage('正在发送至 AI 进行转录...');
      const base64 = await fileToBase64(finalBlob);
      
      const result = await transcribeMedia(base64, mimeType);
      setTranscription({ text: result, isProcessing: false, error: null });
    } catch (error: any) {
      setTranscription({ 
        text: '', 
        isProcessing: false, 
        error: error.message || "转录失败。" 
      });
    } finally {
      setStatusMessage('');
    }
  };

  const handleCorrection = async () => {
    if (!transcription.text) return;
    setCorrection({ ...correction, isProcessing: true, error: null });
    try {
      const result = await correctText(transcription.text);
      setCorrection({ text: result, isProcessing: false, error: null });
    } catch (error: any) {
      setCorrection({ text: null, isProcessing: false, error: error.message });
    }
  };

  const handleRewrite = async (intensity: number) => {
    if (!transcription.text) return;
    setRewrite({ ...rewrite, isProcessing: true, error: null });
    try {
      const result = await rewriteText(transcription.text, intensity);
      setRewrite({ text: result, isProcessing: false, error: null });
    } catch (error: any) {
      setRewrite({ text: null, isProcessing: false, error: error.message });
    }
  };

  const reset = () => {
    setRecordedBlob(null);
    setFileData({ file: null, previewUrl: null, type: null });
    resetResultStates();
    setStatusMessage('');
    stopMediaTracks();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Corporate Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo Placeholder - User should replace 'logo.png' in public folder */}
            <div className="relative h-16 w-auto flex-shrink-0 overflow-hidden">
               <img 
                 src="./logo.png" 
                 alt="排忧旅行社 Logo" 
                 className="h-full w-auto object-contain"
                 onError={(e) => {
                   // Fallback if image not found
                   e.currentTarget.style.display = 'none';
                   e.currentTarget.parentElement!.classList.add('bg-red-50', 'w-16', 'rounded-lg', 'flex', 'items-center', 'justify-center');
                   e.currentTarget.parentElement!.innerHTML = '<span class="text-xs text-red-800 font-bold">Logo</span>';
                 }}
               />
            </div>
            <div className="flex flex-col justify-center h-full py-2 border-l border-slate-200 pl-4 ml-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">
                排忧旅行社
              </h1>
              <p className="text-xs text-slate-500 mt-1 font-medium tracking-wide uppercase">
                Travel Without Worry
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* PWA Install Button */}
            {installPrompt && (
              <button 
                onClick={handleInstallClick}
                className="hidden md:inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" /></svg>
                安装到桌面
              </button>
            )}

            <div className="hidden md:block text-right mr-4">
              <p className="text-sm font-semibold text-slate-800">智能语音工作台</p>
              <p className="text-xs text-slate-400">Internal Workbench v2.0</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
              <svg className="mr-1.5 h-2 w-2 fill-blue-500" viewBox="0 0 6 6" aria-hidden="true">
                <circle cx="3" cy="3" r="3" />
              </svg>
              内部系统 · 请勿外传
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          
          {/* Welcome / Hero Section */}
          <div className="text-center mb-10">
             <h2 className="text-3xl font-bold text-slate-900 mb-3">
               一旅解千愁，办公无忧虑
             </h2>
             <p className="text-slate-600 max-w-2xl mx-auto">
               欢迎使用排忧旅行社内部 AI 助手。支持会议录音转写、文案智能纠错与风格洗稿，助力提升工作效率。
             </p>
          </div>

          {/* Main Tool Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-1 bg-gradient-to-r from-red-800 via-red-600 to-blue-800"></div> {/* Corporate color stripe */}
            <div className="p-6 sm:p-8">
              
              <Tabs 
                activeTab={activeTab}
                onChange={(id) => {
                  setActiveTab(id);
                  reset();
                }}
                items={[
                  { 
                    id: AudioSourceType.FILE, 
                    label: '文件上传', 
                    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> 
                  },
                  { 
                    id: AudioSourceType.MICROPHONE, 
                    label: '现场录音', 
                    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg> 
                  },
                  { 
                    id: AudioSourceType.SYSTEM, 
                    label: '系统内录', 
                    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2-2h-8a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> 
                  }
                ]}
              />

              <div className="mt-8">
                {/* Tab Content: File Upload */}
                {activeTab === AudioSourceType.FILE && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className={`
                      relative border-2 border-dashed rounded-xl p-12 text-center transition-all
                      ${fileData.file ? 'border-blue-300 bg-blue-50/30' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}
                    `}>
                      <input
                        type="file"
                        accept="audio/*,video/*"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      {!fileData.file ? (
                        <>
                          <div className="mx-auto w-16 h-16 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center mb-4 shadow-inner">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                          </div>
                          <p className="text-lg font-medium text-slate-700">点击或拖拽上传会议/视频文件</p>
                          <p className="text-slate-500 mt-2 text-sm">支持 MP3, WAV, MP4, MOV 等格式</p>
                        </>
                      ) : (
                        <div className="flex flex-col items-center">
                          <div className="mx-auto w-16 h-16 bg-green-100 text-green-700 rounded-full flex items-center justify-center mb-4 shadow-inner">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                          </div>
                          <p className="text-lg font-medium text-slate-900 truncate max-w-md">{fileData.file.name}</p>
                          <p className="text-slate-500 mt-1 text-sm">{(fileData.file.size / (1024 * 1024)).toFixed(2)} MB</p>
                          <div className="mt-6 w-full max-w-md">
                            {fileData.type === 'video' ? (
                               // eslint-disable-next-line jsx-a11y/media-has-caption
                              <video src={fileData.previewUrl!} controls className="w-full rounded-lg shadow-md bg-black max-h-64" />
                            ) : (
                               // eslint-disable-next-line jsx-a11y/media-has-caption
                              <audio src={fileData.previewUrl!} controls className="w-full" />
                            )}
                          </div>
                          <Button variant="ghost" onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            reset();
                          }} className="mt-4 text-red-600 hover:bg-red-50">
                            更换文件
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab Content: Recording */}
                {(activeTab === AudioSourceType.MICROPHONE || activeTab === AudioSourceType.SYSTEM) && (
                  <div className="flex flex-col items-center justify-center space-y-8 py-10 animate-in fade-in duration-300 border-2 border-transparent rounded-xl bg-slate-50/50">
                    
                    {/* Timer Display */}
                    {recordingStatus === 'recording' && (
                      <div className="text-6xl font-mono font-light text-slate-800 tabular-nums tracking-wider">
                        <div className="flex items-center gap-4">
                          <span className="relative flex h-5 w-5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-5 w-5 bg-red-600"></span>
                          </span>
                          {formatTime(recordingTime)}
                        </div>
                      </div>
                    )}

                    {/* Idle State Instructions */}
                    {recordingStatus === 'idle' && !recordedBlob && (
                      <div className="text-center space-y-3">
                         <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4 shadow-sm border border-white ${activeTab === AudioSourceType.SYSTEM ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'}`}>
                            {activeTab === AudioSourceType.SYSTEM ? (
                              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2-2h-8a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            ) : (
                               <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                            )}
                         </div>
                         <h3 className="text-lg font-medium text-slate-900">
                           {activeTab === AudioSourceType.SYSTEM ? "系统音频内录" : "麦克风录音"}
                         </h3>
                         <p className="text-slate-500 max-w-xs mx-auto text-sm">
                           {activeTab === AudioSourceType.SYSTEM 
                             ? "适用于录制在线会议、视频素材。请在浏览器弹窗中勾选“分享音频”。"
                             : "适用于录制个人语音笔记或现场对话。"}
                         </p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-4">
                      {recordingStatus === 'idle' && !recordedBlob && (
                        <Button 
                          onClick={() => startRecording(activeTab === AudioSourceType.MICROPHONE ? 'mic' : 'system')}
                          className="w-56 h-14 text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-transform bg-blue-700 hover:bg-blue-800"
                        >
                          {activeTab === AudioSourceType.SYSTEM ? "启动内录" : "开始录音"}
                        </Button>
                      )}

                      {recordingStatus === 'recording' && (
                        <Button 
                          variant="danger" 
                          onClick={stopRecording}
                          className="w-56 h-14 text-lg shadow-lg animate-pulse"
                        >
                          结束录制
                        </Button>
                      )}

                      {recordedBlob && (
                        <div className="w-full flex flex-col items-center gap-6 animate-in zoom-in duration-300">
                           <div className="w-full max-w-lg p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                               {activeTab === AudioSourceType.SYSTEM ? (
                                 // eslint-disable-next-line jsx-a11y/media-has-caption
                                 <video src={URL.createObjectURL(recordedBlob)} controls className="w-full rounded-lg shadow-inner bg-black max-h-64" />
                               ) : (
                                 // eslint-disable-next-line jsx-a11y/media-has-caption
                                 <audio src={URL.createObjectURL(recordedBlob)} controls className="w-full" />
                               )}
                           </div>
                           
                           <div className="flex gap-3">
                              {activeTab === AudioSourceType.SYSTEM && (
                                <Button variant="secondary" onClick={handleDownloadVideo}>
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" /></svg>
                                  {recordedBlob.type.includes('mp4') ? '下载录像 (MP4)' : '下载录像 (WebM)'}
                                </Button>
                              )}
                              <Button variant="secondary" onClick={reset}>
                                重新录制
                              </Button>
                           </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Transcribe Button Area */}
                <div className="mt-10 pt-8 border-t border-slate-100 flex flex-col items-center">
                   <Button 
                      onClick={handleTranscribe} 
                      disabled={(!fileData.file && !recordedBlob) || transcription.isProcessing}
                      isLoading={transcription.isProcessing}
                      className="w-full sm:w-auto min-w-[240px] text-lg h-14 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300"
                      icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      }
                   >
                     {transcription.isProcessing ? 'AI 正在分析处理...' : '生成智能转录文本'}
                   </Button>
                   
                   {statusMessage && (
                     <p className="mt-4 text-sm text-blue-700 font-medium animate-pulse flex items-center gap-2">
                       <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                       {statusMessage}
                     </p>
                   )}
                </div>
              </div>
            </div>
          </div>

          {/* Results Section */}
          <TranscriptionResult 
            text={transcription.text}
            isLoading={transcription.isProcessing}
            error={transcription.error}
            correctionState={correction}
            rewriteState={rewrite}
            onCorrection={handleCorrection}
            onRewrite={handleRewrite}
          />
          
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
             <div className="h-8 w-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-500">
               排忧
             </div>
             <p className="text-sm text-slate-500">
               &copy; {new Date().getFullYear()} 排忧旅行社. All rights reserved.
             </p>
          </div>
          <div className="flex gap-6 text-sm text-slate-400">
            <span>内部办公系统</span>
            <span>数据安全合规</span>
            <span>技术支持: IT 部</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;