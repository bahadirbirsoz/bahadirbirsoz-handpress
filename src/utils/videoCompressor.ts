import { CompressionSettings, VideoQueueItem } from '../types';

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  thumbnailUrl: string;
}

/**
 * Probes video duration, dimensions, and captures a representative thumbnail frame
 */
export async function getVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
    };

    video.onloadedmetadata = () => {
      const duration = video.duration || 0;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;

      // Seek to 0.5s or 10% of video to grab a thumbnail frame
      const seekTime = Math.min(1.0, duration > 1 ? duration * 0.1 : 0.1);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        // Thumbnail size max 320px wide
        const maxThumbWidth = 320;
        const scale = Math.min(1, maxThumbWidth / (video.videoWidth || 1));
        canvas.width = Math.max(64, Math.round((video.videoWidth || 320) * scale));
        canvas.height = Math.max(36, Math.round((video.videoHeight || 180) * scale));

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.65);
          cleanup();
          resolve({
            duration: video.duration || 1,
            width: video.videoWidth || 1280,
            height: video.videoHeight || 720,
            thumbnailUrl,
          });
          return;
        }
      } catch (err) {
        console.warn('Thumbnail generation error, using fallback', err);
      }
      cleanup();
      resolve({
        duration: video.duration || 1,
        width: video.videoWidth || 1280,
        height: video.videoHeight || 720,
        thumbnailUrl: '',
      });
    };

    video.onerror = (e) => {
      cleanup();
      reject(new Error(`Failed to load video file: ${file.name}`));
    };

    // Timeout safety
    setTimeout(() => {
      if (video.readyState < 1) {
        cleanup();
        reject(new Error(`Video metadata loading timed out for ${file.name}`));
      }
    }, 15000);
  });
}

/**
 * Calculates target dimensions based on preset/custom settings and aspect ratio
 */
export function calculateTargetDimensions(
  origW: number,
  origH: number,
  settings: CompressionSettings
): { width: number; height: number } {
  let targetW = origW;
  let targetH = origH;

  const aspectRatio = origW / Math.max(1, origH);

  if (settings.targetResolution === '1080p') {
    const maxBound = 1920;
    if (origW >= origH) {
      targetW = Math.min(origW, maxBound);
      targetH = Math.round(targetW / aspectRatio);
    } else {
      targetH = Math.min(origH, maxBound);
      targetW = Math.round(targetH * aspectRatio);
    }
  } else if (settings.targetResolution === '720p') {
    const maxBound = 1280;
    if (origW >= origH) {
      targetW = Math.min(origW, maxBound);
      targetH = Math.round(targetW / aspectRatio);
    } else {
      targetH = Math.min(origH, maxBound);
      targetW = Math.round(targetH * aspectRatio);
    }
  } else if (settings.targetResolution === '480p') {
    const maxBound = 854;
    if (origW >= origH) {
      targetW = Math.min(origW, maxBound);
      targetH = Math.round(targetW / aspectRatio);
    } else {
      targetH = Math.min(origH, maxBound);
      targetW = Math.round(targetH * aspectRatio);
    }
  } else if (settings.targetResolution === '360p') {
    const maxBound = 640;
    if (origW >= origH) {
      targetW = Math.min(origW, maxBound);
      targetH = Math.round(targetW / aspectRatio);
    } else {
      targetH = Math.min(origH, maxBound);
      targetW = Math.round(targetH * aspectRatio);
    }
  } else if (settings.targetResolution === 'custom') {
    if (settings.lockAspectRatio) {
      targetW = settings.customWidth || 1280;
      targetH = Math.round(targetW / aspectRatio);
    } else {
      targetW = settings.customWidth || 1280;
      targetH = settings.customHeight || 720;
    }
  }

  // Ensure width and height are even integers (required by H.264 / VP8 / VP9 encoders)
  targetW = Math.max(32, Math.round(targetW / 2) * 2);
  targetH = Math.max(32, Math.round(targetH / 2) * 2);

  return { width: targetW, height: targetH };
}

/**
 * Calculates video bitrate taking into account target file size cap or explicit bitrate
 */
