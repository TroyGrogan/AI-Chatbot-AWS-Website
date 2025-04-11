import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import '../styles/Chat.css';
import '../styles/Markdown.css';  // Import the new Markdown styles
import '../styles/Math.css'; // Restore custom math styles
import '../styles/CodeBlock.css'; // Import the new CodeBlock styles
import LoadingIndicator from './LoadingIndicator';
// Import ReactMarkdown and plugins
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { FaUser, FaEdit, FaHistory, FaPaperPlane, FaClock, FaCommentAlt, FaBookmark, FaRegBookmark, FaRobot, FaAws, FaTrashAlt, FaBook, FaArrowLeft, FaComments, FaCaretDown } from 'react-icons/fa';

// Import the custom CodeBlock component
import CodeBlock from './CodeBlock';

// Import KaTeX CSS directly, needed by rehype-katex
import 'katex/dist/katex.min.css';

const Chat = () => {
    const [message, setMessage] = useState('');
    const [isModelLoading, setIsModelLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeRequestId, setActiveRequestId] = useState(null); // Track current request
    const [error, setError] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [chatSession, setChatSession] = useState('');
    const [remainingMessages, setRemainingMessages] = useState(5);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [chatTimestamp, setChatTimestamp] = useState(null);
    const [isViewingHistory, setIsViewingHistory] = useState(false);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [chatTitle, setChatTitle] = useState('');
    const location = useLocation();
    const navigate = useNavigate();
    const messagesEndRef = useRef(null);
    const textAreaRef = useRef(null);
    const firstChatIdRef = useRef(null); // Add a ref to cache the first chat ID
    const params = useParams();
    const abortControllerRef = useRef(null); // Add this for request cancellation
    const [lastSubmissionTime, setLastSubmissionTime] = useState(0);
    const SUBMISSION_COOLDOWN = 500;
    const requestCanceledRef = useRef(false);
    const [modelMode, setModelMode] = useState("auto"); // "auto", "default", or "math"
    const [showModeSelector, setShowModeSelector] = useState(false);
    const modeSelectorRef = useRef(null);
    const modelModeRef = useRef("auto"); // For access in async functions

    // --> DEFINE loadBookmarkStatus with useCallback HERE <--
    const loadBookmarkStatus = useCallback(async () => {
        if (chatSession && chatHistory.length > 0) {
            try {
                // Get the current chat session from the backend
                const response = await api.get(`/api/chat-session/${chatSession}/`);
                
                if (response.data && response.data.chats && response.data.chats.length > 0) {
                    // Check if any message in this session is bookmarked
                    const isAnyMessageBookmarked = response.data.chats.some(chat => chat.bookmarked);
                    setIsBookmarked(isAnyMessageBookmarked);
                    
                    // Save first chat ID for bookmarking
                    if (response.data.chats.length > 0 && !firstChatIdRef.current) {
                        firstChatIdRef.current = response.data.chats[0].id;
                    }
                }
            } catch (error) {
                console.error("Error loading bookmark status:", error);
            }
        }
    }, [chatSession, chatHistory]); // Dependencies for useCallback

    // Helper function to check if two dates are the same day
    const isSameDay = (date1, date2) => {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    };

    // Function to format timestamp with AM/PM
    const formatTimestamp = (timestampStr) => {
        try {
            if (!timestampStr) return "Unknown time";
            
            console.log("Formatting timestamp:", timestampStr);
            
            // Handle ISO format timestamps that might include T and Z
            let date;
            if (timestampStr.includes('T')) {
                // It's already in ISO format
                date = new Date(timestampStr);
                console.log("Created date from ISO format:", date);
            } else {
                // Parse the timestamp string (which is in format "YYYY-MM-DD HH:MM:SS")
                const [datePart, timePart] = timestampStr.split(' ');
                if (!datePart || !timePart) return timestampStr; // Return original if format is unexpected
                
                const [year, month, day] = datePart.split('-');
                const [hour, minute, second] = timePart.split(':');
                
                // Create a JavaScript Date object
                date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
                console.log("Created date from string parts:", date);
            }
            
            // Check if date is valid
            if (isNaN(date.getTime())) {
                console.error('Invalid date created from timestamp:', timestampStr);
                return timestampStr;
            }
            
            // Format the date with AM/PM in local time zone - browser automatically uses user's timezone
            const formattedDate = date.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            
            console.log("Formatted date in local timezone:", formattedDate);
            return formattedDate;
        } catch (error) {
            console.error('Error formatting timestamp:', error, timestampStr);
            return timestampStr; // Return original string if parsing fails
        }
    };

    // Auto-scroll to bottom for new messages only, not when viewing history
    const scrollToBottom = () => {
        if (!isViewingHistory && messagesEndRef.current) {
            // Try smooth scrolling first
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
            
            // Also force scroll with a slight delay as backup
            setTimeout(() => {
                if (messagesEndRef.current) {
                    // Force scroll without smooth behavior as fallback
                    messagesEndRef.current.scrollIntoView({ block: 'end' });
                    
                    // Additional fallback - scroll the container directly
                    const chatContainer = document.querySelector('.chat-messages');
                    if (chatContainer) {
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                    }
                }
            }, 200);
        }
    };

    // Add error message auto-clearing effect
    useEffect(() => {
        // If the error message stays for more than 5 seconds, clear it
        if (error) {
            const timer = setTimeout(() => {
                setError('');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);
    
    // Add a state recovery mechanism to prevent softlocks
    useEffect(() => {
        // This effect monitors critical state that could cause UI softlocks
        // If loading states get stuck, this will recover them
        let loadingTimer;
        
        if (isModelLoading || isGenerating || activeRequestId) {
            // If loading state persists for more than 60 seconds, show a message but KEEP the loading indicator
            loadingTimer = setTimeout(() => {
                console.warn("Loading state persisted a long time - showing delayed message");
                
                // Don't cancel the request or remove loading indicators
                // Just inform the user that it's taking longer than expected
                setError("The AI is still thinking... This response is taking longer than usual but will appear when ready.");
                
                // We're not canceling the request or changing any loading states
                // We'll let the request continue until it completes or fails on its own
            }, 60000); // 60 seconds
        }
        
        return () => {
            if (loadingTimer) clearTimeout(loadingTimer);
        };
    }, [isModelLoading, isGenerating, activeRequestId]);

    // Restore the scroll to bottom effect
    useEffect(() => {
        // Only auto-scroll when adding new messages, not when viewing history
        if (!isViewingHistory) {
            scrollToBottom();
        }
    }, [chatHistory, isViewingHistory]);

    useEffect(() => {
        const initialize = async () => {
            try {
                setIsModelLoading(true);
                
                if (location.state?.selectedChat) {
                    // Debug logging
                    console.log("Chat loaded from history:", location.state);
                    console.log("Remaining messages from history:", location.state.remainingMessages);
                    
                    // Filter out any loading messages from history
                    const filteredHistory = location.state.chatHistory.filter(msg => !msg.isLoading);
                    
                    // Add debug logging for model mode information in historical messages
                    console.log("Loaded chat history messages:", filteredHistory);
                    const aiMessages = filteredHistory.filter(msg => msg.type === 'ai');
                    console.log("AI messages in history:", aiMessages);
                    console.log("Model mode info in first AI message:", 
                        aiMessages.length > 0 ? {
                            model_mode: aiMessages[0].model_mode,
                            is_automatic: aiMessages[0].is_automatic
                        } : "No AI messages found");
                    
                    setChatHistory(filteredHistory);
                    setChatSession(location.state.chatSession);
                    
                    // Set the chat timestamp from the selected chat
                    if (location.state.selectedChat.timestamp) {
                        setChatTimestamp(location.state.selectedChat.timestamp);
                    }
                    
                    // Set viewing history mode to true
                    setIsViewingHistory(true);
                    
                    // Set bookmark status if available
                    if (location.state.selectedChat.bookmarked !== undefined) {
                        setIsBookmarked(location.state.selectedChat.bookmarked);
                    }
                    
                    // Set title if available
                    if (location.state.selectedChat.title) {
                        setChatTitle(location.state.selectedChat.title);
                    }
                    
                    // Make sure we use the correct remaining messages value
                    // Ensure it's parsed as a number and default to 5 if undefined
                    const remaining = location.state.remainingMessages !== undefined
                        ? (typeof location.state.remainingMessages === 'number'
                            ? location.state.remainingMessages
                            : parseInt(location.state.remainingMessages) || 5)
                        : 5;
                        
                    setRemainingMessages(remaining);
                    console.log("Set remaining messages to:", remaining);
                } else {
                    // Start a new chat session
                    const sessionRes = await api.post('/api/new-chat-session/');
                    setChatSession(sessionRes.data.chat_session);
                    setRemainingMessages(sessionRes.data.remaining_messages);
                    setChatTimestamp(null); // Clear timestamp for new chats
                    setIsViewingHistory(false); // Not viewing history in a new chat
                    console.log("New chat session remaining messages:", sessionRes.data.remaining_messages);
                }
                
                setIsModelLoading(false);
            } catch (error) {
                setError('Failed to initialize chat. Please refresh the page.');
                console.error(error);
                setIsModelLoading(false);
            }
        };
        
        initialize();
    }, [location.state]);

    // Add a separate useEffect that runs only once when component mounts
    useEffect(() => {
        // Ensure page is scrolled to top when component mounts
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        if (chatSession) {
            // Check if this chat is bookmarked
            const checkBookmarkStatus = async () => {
                try {
                    const response = await api.get(`/api/chat-session/${chatSession}/`);
                    if (response.data && response.data.bookmarked) {
                        setIsBookmarked(response.data.bookmarked);
                    }
                } catch (error) {
                    console.error('Error checking bookmark status:', error);
                }
            };
            
            // Only check bookmark status when viewing history
            // This prevents unnecessary API calls during normal chat flow
            if (isViewingHistory && params.id) {
                checkBookmarkStatus();
            }
        }
    }, [chatSession, isViewingHistory, params.id]);

    // Add a useEffect to load the bookmark status when viewing a chat session
    useEffect(() => {
        // --> CALL the memoized loadBookmarkStatus function <--
        loadBookmarkStatus();
    }, [loadBookmarkStatus]); // Dependency is the memoized function itself

    // Add function to adjust textarea height and scrollbar
    const adjustTextAreaHeight = () => {
        const textArea = textAreaRef.current;
        if (!textArea) return;
        
        // Reset height to auto to get the correct scrollHeight
        textArea.style.height = 'auto';
        
        // Calculate new height (with a maximum height of 40vh - slightly less than half the viewport height)
        // First get the viewport height and calculate 40% of it
        const maxHeight = window.innerHeight * 0.4;
        const newHeight = Math.min(textArea.scrollHeight, maxHeight);
        
        // Set the new height
        textArea.style.height = `${newHeight}px`;
        
        // Only show scrollbar when the textarea has reached its maximum height
        // and the content exceeds that height (requiring scrolling)
        if (textArea.scrollHeight > maxHeight) {
            textArea.classList.add('show-scrollbar');
        } else {
            textArea.classList.remove('show-scrollbar');
        }
        
        // Adjust scrollbar thumb size based on content
        // Add a small delay to ensure the scrollbar updates after height change
        setTimeout(() => {
            if (textArea.scrollHeight > textArea.clientHeight) {
                // Calculate thumb size based on the content ratio
                // Visible area / total content = scrollbar thumb ratio
                const contentRatio = textArea.clientHeight / textArea.scrollHeight;
                // Apply minimum size constraint to ensure the thumb is visible and usable
                const thumbHeight = Math.max(1, Math.floor(contentRatio * textArea.clientHeight * 0.8));
                
                // Apply the dynamic styling
                const styleEl = document.getElementById('dynamic-scrollbar-style');
                if (styleEl) {
                    styleEl.innerHTML = `.chat-textarea.show-scrollbar::-webkit-scrollbar-thumb { 
                        height: ${thumbHeight}px !important;
                        max-height: calc(100% - 80px) !important;
                        background-color: rgba(0, 0, 0, 0.3) !important;
                        border-radius: 6px !important;
                    }
                    
                    .chat-textarea.show-scrollbar::-webkit-scrollbar-thumb:hover {
                        background-color: rgba(0, 0, 0, 0.5) !important;
                    }
                    
                    .chat-textarea.show-scrollbar::-webkit-scrollbar {
                        width: 6px !important;
                    }
                    
                    .chat-textarea::-webkit-scrollbar-track {
                        margin-bottom: 40px !important;
                    }
                    
                    .chat-messages::-webkit-scrollbar-track {
                        margin: 10px 0 !important;
                        padding-top: 10px !important;
                    }
                    
                    .chat-messages::-webkit-scrollbar-thumb {
                        min-height: 40px !important;
                        max-height: calc(100% - 20px) !important;
                    }`;
                } else {
                    // Create style element if it doesn't exist
                    const style = document.createElement('style');
                    style.id = 'dynamic-scrollbar-style';
                    style.innerHTML = `.chat-textarea.show-scrollbar::-webkit-scrollbar-thumb { 
                        height: ${thumbHeight}px !important;
                        max-height: calc(100% - 80px) !important;
                        background-color: rgba(0, 0, 0, 0.3) !important;
                        border-radius: 6px !important;
                    }
                    
                    .chat-textarea.show-scrollbar::-webkit-scrollbar-thumb:hover {
                        background-color: rgba(0, 0, 0, 0.5) !important;
                    }
                    
                    .chat-textarea.show-scrollbar::-webkit-scrollbar {
                        width: 6px !important;
                    }
                    
                    .chat-textarea::-webkit-scrollbar-track {
                        margin-bottom: 40px !important;
                    }
                    
                    .chat-messages::-webkit-scrollbar-track {
                        margin: 10px 0 !important;
                        padding-top: 10px !important;
                    }
                    
                    .chat-messages::-webkit-scrollbar-thumb {
                        min-height: 40px !important;
                        max-height: calc(100% - 20px) !important;
                    }`;
                    document.head.appendChild(style);
                }
            }
        }, 10);
    };

    // Call adjustTextAreaHeight whenever message changes
    useEffect(() => {
        adjustTextAreaHeight();
    }, [message]);
    
    // Add useEffect to create the dynamic style element on mount
    useEffect(() => {
        // Create the style element for dynamic scrollbar styling
        if (!document.getElementById('dynamic-scrollbar-style')) {
            const style = document.createElement('style');
            style.id = 'dynamic-scrollbar-style';
            document.head.appendChild(style);
        }
        
        // Clean up on unmount
        return () => {
            const styleEl = document.getElementById('dynamic-scrollbar-style');
            if (styleEl) {
                styleEl.parentNode.removeChild(styleEl);
            }
        };
    }, []);

    const handleMessageChange = (e) => {
        setMessage(e.target.value);
        // Height will be adjusted by the useEffect
    };

    // Handle keyboard events in textarea
    const handleKeyDown = (e) => {
        // If Enter is pressed without Shift key
        if (e.key === 'Enter' && !e.shiftKey) {
            // Check if send is allowed before proceeding
            const currentTime = Date.now();
            if (
                isGenerating || 
                !message.trim() || 
                isViewingHistory || 
                activeRequestId || 
                (currentTime - lastSubmissionTime < SUBMISSION_COOLDOWN)
            ) {
                e.preventDefault(); // Prevent default newline behavior
                console.log("Prevented send via Enter key - generation in progress or too soon");
                return;
            }
            
            e.preventDefault(); // Prevent default newline behavior
            handleSend(); // Send the message
        }
        // If Shift+Enter is pressed, let the default behavior happen (create newline)
    };

    // Add a function to determine if the textarea is empty
    const isTextareaEmpty = () => {
        return !message || message.trim().length === 0;
    };

    // Update this function to include model mode information
    const getResponseContent = (apiResponse) => {
        if (!apiResponse) return { content: '', modeInfo: null };
        
        // Check if response already has mode information
        if (typeof apiResponse === 'object' && apiResponse.response && apiResponse.mode) {
            // Only apply formatting if it's math mode and doesn't already have delimiters
            const responseText = apiResponse.response;
            const isMathMode = apiResponse.mode === "Math Correct";
            let formattedContent = responseText;
            
            // Only format if it's math mode AND doesn't already have delimiters
            const needsFormatting = isMathMode && 
                                  typeof responseText === 'string' && 
                                  !responseText.includes('$');
            
            if (needsFormatting) {
                formattedContent = formatMathExpressions(responseText, true);
            }
            
            return {
                content: formattedContent,
                modeInfo: {
                    mode: apiResponse.mode,
                    isAutomatic: apiResponse.is_automatic
                }
            };
        }
        
        // Regular string response, determine mode from context
        let responseText = '';
        let detectedMode = null;
        let isAutomatic = true; // Assume automatic if not specified
        
        const isValidString = (value) => value !== undefined && value !== null && typeof value === 'string' && value.trim() !== '';
        
        if (isValidString(apiResponse)) {
            responseText = apiResponse;
        } else if (apiResponse && isValidString(apiResponse.response)) {
            responseText = apiResponse.response;
            // If API returned mode information
            if (apiResponse.mode) {
                detectedMode = apiResponse.mode;
                isAutomatic = apiResponse.is_automatic !== false;
            }
        } else if (apiResponse && typeof apiResponse === 'object') {
            responseText = JSON.stringify(apiResponse);
        } else {
            console.warn('Unexpected API response format:', apiResponse);
            responseText = 'Error: Unexpected response format';
        }
        
        // If mode wasn't provided, detect from response
        if (!detectedMode) {
            // Simple heuristic - math mode responses likely contain calculations or equations
            const mathPatterns = [
                /\d+\s*[\+\-\*\/=\^]/,      // Numbers with operators
                /\\frac{/,                  // LaTeX fractions
                /\\sqrt{/,                  // LaTeX square roots
                /\\sum/,                    // LaTeX summation
                /\\int/,                    // LaTeX integral
                /Step\s+\d+:/i,             // Step-by-step solutions
                /Let's\s+calculate/i,       // Math solving language
                /The\s+solution\s+is/i,     // Math solving language
                /Let's\s+solve/i,           // Math solving language
            ];
            
            if (mathPatterns.some(pattern => pattern.test(responseText))) {
                detectedMode = "Math Correct";
            } else {
                detectedMode = "GPT4 Correct";
            }
        }

        // Only format when in math mode AND content doesn't already have delimiters
        const isMathMode = detectedMode === "Math Correct";
        const needsFormatting = isMathMode && 
                              typeof responseText === 'string' && 
                              !responseText.includes('$');
        
        const formattedContent = needsFormatting ? 
                               formatMathExpressions(responseText, true) : 
                               responseText;
        
        return {
            content: formattedContent,
            modeInfo: {
                mode: detectedMode,
                isAutomatic: isAutomatic
            }
        };
    };

    // Enhanced function to format math expressions with LaTeX delimiters
    const formatMathExpressions = (text, isMathMode) => {
        if (!text || !isMathMode) return text;

        // Check if the text already contains LaTeX delimiters 
        if (text.includes('$') && (text.match(/\$/g) || []).length >= 2) {
            console.log("Text already contains LaTeX delimiters, skipping formatting");
            return text; // Already has LaTeX delimiters
        }
        
        // Skip processing sentences that are likely just normal text
        // Check for common natural language patterns that suggest it's just text
        const textPatterns = [
            /^I'll|^Let me|^Here's|^To solve|^First,|^I need|^I think|^I believe|^To find/i,
            /^The answer|^You can|^We need|^Let's|^This is|^That is|^It is|^We can/i,
            /^In order to|^As you|^For this|^Based on|^According to|^When we/i
        ];
        
        // If the text starts with natural language patterns and doesn't have clear math symbols,
        // skip the processing as it's likely just normal text
        const hasNaturalLanguageStart = textPatterns.some(pattern => pattern.test(text.trim()));
        const hasClearMathSymbols = /∫|∑|∏|√|∞|≤|≥|≠|∈|∀|∃|\\frac|\\int|\\sum/.test(text);
        
        if (hasNaturalLanguageStart && !hasClearMathSymbols) {
            console.log("Text appears to be natural language, skipping math formatting");
            return text;
        }
        
        console.log("Formatting math expressions in text");
        
        // Some special case replacements for known math expressions
        const specialCases = [
            // The specific calculus problem from the screenshot with full formatting
            {
                pattern: /∫\s*\(4x\^6\s*-\s*2x\^3\s*\+\s*7x\s*-\s*4\)\s*dx/g, 
                replace: '$$\\int (4x^6 - 2x^3 + 7x - 4)\\,dx$$'
            },
            // The expanded form
            {
                pattern: /∫4x\^6\s*-\s*2x\^3\s*\+\s*7x\s*-\s*4dx/g,
                replace: '$$\\int 4x^6 - 2x^3 + 7x - 4\\,dx$$'
            },
            // The breakdown of terms
            {
                pattern: /=\s*4∫x\^6\s*dx\s*-\s*2∫x\^3\s*dx\s*\+\s*7∫x\s*dx\s*-\s*4∫dx/g,
                replace: '$$= 4\\int x^6\\,dx - 2\\int x^3\\,dx + 7\\int x\\,dx - 4\\int dx$$'
            },
            // The integration results
            {
                pattern: /4∫x\^6\s*dx\s*=\s*\(4\/7\)x\^\(6\+1\)\s*=\s*\(4\/7\)x\^7/g,
                replace: '$$4\\int x^6\\,dx = \\frac{4}{7}x^{6+1} = \\frac{4}{7}x^7$$'
            },
            // Term-by-term integration
            {
                pattern: /-2∫x\^3\s*dx\s*=\s*\(-2\/4\)x\^\(3\+1\)\s*=\s*-x\^4\/2/g,
                replace: '$$-2\\int x^3\\,dx = \\frac{-2}{4}x^{3+1} = -\\frac{1}{2}x^4$$'
            },
            {
                pattern: /7∫x\s*dx\s*=\s*7x\^\(1\+1\)\/2\s*=\s*\(7\/2\)x\^2/g,
                replace: '$$7\\int x\\,dx = \\frac{7}{2}x^{1+1} = \\frac{7}{2}x^2$$'
            },
            {
                pattern: /-4∫dx\s*=\s*-4x/g,
                replace: '$$-4\\int dx = -4x$$'
            },
            // The final result
            {
                pattern: /\(4\/7\)x\^7\s*-\s*x\^4\/2\s*\+\s*\(7\/2\)x\^2\s*-\s*4x\s*\+\s*C/g,
                replace: '$$\\frac{4}{7}x^7 - \\frac{1}{2}x^4 + \\frac{7}{2}x^2 - 4x + C$$'
            }
        ];
        
        // Apply special case replacements
        let resultText = text;
        for (const { pattern, replace } of specialCases) {
            resultText = resultText.replace(pattern, replace);
        }
        
        // General patterns for math expressions - but be more conservative
        const mathPatterns = [
            // Standalone integral expressions - these are clearly math
            {
                pattern: /^∫.*dx$/gm,
                replace: (match) => `$$${match}$$`
            },
            // Equations with = signs - but be more specific to avoid false positives
            {
                pattern: /^\s*[a-z0-9]+\s*=\s*[a-z0-9]+\s*[\+\-\*\/\^].*$/gim,
                replace: (match) => {
                    // Skip if it's already inside delimiters or looks like HTML or regular text
                    if (match.includes('$') || match.includes('<') || match.includes('>') || 
                        /^[A-Za-z]+\s*=\s*[A-Za-z]+$/.test(match)) { // Skip "x = y" with no operations
                        return match;
                    }
                    return `$$${match}$$`;
                }
            },
            // Inline math expressions surrounded by text - only clear math symbols
            {
                pattern: /(\s|^)∫[^$\n;.]+?dx(\s|$|\.)/g,
                replace: (match, p1, p2) => `${p1}$\\int ${match.slice(p1.length, -p2.length).replace('∫', '').replace('dx', '\\,dx')}$${p2}`
            },
            // Matrix notation - [a b; c d]
            {
                pattern: /(\s|^)\[\s*\d+(?:\s+\d+)+\s*;\s*\d+(?:\s+\d+)+\s*\](\s|$)/g,
                replace: (match, p1, p2) => `${p1}$${match.slice(p1.length, -p2.length)}$${p2}`
            }
        ];
        
        // Apply general patterns - but only for clear math expressions
        for (const { pattern, replace } of mathPatterns) {
            resultText = resultText.replace(pattern, replace);
        }
        
        return resultText;
    };

    // Use this function when user toggles the mode
    const handleModeChange = (newMode) => {
        setModelMode(newMode);
        modelModeRef.current = newMode;
        setShowModeSelector(false);
        
        // Store the user's preference
        localStorage.setItem('preferredModelMode', newMode);
    };

    // Handle clicking outside of the mode selector to close it
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modeSelectorRef.current && !modeSelectorRef.current.contains(event.target)) {
                setShowModeSelector(false);
            }
        };
        
        // Handle keyboard accessibility for mode selector
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && showModeSelector) {
                setShowModeSelector(false);
            }
        };
        
        // Add event listeners when the dropdown is shown
        if (showModeSelector) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }
        
        // Clean up the event listeners
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [showModeSelector]);

    // Set up event listeners for clicking outside
    useEffect(() => {
        // Initialize model mode from localStorage or default to "auto"
        const savedMode = localStorage.getItem('preferredModelMode');
        if (savedMode && ['auto', 'default', 'math'].includes(savedMode)) {
            setModelMode(savedMode);
            modelModeRef.current = savedMode;
        }
    }, []);

    // Handle keyboard navigation and accessibility for mode selector
    const handleModeKeyDown = useCallback((e) => {
        if (!showModeSelector) return;
        
        // Close on escape
        if (e.key === 'Escape') {
            setShowModeSelector(false);
            return;
        }
        
        // Enter/Space toggles selection
        if (e.key === 'Enter' || e.key === ' ') {
            const targetMode = e.target.getAttribute('data-mode');
            if (targetMode) {
                handleModeChange(targetMode);
                e.preventDefault();
            }
        }
        
        // Arrow keys for navigation
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const modes = ['auto', 'default', 'math'];
            const currentIndex = modes.indexOf(modelMode);
            const nextIndex = e.key === 'ArrowDown' 
                ? (currentIndex + 1) % modes.length 
                : (currentIndex - 1 + modes.length) % modes.length;
            
            // Focus the next/previous mode option
            const modeElements = modeSelectorRef.current.querySelectorAll('[data-mode]');
            if (modeElements[nextIndex]) {
                modeElements[nextIndex].focus();
            }
        }
    }, [showModeSelector, modelMode]);

    // Update the handleSend function to include mode information
    const handleSend = async () => {
        try {
            // Don't send empty messages
            if (isTextareaEmpty()) return;
            
            const currentMessage = message.trim();
            setMessage('');
            
            // Resize textarea back to initial height
            adjustTextAreaHeight();
            
            // Add the new message to the chat immediately for better UX
            const messageId = Date.now().toString();
            const newMessage = {
                id: messageId,
                type: 'user',
                content: currentMessage,
                timestamp: new Date().toISOString()
            };
            
            if (chatHistory.length === 0) {
                // This is the first message, set it as the title too
                const truncatedTitle = currentMessage.length > 40 
                    ? currentMessage.substring(0, 40) + '...' 
                    : currentMessage;
                
                setChatTitle(truncatedTitle);
            }
            
            setIsGenerating(true);
            setError(null);
            
            // First add the user message
            setChatHistory(prevHistory => [...prevHistory, newMessage]);
            
            // Then add a temporary AI message with loading indicator
            setChatHistory(prevHistory => [...prevHistory, {
                id: `loading-${messageId}`,
                type: 'ai',
                content: <LoadingIndicator size="large" />,
                isLoading: true,
                timestamp: new Date().toISOString(),
                requestedMode: modelModeRef.current
            }]);
            
            // Scroll to bottom after adding new message
            setTimeout(scrollToBottom, 100);
            
            // Prepare the request data including the chosen mode
            const requestData = {
                message: currentMessage,
                chat_session: chatSession || '',
                model_mode: modelModeRef.current // Send the selected model mode
            };
            
            console.log('Sending message with mode:', modelModeRef.current);
            
            // --> ADD LOGGING BEFORE API CALL <--
            console.log('[handleSend] Attempting API POST to /api/chat/ with session:', chatSession);
            // --> LOG THE REQUEST DATA <--
            console.log('[handleSend] Request Data:', requestData);
            
            const response = await api.post('/api/chat/', requestData);
            
            // --> MODIFY LOGGING AFTER API CALL <--
            console.log('>>> RAW AI RESPONSE RECEIVED FROM BACKEND <<<', response.data);
            
            const { response: aiResponse, remaining_messages, limit_reached, mode, is_automatic } = response.data;
            
            // Process the response and get mode information
            const { content: processedContent, modeInfo } = getResponseContent({
                response: aiResponse,
                mode: mode || (is_automatic ? (modeInfo?.mode || null) : modelModeRef.current === 'default' ? 'GPT4 Correct' : 'Math Correct'),
                is_automatic: is_automatic !== undefined ? is_automatic : modelModeRef.current === 'auto'
            });
            
            // Create the AI response object with mode information
            const newAiMessage = {
                id: `ai-${messageId}`,
                type: 'ai',
                content: processedContent,
                timestamp: new Date().toISOString(),
                modeInfo: modeInfo
            };
            
            // Update the UI - replace the loading message with the actual response
            setChatHistory(prevHistory => {
                // Remove the loading message
                const filteredHistory = prevHistory.filter(msg => !msg.isLoading);
                // Add the actual AI response
                return [...filteredHistory, newAiMessage];
            });
            
            setRemainingMessages(remaining_messages);
            setError(null);
            
            // If this is the first message, check if we need to update the chat session
            if (!chatSession && response.data.chat_session) {
                setChatSession(response.data.chat_session);
                
                // Update the URL without navigation
                const newUrl = `/chat/${response.data.chat_session}`;
                window.history.replaceState(null, '', newUrl);
            }
            
            // If this is a new message, check bookmark status after a delay
            setTimeout(() => {
                // --> CALL the memoized loadBookmarkStatus function <--
                loadBookmarkStatus(); 
            }, 500);
            
            // Auto-scroll to bottom after response is received
            setTimeout(scrollToBottom, 100);
        } catch (error) {
            console.error('Error sending message:', error);
            
            // --> ADD LOGGING INSIDE CATCH BLOCK <--
            console.log('[handleSend Error] Caught error during API call or processing:', error.response?.data || error.message);
            
            // Remove the loading message in case of error
            setChatHistory(prevHistory => prevHistory.filter(msg => !msg.isLoading));
            
            // Extract the error message or use a default
            const errorMsg = error.response?.data?.error || 'Failed to send message. Please try again.';
            setError(errorMsg);
            
            // Update the remaining messages if provided in the error response
            if (error.response?.data?.remaining_messages !== undefined) {
                setRemainingMessages(error.response.data.remaining_messages);
            }
            
            // Check if we've reached a limit
            if (error.response?.data?.limit_reached) {
                setError('Chat limit reached. Please start a new chat.');
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleNewChat = async () => {
        try {
            setIsModelLoading(true);
            
            // Cancel any ongoing requests
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
            
            // Clear all loading states
            setIsGenerating(false);
            setActiveRequestId(null);
            setLastSubmissionTime(0);
            
            // Ensure token is refreshed for the new chat request
            const token = localStorage.getItem('access');
            if (!token) {
                console.error("No auth token found, redirecting to login");
                navigate('/login');
                return;
            }
            
            console.log("Starting new chat session with token", token ? "present" : "missing");
            
            // Start a new chat session
            const sessionRes = await api.post('/api/new-chat-session/');
            console.log("New chat session response:", sessionRes.data);
            
            setChatSession(sessionRes.data.chat_session);
            setRemainingMessages(sessionRes.data.remaining_messages);
            
            // Reset everything - ensure no loading messages are kept
            setChatHistory([]);
            setMessage('');
            setError('');
            setChatTimestamp(null); // Clear timestamp when starting a new chat
            setIsViewingHistory(false); // No longer viewing history
            setIsBookmarked(false); // Reset bookmark state for new chat
            firstChatIdRef.current = null; // Reset cached first chat ID
            
            // Force scroll to top immediately before removing loading state
            window.scrollTo(0, 0);
            
            setIsModelLoading(false);
            
            // Add a small delay and scroll again to ensure it takes effect
            setTimeout(() => {
                window.scrollTo(0, 0);
            }, 100);
        } catch (error) {
            console.error("Failed to start new chat:", error);
            
            // Check for authentication errors
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                setError('Your session has expired. Please log in again.');
                // Redirect to login after a short delay
                setTimeout(() => navigate('/login'), 2000);
            } else {
                setError('Failed to start a new chat. Please try again.');
            }
            
            setIsModelLoading(false);
            setIsGenerating(false);
            setActiveRequestId(null);
        }
    };

    const handleSignOut = async () => {
        try {
            await api.post('/api/user/signout/');
            localStorage.removeItem('access');
            navigate('/');
        } catch (error) {
            console.error('Sign out failed:', error);
        }
    };

    const handleChangeAccountInfo = () => {
        // Close the profile menu
        setShowProfileMenu(false);
        // Navigate to account info page (you'll need to create this page)
        navigate('/account-info');
    };

    const handleDeleteAccount = () => {
        // Close the profile menu
        setShowProfileMenu(false);
        // Navigate to delete account page (you'll need to create this page)
        navigate('/delete-account');
    };

    const handleAboutApp = () => {
        // Close the profile menu
        setShowProfileMenu(false);
        // Navigate to about page (you'll need to create this page)
        navigate('/about');
    };

    // Simplify the handleBack function to just use browser's native back functionality
    const handleBack = () => {
        // Always use browser's native back functionality to maintain natural browsing history
        navigate(-1);
    };

    const handleToggleBookmark = async () => {
        try {
            // We need the current chat session ID
            if (!chatSession) {
                console.error("No chat session available to bookmark");
                return;
            }
            
            // Find the first message in this chat session to get its ID
            // This is needed because our backend bookmarks by chat message ID, not session ID
            if (chatHistory.length === 0) {
                setError("Cannot bookmark an empty chat");
                // Auto-clear error after 5 seconds
                setTimeout(() => setError(''), 5000);
                return;
            }
            
            // We need to look up the first chat ID if we don't already have it
            if (!firstChatIdRef.current) {
                // Get the current chat session from the backend to find the correct chat ID
                const response = await api.get(`/api/chat-session/${chatSession}/`);
                
                if (!response.data || !response.data.chats || response.data.chats.length === 0) {
                    setError("No chat messages found to bookmark");
                    // Auto-clear error after 5 seconds
                    setTimeout(() => setError(''), 5000);
                    return;
                }
                
                // Get the first chat message ID from the response
                firstChatIdRef.current = response.data.chats[0].id;
            }
            
            if (isBookmarked) {
                // Call the unbookmark endpoint
                await api.post(`/api/unbookmark-chat/${firstChatIdRef.current}/`);
                setIsBookmarked(false);
            } else {
                // Call the bookmark endpoint
                await api.post(`/api/bookmark-chat/${firstChatIdRef.current}/`);
                setIsBookmarked(true);
            }
        } catch (error) {
            console.error("Error toggling bookmark:", error);
            setError("Failed to update bookmark. Please try again.");
            // Auto-clear error after 5 seconds
            setTimeout(() => setError(''), 5000);
        }
    };

    // Modified function to disable renaming functionality
    const handleRenameChat = async () => {
        // Function is now disabled since we removed the rename button
        console.log("Rename functionality has been disabled");
        return;
    };

    // Add or modify this function to always get the first message
    const getFirstMessageFromHistory = (messages) => {
        if (!messages || messages.length === 0) {
            console.log("No messages in history to get first message from");
            return null;
        }
        
        console.log("Trying to get first message from", messages.length, "messages");
        
        // Sort messages chronologically to ensure we get the first one
        const sortedMessages = [...messages].sort((a, b) => {
            const dateA = a.timestamp ? new Date(a.timestamp) : new Date(0);
            const dateB = b.timestamp ? new Date(b.timestamp) : new Date(0);
            return dateA - dateB;
        });
        
        // Return the first user message
        const firstUserMessage = sortedMessages.find(msg => msg.type === 'user');
        
        if (firstUserMessage) {
            console.log("Found first user message:", firstUserMessage.content);
            return firstUserMessage;
        } else {
            console.log("No user message found, returning first message");
            return sortedMessages[0];
        }
    };

    useEffect(() => {
        if (location.state?.selectedChat?.title && !chatTitle) {
            console.log("Setting chat title from location state:", location.state.selectedChat.title);
            setChatTitle(location.state.selectedChat.title);
        }
    }, [location.state, chatTitle]);

    // Add a reset function to clear error state
    const resetErrorState = () => {
        console.log("Manually resetting error state");
        // Clear any error message
        setError('');
        
        // Clear any loading states
        setIsGenerating(false);
        setActiveRequestId(null);
        
        // Abort any pending requests
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        
        // Clean up any loading messages in the chat
        setChatHistory(prev => prev.filter(msg => !msg.isLoading));
        
        // Reset cooldown timer
        setLastSubmissionTime(0);
    };

    // Enhance the renderModeIndicator function to handle history mode info
    const renderModeIndicator = (message, index) => {
        if (message.type !== 'ai') return null;
        
        // Handle loading state first
        if (message.isLoading) {
            const requestedMode = message.requestedMode || 'auto'; // Default to auto if somehow missing
            
            // If mode was 'auto', show detecting state
            if (requestedMode === 'auto') {
                return (
                    <div className="message-mode-indicator loading-mode">
                        <FaRobot />
                        <span className="mode-label">Model Mode: </span>
                        <span className="mode-icon auto-icon" title="Automatic Mode">⟳</span>
                        <span className="spacer"> </span>
                        <span className="mode-name"><i>Detecting...</i></span>
                    </div>
                );
            } else {
                // If mode was manually selected ('default' or 'math'), show that mode during loading
                const displayModeText = requestedMode === 'math' ? 'Math Reasoning Mode' : 'Default Mode';
                const displayIcon = requestedMode === 'math' ? '🧮' : '💡';
                const iconClass = requestedMode === 'math' ? 'math-icon' : 'default-icon';
                
                return (
                     <div className="message-mode-indicator">
                        <FaRobot />
                        <span className="mode-label">Model Mode: </span>
                        <>
                            <span className={`mode-icon ${iconClass}`} title={displayModeText}>{displayIcon}</span>
                            <span className="mode-name">{displayModeText}</span>
                        </>
                    </div>
                );
            }
        }
        
        // --- Existing logic for non-loading (finalized) messages ---
        // Get mode info from either the modeInfo property (new messages) or from the message itself (history)
        let mode, isAutomatic;
        
        if (message.modeInfo) {
            // New messages with modeInfo property
            mode = message.modeInfo.mode;
            isAutomatic = message.modeInfo.isAutomatic;
            console.log("Mode info from modeInfo property:", mode, isAutomatic);
        } else if (message.model_mode) {
            // Messages loaded from history
            mode = message.model_mode;
            isAutomatic = message.is_automatic;
            console.log("Mode info from message properties:", mode, isAutomatic);
        } else {
            // Default fallback if no mode info is available
            // This ensures Model Mode always appears, even for historical chats without mode data
            console.log("No mode info found for message, using default:", message);
            mode = "Default";  // Use default mode as fallback
            isAutomatic = true;  // Assume automatic mode as fallback
        }
        
        // Map the mode string to a valid display mode
        // Handle various ways math mode might be represented ('Math Correct', 'math', etc.)
        const isMathMode = mode === 'Math Correct' || mode === 'math' ||
                          mode?.toLowerCase() === 'math correct' || mode?.toLowerCase() === 'math reasoning';
        // Use consistent naming for display
        const displayMode = isMathMode ? 'Math Reasoning' : 'Default';
        const displayModeText = isMathMode ? 'Math Reasoning Mode' : 'Default Mode';
        const displayIcon = isMathMode ? '🧮' : '💡';
        const iconClass = isMathMode ? 'math-icon' : 'default-icon';

        return (
            <div className="message-mode-indicator">
                <FaRobot />
                <span className="mode-label">Model Mode: </span>
                
                {isAutomatic && (
                    <>
                        <span className="mode-icon auto-icon" title="Automatic Mode">⟳</span>
                        <span className="spacer"> </span>
                    </>
                )}
                
                <>
                    <span className={`mode-icon ${iconClass}`} title={displayModeText}>{displayIcon}</span>
                    <span className="mode-name">{displayModeText}</span>
                </>
            </div>
        );
    };

    // Define the renderMessage function
    const renderMessage = (message, index) => {
        const isUser = message.type === 'user';
        const messageContent = message.content; // Use the original content directly

        // Always show mode indicator for AI messages
        const shouldShowModeIndicator = !isUser;

        // REMOVED Pre-processing call
        /*
        const messageContent = (!isUser && typeof originalMessageContent === 'string') 
            ? addMathDelimiters(originalMessageContent) 
            : originalMessageContent;
        */

        // console.log(`Message ${index} (AI: ${!isUser}): Processing with ReactMarkdown.`);

        return (
            <React.Fragment key={message.id || index}>
                {/* Remove the smaller timestamp banner logic here */}
                {/* 
                {index === 0 || (index > 0 && isSameDay(new Date(message.timestamp), new Date(chatHistory[index - 1].timestamp)) === false) ? (
                    <div className="chat-timestamp-banner">
                        <FaClock />
                        <span>{formatTimestamp(message.timestamp)}</span>
                    </div>
                ) : null}
                */}

                <div className="message-number-indicator">
                    <FaCommentAlt />
                    <span>{`Message ${Math.floor(index / 2) + 1}`}</span>
                </div>

                {shouldShowModeIndicator && renderModeIndicator(message, index)}

                <div className={`chat-message ${isUser ? 'user' : 'ai'}`}>
                    <strong>{isUser ? 'You:' : 'Assistant:'}</strong>
                    <div className="message-content">
                        {isUser ? (
                            <p>{messageContent}</p> // User messages remain simple paragraphs
                        ) : (
                            // Use ReactMarkdown for AI messages
                            typeof messageContent === 'object' ?
                                messageContent : // Handle loading indicator
                                (() => {
                                    // --> ADD LOGGING HERE <--
                                    console.log('[renderMessage] Content passed to ReactMarkdown:', messageContent);
                                    
                                    // --- ADD PRE-PROCESSING STEP --- 
                                    let processedContent = messageContent;
                                    // Replace $...$ around bmatrix/array with $$...$$
                                    // Use a regex to target these specific block environments
                                    // Ensures we don't affect regular inline math
                                    const blockMathRegex = /\$(\\begin{(?:bmatrix|array)[\s\S]*?\\end{(?:bmatrix|array)}})\$/g;
                                    processedContent = processedContent.replace(blockMathRegex, '$$$1$$');
                                    // --- END PRE-PROCESSING STEP --- 
                                    
                                    return (
                                        <ReactMarkdown
                                            remarkPlugins={[remarkMath]} // Enable math syntax parsing
                                            rehypePlugins={[rehypeKatex]} // Render math using KaTeX
                                            // Ensure HTML from markdown is not escaped
                                            // By default, react-markdown handles basic HTML safely
                                            // If you need complex HTML, you might need rehype-raw
                                            components={{
                                                // Use the custom CodeBlock for rendering code elements
                                                code: CodeBlock,
                                            }}
                                        >
                                            {processedContent} 
                                        </ReactMarkdown>
                                    );
                                })()
                        )}
                    </div>
                </div>
            </React.Fragment>
        );
    };

    return (
        <div className="chat-container">
            <div className="chat-header">
                <div className="header-left">
                    <div className="header-buttons">
                        <div className="profile-container">
                            <button 
                                className="profile-button"
                                onClick={() => setShowProfileMenu(!showProfileMenu)}
                                key="profile-button-1"
                                style={{backgroundColor: 'rgb(234, 244, 235)'}}
                                data-tooltip="View Account"
                            >
                                <FaUser className="header-icon" />
                            </button>
                            {showProfileMenu && (
                                <div className="profile-menu">
                                    <button onClick={handleSignOut}>Sign Out</button>
                                    <button onClick={handleChangeAccountInfo}>Change Account Information</button>
                                    <button onClick={handleDeleteAccount}>Delete Account</button>
                                    <button onClick={handleAboutApp}>About The App</button>
                                </div>
                            )}
                        </div>
                        {isViewingHistory && (
                            <button 
                                onClick={handleBack} 
                                className="icon-button"
                                style={{backgroundColor: 'rgb(234, 244, 235)'}}
                                data-tooltip="Back to History"
                            >
                                <FaArrowLeft className="header-icon" />
                            </button>
                        )}
                    </div>
                </div>
                
                <div className="chat-title-container">
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3px' }}>
                        <FaRobot style={{ fontSize: '28px', color: '#4285f4', marginRight: '12px' }} />
                        <FaAws style={{ fontSize: '28px', color: '#ff9900' }} />
                    </div>
                    <h2 style={{ 
                        fontFamily: 'Times New Roman, serif', 
                        fontWeight: 'bold', 
                        fontSize: '28px',
                        color: 'rgb(34, 31, 31)'
                    }}>Chat With AI</h2>
                </div>
                
                <div className="header-right">
                    <div className="header-buttons">
                        <button onClick={handleToggleBookmark} 
                            className="icon-button" 
                            key="bookmark-button-1"
                            style={{backgroundColor: 'rgb(234, 244, 235)'}}
                            data-tooltip={isBookmarked ? "Remove Bookmark" : "Bookmark Chat"}
                        >
                            {isBookmarked ? 
                                <FaBookmark className="header-icon bookmark-icon-active" /> : 
                                <FaRegBookmark className="header-icon" />
                            }
                        </button>
                        <button onClick={() => navigate('/chat-history')} 
                            className="icon-button" 
                            key="history-button-1"
                            style={{backgroundColor: 'rgb(234, 244, 235)'}}
                            data-tooltip="View History"
                        >
                            <FaHistory className="header-icon" />
                        </button>
                        <button onClick={handleNewChat} 
                            className="icon-button" 
                            key="new-chat-button-1"
                            style={{backgroundColor: 'rgb(234, 244, 235)'}}
                            data-tooltip="New Chat"
                        >
                            <FaEdit className="header-icon" />
                        </button>
                    </div>
                </div>
            </div>
            
            {isModelLoading ? (
                <div className="loading-container">
                    <LoadingIndicator size="standard" />
                    <p>Initializing chat model...</p>
                </div>
            ) : (
                <>
                    {/* Display chat title if viewing history or if we have messages and a title */}
                    {(isViewingHistory || (chatHistory.length > 0 && chatTitle)) && (
                        <div className="chat-title-banner" style={{
                            background: 'rgb(234, 244, 235)',
                            padding: '10px 16px',
                            margin: '20px 0 0 0',
                            borderRadius: '8px 8px 0 0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px',
                            color: 'rgb(91, 91, 92)',
                            fontWeight: '500',
                            borderBottom: '1px solid rgba(0,0,0,0.05)',
                            textAlign: 'center',
                            lineHeight: '1.3',
                            maxWidth: '100%',
                            wordBreak: 'break-word'
                        }}>
                            <FaBook style={{ marginRight: '10px', fontSize: '16px', flexShrink: 0 }} /> 
                            <span style={{ maxWidth: 'calc(100% - 26px)' }}>
                                {chatTitle || (() => {
                                    // Always prioritize getting the first message from chat history as the title
                                    const firstMessage = getFirstMessageFromHistory(chatHistory);
                                    console.log("Generating title from first message:", firstMessage);
                                    
                                    if (!firstMessage) return "New Chat";
                                    
                                    // Use the first message content as the title, truncated if needed
                                    return firstMessage.content.length > 60 
                                        ? firstMessage.content.substring(0, 60) + '...' 
                                        : firstMessage.content;
                                })()}
                            </span>
                        </div>
                    )}
                    
                    {/* Display formatted timestamp with AM/PM if present */}
                    {chatTimestamp && (
                        <div className="chat-timestamp-banner" style={{
                            background: 'rgb(234, 244, 235)',
                            padding: '10px 16px',
                            margin: '20px 0 0 0',
                            borderRadius: '8px 8px 0 0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px',
                            color: 'rgb(91, 91, 92)',
                            fontWeight: '500',
                            borderBottom: '1px solid rgba(0,0,0,0.05)',
                            textAlign: 'center',
                            lineHeight: '1.3',
                            maxWidth: '100%',
                            wordBreak: 'break-word'
                        }}>
                            <FaClock style={{ marginRight: '10px', fontSize: '16px', flexShrink: 0 }} /> 
                            <span style={{ maxWidth: 'calc(100% - 26px)' }}>
                                Chat from {formatTimestamp(chatTimestamp)} (your local time)
                            </span>
                        </div>
                    )}
                    
                    {/* Chat messages */}
                    <div
                        className={`chat-messages-wrapper ${isViewingHistory ? 'sandwich-bottom' : ''}`}
                        style={{ 
                            backgroundColor: '#FFFFF2',
                            marginBottom: isViewingHistory ? 0 : '120px'
                        }}
                    >
                        <div 
                            className="chat-messages" 
                            ref={messagesEndRef}
                            style={{ backgroundColor: '#FFFFF2' }}
                        >
                            {chatHistory.map((message, index) => renderMessage(message, index))}
                            
                            {isGenerating && !error && (
                                <div ref={messagesEndRef} className="user-message-spacing"></div>
                            )}
                            
                            {error && (
                                <div className="error-message-container" style={{
                                    backgroundColor: '#FFEEEE',
                                    color: '#CC0000',
                                    padding: '12px 16px',
                                    borderRadius: '6px',
                                    fontWeight: 'bold',
                                    textAlign: 'center',
                                    margin: '20px auto',
                                    maxWidth: '80%',
                                    fontSize: '14px'
                                }}>
                                    {error}
                                    <button 
                                        onClick={resetErrorState} 
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#CC0000',
                                            textDecoration: 'underline',
                                            cursor: 'pointer',
                                            marginLeft: '10px',
                                            fontSize: '12px'
                                        }}
                                    >
                                        Clear
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {!isViewingHistory ? (
                        <div className="chat-input">
                            {/* Header with messages remaining and model mode - moved into the chat input area */}
                            {remainingMessages !== null && (
                                <div className="chat-header-box">
                                    <div className="messages-remaining">
                                        <FaComments className="header-icon" />
                                        <span>Messages Remaining: {remainingMessages}</span>
                                    </div>
                                    
                                    <div className="model-mode-box" ref={modeSelectorRef}>
                                        <button 
                                            onClick={() => setShowModeSelector(!showModeSelector)} 
                                            className="model-mode-button-rect"
                                            aria-label="Select AI model mode"
                                            aria-expanded={showModeSelector}
                                            aria-haspopup="true"
                                        >
                                            <FaRobot className="header-icon" style={{ color: '#4285f4' }} />
                                            <span className="mode-label">Model Mode:</span>
                                            {modelMode === 'auto' && <span className="mode-icon auto-icon" title="Automatic Mode">⟳</span>}
                                            {modelMode === 'default' && <span className="mode-icon default-icon" title="Default Mode">💡</span>}
                                            {modelMode === 'math' && <span className="mode-icon math-icon" title="Math Reasoning Mode">🧮</span>}
                                            <span className="mode-text">
                                                {modelMode === 'auto' ? 'Automatic' : 
                                                 modelMode === 'default' ? 'Default' : 'Math'}
                                            </span>
                                            <FaCaretDown className="dropdown-arrow" />
                                        </button>
                                        
                                        {showModeSelector && (
                                            <div className="model-mode-dropdown">
                                                <button 
                                                    className={`mode-option ${modelMode === 'auto' ? 'selected' : ''}`}
                                                    onClick={() => handleModeChange('auto')}
                                                    data-mode="auto"
                                                    aria-label="Automatic Mode - Detects math questions automatically"
                                                >
                                                    <span className="mode-icon auto-icon">⟳</span>
                                                    <span className="mode-text">Automatic</span>
                                                </button>
                                                <button 
                                                    className={`mode-option ${modelMode === 'default' ? 'selected' : ''}`}
                                                    onClick={() => handleModeChange('default')}
                                                    data-mode="default"
                                                    aria-label="Default Mode - General purpose AI"
                                                >
                                                    <span className="mode-icon default-icon">💡</span>
                                                    <span className="mode-text">Default Mode</span>
                                                </button>
                                                <button 
                                                    className={`mode-option ${modelMode === 'math' ? 'selected' : ''}`}
                                                    onClick={() => handleModeChange('math')}
                                                    data-mode="math"
                                                    aria-label="Math Reasoning Mode - Specialized for math problems"
                                                >
                                                    <span className="mode-icon math-icon">🧮</span>
                                                    <span className="mode-text">Math Reasoning</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '100%',
                                marginBottom: '15px'
                            }}>
                                <div className="disclaimer-text-top" style={{ 
                                    width: '100%',
                                    textAlign: 'center', 
                                    fontStyle: 'italic',
                                    color: 'rgb(34, 31, 31)',
                                    fontSize: '0.9rem',
                                    lineHeight: '1.5',
                                    marginBottom: '5px'
                                }}>
                                    This AI model only knows of information up to the year 2021.
                                </div>
                                <div className="disclaimer-text-middle" style={{ 
                                    width: '100%',
                                    textAlign: 'center', 
                                    fontStyle: 'italic',
                                    color: 'rgb(34, 31, 31)',
                                    fontSize: '0.9rem',
                                    lineHeight: '1.5'
                                }}>
                                    AI models are known to make mistakes. Take information in with caution.
                                </div>
                            </div>

                            {/* Replace the input-container with the larger chat-input-form */}
                            <form className="chat-input-form" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
                                <div className="textarea-container">
                                    <textarea
                                        ref={textAreaRef}
                                        value={message}
                                        onChange={handleMessageChange}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Type your message..."
                                        className={`chat-textarea ${isGenerating ? 'disabled-textarea' : ''} ${isTextareaEmpty() ? 'empty' : ''}`}
                                        rows={1}
                                        disabled={isGenerating || remainingMessages <= 0 || activeRequestId !== null}
                                        style={{ caretColor: '#4285f4', caretShape: 'bar', backgroundColor: '#FFFFF2' }}
                                    ></textarea>
                                    <div className="send-button-container">
                                        <button 
                                            type="submit"
                                            className={`send-button ${isGenerating || !message.trim() || remainingMessages <= 0 || activeRequestId !== null ? 'disabled-button' : ''}`}
                                            disabled={isGenerating || !message.trim() || remainingMessages <= 0 || activeRequestId !== null}
                                        >
                                            {isGenerating ? <LoadingIndicator size="small" /> : <FaPaperPlane style={{ color: '#ff9900' }} />}
                                        </button>
                                    </div>
                                </div>
                            </form>

                            <div className="disclaimer-text-bottom" style={{ 
                                marginTop: '10px', 
                                textAlign: 'center', 
                                fontStyle: 'italic',
                                color: 'rgb(34, 31, 31)',
                                fontSize: '0.9rem',
                                lineHeight: '1.5'
                            }}>
                                This app uses a 3-bit quantized version of the OpenChat 3.5-0106 model.
                                <br />
                                Quantized AI models are known to be less precise compared to full sized AI models.
                            </div>
                        </div>
                    ) : (
                        <div className="history-mode-notice" style={{ 
                            position: 'relative',
                            marginTop: '0',
                            borderTopLeftRadius: '0',
                            borderTopRightRadius: '0',
                            marginBottom: '0'
                        }}>
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                margin: '0',
                                textAlign: 'center',
                                width: '100%',
                                padding: '12px'
                            }}>
                                <p style={{ margin: '0' }}>You are viewing a past conversation. Click the pencil icon to start a new chat.</p>
                                {error && (
                                    <div className="error-message-container" style={{
                                        backgroundColor: '#FFEEEE',
                                        color: '#CC0000',
                                        padding: '12px 16px',
                                        borderRadius: '6px',
                                        fontWeight: 'bold',
                                        textAlign: 'center',
                                        margin: '10px auto',
                                        maxWidth: '80%',
                                        fontSize: '14px'
                                    }}>
                                        {error}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Chat;