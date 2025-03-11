import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader, Trash2, Mic, MicOff } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  id: string; // Add unique ID for animations
}

interface ChatInterfaceProps {
  currentEmotion: string | null;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ currentEmotion }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check if speech recognition is supported and initialize it
  useEffect(() => {
    const initSpeechRecognition = () => {
      const SpeechRecognition = 
        window.SpeechRecognition || 
        (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        setSpeechSupported(false);
        return;
      }
      
      setSpeechSupported(true);
      
      // Create a new recognition instance
      const recognition = new SpeechRecognition();
      
      // Configure speech recognition settings
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US'; // Set language explicitly
      recognition.maxAlternatives = 1;
      
      // Results handler
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => {
          const trimmedTranscript = transcript.trim();
          return prev ? `${prev} ${trimmedTranscript}` : trimmedTranscript;
        });
        setNetworkError(false); // Reset network error state on successful result
      };
      
      // Error handler with better messaging
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        
        if (event.error === 'not-allowed') {
          setPermissionError('Microphone access was denied. Please check your browser permissions.');
        } else if (event.error === 'no-speech') {
          console.log('No speech detected. Try speaking louder or checking your microphone.');
        } else if (event.error === 'network') {
          setNetworkError(true);
          setPermissionError('Network error occurred. Please check your internet connection.');
          
          // Auto retry after a delay in case of network error
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
          }
          
          // Try to restart recognition after a short delay
          retryTimeoutRef.current = setTimeout(() => {
            if (isListening) {
              try {
                recognition.stop();
                setTimeout(() => {
                  recognition.start();
                  setNetworkError(false);
                  setPermissionError(null);
                }, 300);
              } catch (e) {
                // Ignore any errors during retry
                setIsListening(false);
              }
            }
          }, 2000);
        }
        
        if (event.error !== 'network') {
          setIsListening(false);
        }
      };
      
      // End handler with restart option for continuous listening
      recognition.onend = () => {
        console.log('Speech recognition ended');
        
        // If we're supposed to be listening but recognition ended,
        // try to restart it unless explicitly stopped
        if (isListening && !networkError) {
          try {
            // Short delay before restarting to prevent rapid cycles
            setTimeout(() => {
              if (isListening) {
                recognition.start();
              }
            }, 300);
          } catch (e) {
            console.error('Error restarting speech recognition', e);
            setIsListening(false);
          }
        } else {
          setIsListening(false);
        }
      };
      
      // Assign the recognition instance to the ref
      recognitionRef.current = recognition;
    };
    
    // Initialize speech recognition
    initSpeechRecognition();
    
    // Cleanup function
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          // Ignore errors on cleanup
        }
      }
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Update the isListening dependency in recognition.onend
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = () => {
        console.log('Speech recognition ended');
        
        // Only auto-restart if we're still in the listening state
        if (isListening && !networkError) {
          try {
            // Short delay before restarting
            setTimeout(() => {
              if (isListening) { // Double-check we're still listening
                recognitionRef.current.start();
              }
            }, 300);
          } catch (e) {
            console.error('Error restarting speech recognition', e);
            setIsListening(false);
          }
        } else {
          setIsListening(false);
        }
      };
    }
  }, [isListening, networkError]);

  const toggleListening = () => {
    if (!speechSupported || !recognitionRef.current) return;
    
    setPermissionError(null); // Reset any previous errors
    setNetworkError(false); // Reset network error state
    
    if (isListening) {
      try {
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (error) {
        console.error('Error stopping speech recognition', error);
      }
    } else {
      // Request microphone permission first
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
          try {
            // Small delay to ensure previous instances are cleaned up
            setTimeout(() => {
              recognitionRef.current.start();
              setIsListening(true);
            }, 100);
          } catch (error) {
            console.error('Speech recognition error', error);
            setIsListening(false);
          }
        })
        .catch(error => {
          console.error('Microphone permission error', error);
          setPermissionError('Microphone access was denied. Please enable it in your browser settings.');
          setIsListening(false);
        });
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Stop listening if active
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        // Ignore errors here
      }
      setIsListening(false);
    }

    // Add user message to chat with unique ID
    const userMessage: Message = { 
      role: 'user', 
      content: input,
      id: `user-${Date.now()}` 
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Create system message with emotion context
      const systemMessage: Message = {
        role: 'system', 
        content: `You are an emotion powered chatbot. Your responses are influenced by the user emotions. Currently the user is ${currentEmotion || 'neutral'}!`,
        id: `system-${Date.now()}`
      };

      // Get conversation history, excluding previous system messages
      const conversationHistory = messages.filter(msg => msg.role !== 'system');
      
      // Send request to Cloudflare API via the Vite proxy
      const response = await fetch(
        `/api/cloudflare/client/v4/accounts/${import.meta.env.VITE_CF_ACCOUNT_ID}/ai/run/@cf/meta/llama-2-7b-chat-fp16`, 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_CF_API_KEY}`
          },
          body: JSON.stringify({
            messages: [
              { role: systemMessage.role, content: systemMessage.content },
              ...conversationHistory.map(msg => ({ role: msg.role, content: msg.content })),
              { role: userMessage.role, content: userMessage.content }
            ]
          })
        }
      );

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
      }

      const data = await response.json();
      
      // Add AI response to chat
      if (data.result && data.result.response) {
        setMessages((prev) => [
          ...prev, 
          { 
            role: 'assistant', 
            content: data.result.response,
            id: `assistant-${Date.now()}`
          }
        ]);
      } else {
        throw new Error('Unexpected response format from API');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => [
        ...prev, 
        { 
          role: 'assistant', 
          content: 'Sorry, I had trouble processing your request. Please try again.',
          id: `error-${Date.now()}`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="font-medium text-gray-700 dark:text-gray-300">Conversation</h3>
        {messages.length > 0 && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={clearChat}
            className="p-2 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Clear chat"
            aria-label="Clear chat"
          >
            <Trash2 className="h-5 w-5" />
          </motion.button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <motion.div 
            className="text-center text-gray-500 dark:text-gray-400 my-8"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p>Send a message to start chatting</p>
            {currentEmotion && (
              <p className="mt-2 text-sm font-medium">
                Current emotion detected: <span className="text-blue-600 dark:text-blue-400">{currentEmotion}</span>
              </p>
            )}
          </motion.div>
        )}
        
        <AnimatePresence>
          {messages.filter(msg => msg.role !== 'system').map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3 }}
              className={`p-3 rounded-lg max-w-[80%] ${
                message.role === 'user' 
                  ? 'bg-blue-100 dark:bg-blue-900 dark:text-gray-100 ml-auto' 
                  : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-100 mr-auto prose prose-sm dark:prose-invert max-w-none'
              }`}
            >
              {message.role === 'assistant' ? (
                <ReactMarkdown>{message.content}</ReactMarkdown>
              ) : (
                message.content
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg max-w-[80%] flex items-center space-x-2 mr-auto"
          >
            <Loader className="h-4 w-4 animate-spin text-blue-500" />
            <span className="text-sm text-gray-600 dark:text-gray-300">Thinking...</span>
          </motion.div>
        )}
        
        {permissionError && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 p-3 rounded-lg text-sm text-center"
          >
            {permissionError}
          </motion.div>
        )}
        
        {isListening && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className={`p-3 rounded-lg text-sm text-center ${
              networkError 
                ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300" 
                : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
            }`}
          >
            <div className="flex items-center justify-center gap-1">
              <div className="w-2 h-2 bg-current rounded-full typing-dot"></div>
              <div className="w-2 h-2 bg-current rounded-full typing-dot"></div>
              <div className="w-2 h-2 bg-current rounded-full typing-dot"></div>
              <span className="ml-2">
                {networkError ? "Reconnecting..." : "Listening to your voice..."}
              </span>
            </div>
          </motion.div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <form 
        onSubmit={sendMessage} 
        className="border-t border-gray-200 dark:border-gray-700 p-4 flex items-center gap-2"
      >
        <div className="relative flex-1 flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? 
              networkError ? "Reconnecting..." : "Listening..." 
              : "Type a message..."}
            className={`w-full border ${
              isListening
                ? networkError
                  ? "border-yellow-500 dark:border-yellow-500" 
                  : "border-green-500 dark:border-green-500"
                : "border-gray-300 dark:border-gray-600"
            } dark:bg-gray-700 dark:text-white rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200`}
            disabled={isLoading}
          />
          {speechSupported && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleListening}
              className={`absolute right-2 p-1 rounded-full ${
                isListening 
                  ? networkError
                    ? "text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300"
                    : "text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300" 
                  : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400"
              }`}
              title={isListening ? "Stop listening" : "Start voice input"}
              aria-label={isListening ? "Stop listening" : "Start voice input"}
            >
              {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </motion.button>
          )}
        </div>
        
        <motion.button
          type="submit"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`bg-blue-600 text-white rounded-lg p-2 px-4 transition-all duration-200 ${
            isLoading || !input.trim() ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-700"
          }`}
          disabled={isLoading || !input.trim()}
        >
          <Send className="h-5 w-5" />
        </motion.button>
      </form>
    </div>
  );
};

export default ChatInterface;