export function calculateBitrates(
  duration: number,
  settings: CompressionSettings
): { videoBps: number; audioBps: number } {
  const audioBps = settings.muteAudio ? 0 : (settings.audioBitrateKbps || 128) * 1000;

  if (settings.targetMaxMB && settings.targetMaxMB > 0) {
    // Reserve ~6% for container and index overhead
    const targetBytes = settings.targetMaxMB * 1024 * 1024 * 0.94;
    const dur = Math.max(1, duration);
    const totalBitrate = (targetBytes * 8) / dur;
    const computedVideoBps = Math.floor(totalBitrate - audioBps);
    // Floor at 150 kbps, ceiling at 12 Mbps
    const videoBps = Math.min(12000000, Math.max(150000, computedVideoBps));
    return { videoBps, audioBps };
  }

  const videoBps = (settings.videoBitrateKbps || 1400) * 1000;
  return { videoBps, audioBps };
}

/**
 * Finds best supported MIME type on user's browser/Android device
 */
export function getSupportedMimeType(preferred: 'mp4' | 'webm'): { mimeType: string; format: 'mp4' | 'webm' } {
  const mp4Candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.4d401f,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4',
  ];

  const webmCandidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264',
    'video/webm',
  ];

  const candidates = preferred === 'mp4' 
    ? [...mp4Candidates, ...webmCandidates]
    : [...webmCandidates, ...mp4Candidates];

  for (const candidate of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(candidate)) {
      const isMp4 = candidate.startsWith('video/mp4');
      return { mimeType: candidate, format: isMp4 ? 'mp4' : 'webm' };
    }
  }

  // Generic fallback
  return { mimeType: 'video/webm', format: 'webm' };
}

export interface CompressionProgressPayload {
  progress: number;
  currentFps: number;
  elapsedSeconds: number;
  estimatedRemainingSeconds: number;
}

/**
 * Compresses a single video completely offline using Canvas, Web Audio, and MediaRecorder
 */
