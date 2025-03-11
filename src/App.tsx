import React, { useState, useCallback } from 'react';
import FaceDetection from './components/FaceDetection';
import ChatInterface from './components/ChatInterface';
import ThemeToggle from './components/ThemeToggle';
import { motion } from 'framer-motion';
import { useTheme } from './context/ThemeContext';

function App() {
  const [currentEmotion, setCurrentEmotion] = useState<string | null>(null);
  const { theme } = useTheme();

  const handleEmotionDetected = useCallback((emotion: string) => {
    setCurrentEmotion(emotion);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-300 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 text-center relative">
          <motion.div 
            className="absolute top-0 right-0"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <ThemeToggle />
          </motion.div>
          
          <motion.h1
            className="text-3xl font-bold text-gray-900 dark:text-gray-50 mb-2"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Emotion-Powered Chatbot
          </motion.h1>
          
          <motion.p
            className="text-gray-600 dark:text-gray-400"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Chat with an AI that responds based on your facial expressions
          </motion.p>
        </header>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Emotion Detection Card */}
          <motion.div
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg flex flex-col h-[600px] transition-colors duration-300"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Emotion Detection</h2>
            <div className="flex-1 overflow-hidden">
              <FaceDetection onEmotionDetected={handleEmotionDetected} />
            </div>
            
            <motion.div
              className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg transition-colors duration-300"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300">Current Emotion:</h3>
              <p className="text-blue-800 dark:text-blue-200 font-bold">
                {currentEmotion ? currentEmotion : "No emotion detected"}
              </p>
            </motion.div>
            
            <motion.div
              className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg transition-colors duration-300"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300">Privacy Notice</h3>
              <p className="text-blue-800 dark:text-blue-200 text-xs">
                All video processing is done locally in your browser. No video or image data is sent to any server.
              </p>
            </motion.div>
          </motion.div>
          
          {/* Chat Card */}
          <motion.div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg flex flex-col h-[600px] transition-colors duration-300"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Chat</h2>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatInterface currentEmotion={currentEmotion} />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default App;