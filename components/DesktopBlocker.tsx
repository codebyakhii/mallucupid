
import React, { useEffect, useState } from 'react';

const DesktopBlocker: React.FC = () => {
  const [securityWarning, setSecurityWarning] = useState<string>('');

  useEffect(() => {
    // Anti-Screenshot & Screen Recording Protection
    const preventScreenCapture = () => {
      // Block PrintScreen key
      const blockPrintScreen = (e: KeyboardEvent) => {
        if (e.key === 'PrintScreen' || e.keyCode === 44) {
          e.preventDefault();
          setSecurityWarning('⚠️ Screenshots are not allowed!');
          setTimeout(() => setSecurityWarning(''), 3000);
          
          // Clear clipboard
          navigator.clipboard.writeText('');
        }
      };

      // Detect screenshot attempts (Windows Snipping Tool, etc.)
      const detectScreenshotShortcuts = (e: KeyboardEvent) => {
        // Windows: Win+Shift+S, Win+PrtScn
        if ((e.key === 's' || e.key === 'S') && e.shiftKey && e.metaKey) {
          e.preventDefault();
          setSecurityWarning('⚠️ Screenshot blocked!');
          setTimeout(() => setSecurityWarning(''), 3000);
        }
        // Mac: Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5
        if ((e.key === '3' || e.key === '4' || e.key === '5') && e.shiftKey && e.metaKey) {
          e.preventDefault();
          setSecurityWarning('⚠️ Screenshot blocked!');
          setTimeout(() => setSecurityWarning(''), 3000);
        }
      };

      document.addEventListener('keyup', blockPrintScreen);
      document.addEventListener('keydown', detectScreenshotShortcuts);

      return () => {
        document.removeEventListener('keyup', blockPrintScreen);
        document.removeEventListener('keydown', detectScreenshotShortcuts);
      };
    };

    // Anti-DevTools & Debugger Detection
    const detectDevTools = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      if (widthThreshold || heightThreshold) {
        setSecurityWarning('⚠️ Developer tools detected!');
        // Optionally redirect or block
        document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#ef4444;color:white;font-size:24px;text-align:center;padding:20px;">🚫 Developer tools are not allowed.<br/>Please close DevTools and refresh.</div>';
      }
    };

    // Debugger trap
    const antiDebugger = () => {
      setInterval(() => {
        const startTime = performance.now();
        debugger; // This will pause execution if DevTools is open
        const endTime = performance.now();
        
        // If more than 100ms passed, debugger was active
        if (endTime - startTime > 100) {
          setSecurityWarning('⚠️ Debugger detected!');
          window.location.href = 'about:blank';
        }
      }, 1000);
    };

    // Disable right-click context menu
    const disableRightClick = (e: MouseEvent) => {
      e.preventDefault();
      setSecurityWarning('⚠️ Right-click is disabled!');
      setTimeout(() => setSecurityWarning(''), 2000);
    };

    // Disable text selection and copy
    const disableSelection = () => {
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
    };

    // Prevent drag and drop
    const preventDragDrop = (e: DragEvent) => {
      e.preventDefault();
    };

    // Blur detection (user switched away - might be recording)
    const detectBlur = () => {
      if (document.hidden) {
        setSecurityWarning('⚠️ Screen recording suspected!');
      }
    };

    // Screen Recording Detection (MediaRecorder API)
    const detectScreenRecording = async () => {
      try {
        // @ts-ignore - Check if screen capture is active
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          const checkRecording = setInterval(() => {
            // Check for active media streams
            // @ts-ignore
            if (window.MediaRecorder && window.MediaRecorder.state === 'recording') {
              setSecurityWarning('⚠️ Screen recording detected!');
              clearInterval(checkRecording);
            }
          }, 2000);
        }
      } catch (err) {
        console.log('Screen recording detection not supported');
      }
    };

    // Initialize all protections
    const cleanupScreenCapture = preventScreenCapture();
    disableSelection();
    document.addEventListener('contextmenu', disableRightClick);
    document.addEventListener('dragstart', preventDragDrop);
    document.addEventListener('drop', preventDragDrop);
    document.addEventListener('visibilitychange', detectBlur);
    
    // Check for DevTools periodically
    const devToolsInterval = setInterval(detectDevTools, 1000);
    
    // Start anti-debugger (commented out by default as it's aggressive)
    // antiDebugger();
    
    detectScreenRecording();

    // Cleanup
    return () => {
      if (cleanupScreenCapture) cleanupScreenCapture();
      document.removeEventListener('contextmenu', disableRightClick);
      document.removeEventListener('dragstart', preventDragDrop);
      document.removeEventListener('drop', preventDragDrop);
      document.removeEventListener('visibilitychange', detectBlur);
      clearInterval(devToolsInterval);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-pink-600 to-red-500 z-[9999] flex flex-col items-center justify-center p-8 text-center text-white select-none">
      {securityWarning && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-lg shadow-2xl animate-pulse z-[10000] font-bold">
          {securityWarning}
        </div>
      )}
      
      <div className="bg-white/10 p-10 rounded-3xl backdrop-blur-xl border border-white/20 shadow-2xl max-w-sm select-none">
        <div className="mb-6">
          <svg className="w-20 h-20 mx-auto animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold mb-4">Mobile Experience Only</h1>
        <p className="text-lg opacity-90 leading-relaxed">
          Mallu Cupid is designed exclusively for mobile and tablet devices. 
        </p>
        <p className="mt-4 text-sm font-medium bg-white/20 py-2 px-4 rounded-full">
          Please open this on your phone to find your match! ❤️
        </p>
        
        <div className="mt-6 text-xs opacity-70 space-y-1">
          <p>🔒 Screenshots blocked</p>
          <p>🔒 Screen recording prevented</p>
          <p>🔒 Developer tools disabled</p>
        </div>
      </div>
    </div>
  );
};

export default DesktopBlocker;