export async function compressVideoFile(
  item: VideoQueueItem,
  settings: CompressionSettings,
  onProgress: (payload: CompressionProgressPayload) => void,
  abortSignal?: AbortSignal
): Promise<{
  blob: Blob;
  size: number;
  width: number;
  height: number;
  format: 'mp4' | 'webm';
}> {
  return new Promise(async (resolve, reject) => {
    let audioCtx: AudioContext | null = null;
    let videoUrl = '';
    let animFrameId: number | null = null;
    let mediaRecorder: MediaRecorder | null = null;

    const { width: targetWidth, height: targetHeight } = calculateTargetDimensions(
      item.originalWidth,
      item.originalHeight,
      settings
    );

    const { videoBps, audioBps } = calculateBitrates(item.duration, settings);
    const { mimeType, format } = getSupportedMimeType(settings.preferredFormat);

    const video = document.createElement('video');
    video.muted = false; // Must be false so Web Audio can extract the track
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    videoUrl = URL.createObjectURL(item.file);
    video.src = videoUrl;

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

    if (!ctx) {
      URL.revokeObjectURL(videoUrl);
      return reject(new Error('Canvas 2D context not available'));
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const recordedChunks: Blob[] = [];
    const startTime = performance.now();
    let frameCount = 0;
    let lastFpsUpdate = performance.now();
    let currentFps = 0;

    const cleanup = () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try {
          mediaRecorder.stop();
        } catch (_) {}
      }
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
      video.pause();
      video.removeAttribute('src');
      video.load();
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        cleanup();
        reject(new Error('Compression cancelled by user'));
      });
    }

    video.onloadeddata = async () => {
      try {
        const fps = typeof settings.fps === 'number' ? settings.fps : 30;
        const canvasStream = canvas.captureStream(fps);

        // Capture Audio via Web Audio API without blasting to device speakers
        let combinedStream = canvasStream;
        if (!settings.muteAudio) {
          try {
            const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            audioCtx = new AudioContextClass();
            if (audioCtx.state === 'suspended') {
              await audioCtx.resume();
            }

            const sourceNode = audioCtx.createMediaElementSource(video);
            const destinationNode = audioCtx.createMediaStreamDestination();
            sourceNode.connect(destinationNode);
            // Notice: We deliberately do NOT connect to audioCtx.destination,
            // preventing the phone speakers from playing the audio while compressing!

            const audioTracks = destinationNode.stream.getAudioTracks();
            if (audioTracks.length > 0) {
              combinedStream = new MediaStream([
                ...canvasStream.getVideoTracks(),
                ...audioTracks,
              ]);
            }
          } catch (audioErr) {
            console.warn('Audio extraction bypassed (silent or restricted track)', audioErr);
          }
        }

        const recorderOptions: MediaRecorderOptions = {
          mimeType,
          videoBitsPerSecond: videoBps,
        };
        if (!settings.muteAudio && audioBps > 0) {
          recorderOptions.audioBitsPerSecond = audioBps;
        }

        try {
          mediaRecorder = new MediaRecorder(combinedStream, recorderOptions);
        } catch (recInitErr) {
          // Fallback to basic MediaRecorder without bitrate parameters if browser prefers
          mediaRecorder = new MediaRecorder(combinedStream);
        }

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunks.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          cleanup();
          const finalBlob = new Blob(recordedChunks, { type: mimeType });
          resolve({
            blob: finalBlob,
            size: finalBlob.size,
            width: targetWidth,
            height: targetHeight,
            format,
          });
        };

        mediaRecorder.onerror = (recErr) => {
          cleanup();
          reject(new Error(`Recorder error: ${recErr.error?.message || 'Encoding failed'}`));
        };

        // Start recording with 500ms time slice
        mediaRecorder.start(500);

        // Frame rendering loop
        const drawFrame = () => {
          if (abortSignal?.aborted) return;

          if (!video.paused && !video.ended) {
            ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
            frameCount++;

            // Calculate FPS & ETA every 500ms
            const now = performance.now();
            if (now - lastFpsUpdate >= 500) {
              const deltaSec = (now - lastFpsUpdate) / 1000;
              currentFps = Math.round(frameCount / deltaSec);
              frameCount = 0;
              lastFpsUpdate = now;

              const elapsedSeconds = Math.round((now - startTime) / 1000);
              const progress = Math.min(99, Math.round((video.currentTime / Math.max(0.1, video.duration)) * 100));
              const remainingProgress = 100 - progress;
              const rate = progress / Math.max(0.1, elapsedSeconds);
              const estimatedRemainingSeconds = rate > 0 ? Math.round(remainingProgress / rate) : 0;

              onProgress({
                progress,
                currentFps,
                elapsedSeconds,
                estimatedRemainingSeconds,
              });
            }

            animFrameId = requestAnimationFrame(drawFrame);
          }
        };

        video.onended = () => {
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            // Give a tiny moment for final frames to be ingested
            setTimeout(() => {
              try {
                mediaRecorder?.stop();
              } catch (_) {}
            }, 300);
          }
        };

        // Start video playback
        await video.play();
        animFrameId = requestAnimationFrame(drawFrame);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error(`Failed to decode video file: ${item.name}`));
    };
  });
}

/**
 * Triggers native browser download for saved file
 */
export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
}

/**
 * Generates sample demo video locally using Canvas and Web Audio (no internet required)
 */
export async function createDemoVideoFile(): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d')!;

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/mp4' });
      const file = new File([blob], 'android_camera_sample.mp4', { type: 'video/mp4' });
      resolve(file);
    };

    recorder.start();

    let frame = 0;
    const totalFrames = 120; // 4 seconds at 30fps

    const render = () => {
      frame++;
      // Animated gradient background
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      const hue = (frame * 3) % 360;
      grad.addColorStop(0, `hsl(${hue}, 70%, 25%)`);
      grad.addColorStop(1, `hsl(${(hue + 80) % 360}, 65%, 15%)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Moving graphic circles
      for (let i = 0; i < 5; i++) {
        const x = (canvas.width / 2) + Math.cos((frame + i * 20) * 0.05) * 300;
        const y = (canvas.height / 2) + Math.sin((frame + i * 20) * 0.05) * 160;
        ctx.beginPath();
        ctx.arc(x, y, 40 + i * 8, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${(hue + i * 40) % 360}, 80%, 60%, 0.6)`;
        ctx.fill();
      }

      // Title Card
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HandPress 1080p Demo Clip', canvas.width / 2, canvas.height / 2 - 30);
      ctx.font = '24px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`Frame ${frame} / ${totalFrames} · Offline Test Footage`, canvas.width / 2, canvas.height / 2 + 30);

      if (frame < totalFrames) {
        requestAnimationFrame(render);
      } else {
        recorder.stop();
      }
    };

    requestAnimationFrame(render);
  });
}
