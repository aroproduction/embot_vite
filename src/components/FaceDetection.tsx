import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { Camera, StopCircle, Play } from 'lucide-react';
import { motion } from 'framer-motion';

interface FaceDetectionProps {
  onEmotionDetected: (emotion: string) => void;
}

const FaceDetection: React.FC<FaceDetectionProps> = ({ onEmotionDetected }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [detectedEmotion, setDetectedEmotion] = useState<string | null>(null);
  const animationRef = useRef<number | null>(null);
  const videoSizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]).catch((e) => {
          console.error('Detailed error:', e);
          throw new Error('Failed to load face detection models');
        });

        setIsModelLoading(false);
        loadCameras();
      } catch (err) {
        setError('Failed to load models. Please check your internet connection and refresh the page.');
        console.error('Error loading models:', err);
      }
    };

    loadModels();

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
      stopVideo();
    };
  }, []);

  // Notify parent component when emotion changes
  useEffect(() => {
    if (detectedEmotion) {
      onEmotionDetected(detectedEmotion);
    }
  }, [detectedEmotion, onEmotionDetected]);

  const loadCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setCameras(videoDevices);
      if (videoDevices.length > 0) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    } catch (err) {
      setError('Unable to access camera list. Please check your permissions.');
      console.error('Error accessing cameras:', err);
    }
  };

  const stopVideo = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreamActive(false);
      
      // Clear any ongoing animation frame
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
  };

  const startVideo = async () => {
    try {
      stopVideo();
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            // Store original video dimensions
            videoSizeRef.current = {
              width: videoRef.current.videoWidth,
              height: videoRef.current.videoHeight
            };
            updateDimensions();
          }
        };
        setIsStreamActive(true);
      }
    } catch (err) {
      setError('Unable to access webcam. Please ensure you have granted camera permissions.');
      console.error('Error accessing webcam:', err);
    }
  };

  const calculateDisplayDimensions = () => {
    if (!videoRef.current || !containerRef.current) return null;
    
    const video = videoRef.current;
    const container = containerRef.current;
    
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    // Original video aspect ratio
    const videoRatio = videoSizeRef.current.width / videoSizeRef.current.height;
    
    let displayWidth, displayHeight;
    
    // Calculate dimensions to fit container while maintaining aspect ratio
    if (containerWidth / containerHeight > videoRatio) {
      // Container is wider than video
      displayHeight = containerHeight;
      displayWidth = containerHeight * videoRatio;
    } else {
      // Container is taller than video
      displayWidth = containerWidth;
      displayHeight = containerWidth / videoRatio;
    }
    
    // Calculate position to center the video
    const left = (containerWidth - displayWidth) / 2;
    const top = (containerHeight - displayHeight) / 2;
    
    return { width: displayWidth, height: displayHeight, left, top };
  };

  const updateDimensions = () => {
    if (!videoRef.current || !canvasRef.current || !containerRef.current) return null;
    
    const canvas = canvasRef.current;
    const dimensions = calculateDisplayDimensions();
    
    if (!dimensions) return null;
    
    // Set canvas size and position to match displayed video
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    canvas.style.left = `${dimensions.left}px`;
    canvas.style.top = `${dimensions.top}px`;
    
    // Update display size for face-api.js
    setDisplaySize({
      width: dimensions.width,
      height: dimensions.height
    });
    
    return dimensions;
  };

  const handleVideoPlay = () => {
    if (!canvasRef.current || !videoRef.current || !containerRef.current) return;

    // Initial dimensions update
    updateDimensions();

    const detectFaces = async () => {
      if (!videoRef.current || !canvasRef.current || !isStreamActive) {
        return;
      }

      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        const detections = await faceapi
          .detectAllFaces(
            video, 
            new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
          )
          .withFaceLandmarks()
          .withFaceExpressions();

        // Get the current display dimensions
        const currentDisplaySize = {
          width: canvas.width,
          height: canvas.height
        };

        const resizedDetections = faceapi.resizeResults(detections, currentDisplaySize);
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw face detections
        faceapi.draw.drawDetections(canvas, resizedDetections);
        
        // Draw face landmarks
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
        
        // Draw expressions and get dominant emotion
        if (resizedDetections.length > 0) {
          const detection = resizedDetections[0];
          const expressions = detection.expressions;
          const dominantExpression = Object.entries(expressions)
            .reduce((prev, current) => 
              prev[1] > current[1] ? prev : current
            );

          const { x, y, width } = detection.detection.box;
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fillRect(x, y - 25, width, 25);
          
          ctx.fillStyle = '#fff';
          ctx.font = '16px Arial';
          ctx.fillText(
            `${dominantExpression[0]} (${Math.round(dominantExpression[1] * 100)}%)`,
            x + 5,
            y - 5
          );

          // Update the detected emotion state if confidence is high enough
          if (dominantExpression[1] > 0.5) {
            setDetectedEmotion(dominantExpression[0]);
          }
        }
      } catch (err) {
        console.error('Error during face detection:', err);
      }

      if (isStreamActive) {
        animationRef.current = requestAnimationFrame(detectFaces);
      }
    };

    detectFaces();
  };

  // Handle resize events
  useEffect(() => {
    const handleResize = () => {
      if (isStreamActive) {
        updateDimensions();
      }
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isStreamActive]);

  // Add resize observer to handle container size changes
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (isStreamActive) {
        updateDimensions();
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isStreamActive]);

  // Update dimensions when video metadata loads
  useEffect(() => {
    const video = videoRef.current;
    
    if (!video) return;
    
    const handleLoadedMetadata = () => {
      videoSizeRef.current = {
        width: video.videoWidth,
        height: video.videoHeight
      };
      updateDimensions();
    };
    
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [videoRef.current]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-red-50 rounded-lg">
        <p className="text-red-600 mb-2">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isModelLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-2">Loading models...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <motion.div 
        className="flex flex-wrap gap-4 items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <select
          value={selectedCamera}
          onChange={(e) => setSelectedCamera(e.target.value)}
          className="flex-1 min-w-[150px] px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
        >
          {cameras.map((camera) => (
            <option key={camera.deviceId} value={camera.deviceId}>
              {camera.label || `Camera ${camera.deviceId.slice(0, 5)}...`}
            </option>
          ))}
        </select>
        
        <motion.button
          onClick={isStreamActive ? stopVideo : startVideo}
          whileTap={{ scale: 0.95 }}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200 ${
            isStreamActive 
              ? 'bg-red-600 hover:bg-red-700 text-white' 
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isStreamActive ? (
            <>
              <StopCircle className="w-5 h-5" />
              Stop
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Start
            </>
          )}
        </motion.button>
      </motion.div>

      <motion.div 
        ref={containerRef} 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative rounded-lg overflow-hidden bg-gray-900 flex-grow flex items-center justify-center"
        style={{ minHeight: "250px" }}
      >
        {!isStreamActive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-gray-400 flex flex-col items-center justify-center"
          >
            <Camera className="w-10 h-10 mb-2" />
            <p>Click Start to enable camera</p>
          </motion.div>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onPlay={handleVideoPlay}
          className="max-h-full max-w-full object-contain"
          style={{ display: isStreamActive ? 'block' : 'none' }}
        />
        <canvas
          ref={canvasRef}
          className="absolute pointer-events-none"
          style={{ display: isStreamActive ? 'block' : 'none' }}
        />
      </motion.div>
    </div>
  );
};

export default FaceDetection;