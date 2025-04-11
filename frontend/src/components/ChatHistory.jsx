import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { FaArrowLeft, FaPencilAlt, FaClock, FaComments, FaEdit, FaCheck, FaTimes, FaBookmark, FaRegBookmark, FaSearch, FaTrashAlt, FaRobot, FaAws, FaUser } from 'react-icons/fa';
import "../styles/ChatHistory.css";

const ChatHistory = () => {
    const [chatSessions, setChatSessions] = useState([]);
    const [keyword, setKeyword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [editingChatId, setEditingChatId] = useState(null);
    const [newTitle, setNewTitle] = useState('');
    const [showBookmarked, setShowBookmarked] = useState(() => {
        // Initialize from sessionStorage, default to false if not set
        return sessionStorage.getItem('chatHistoryBookmarkTab') === 'true';
    });
    const [isSaving, setIsSaving] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const lastRenameTimestamp = useRef(0);
    const navigate = useNavigate();
    const location = useLocation();

    // Function to format timestamp with AM/PM - same as in Chat.jsx
    const formatTimestamp = (timestampStr) => {
        try {
            if (!timestampStr) return "Unknown time";
            
            console.log("ChatHistory: Formatting timestamp:", timestampStr);
            
            // Handle ISO format timestamps that might include T and Z
            let date;
            if (timestampStr.includes('T')) {
                // It's already in ISO format
                date = new Date(timestampStr);
                console.log("ChatHistory: Created date from ISO format:", date);
            } else {
                // Parse the timestamp string (which is in format "YYYY-MM-DD HH:MM:SS")
                const [datePart, timePart] = timestampStr.split(' ');
                if (!datePart || !timePart) return timestampStr; // Return original if format is unexpected
                
                const [year, month, day] = datePart.split('-');
                const [hour, minute, second] = timePart.split(':');
                
                // Create a JavaScript Date object
                date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
                console.log("ChatHistory: Created date from string parts:", date);
            }
            
            // Check if date is valid
            if (isNaN(date.getTime())) {
                console.error('Invalid date created from timestamp:', timestampStr);
                return timestampStr;
            }
            
            // Format the date with AM/PM in user's local time zone (browser automatically uses local timezone)
            const formattedDate = date.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            
            console.log("ChatHistory: Formatted date in local timezone:", formattedDate);
            return formattedDate;
        } catch (error) {
            console.error('Error formatting timestamp:', error, timestampStr);
            return timestampStr; // Return original string if parsing fails
        }
    };

    useEffect(() => {
        // Just fetch chats when the component mounts or bookmark tab changes
        fetchChats();
    }, [showBookmarked]);

    // Save showBookmarked state to sessionStorage when it changes
    useEffect(() => {
        sessionStorage.setItem('chatHistoryBookmarkTab', showBookmarked);
    }, [showBookmarked]);

    // Ensure the page is scrolled to top when component mounts
    useEffect(() => {
        // Scroll to top when component mounts
        window.scrollTo(0, 0);
    }, []);

    // Simplify the tab switching function
    const handleTabSwitch = (showBookmarkedValue) => {
        // Only proceed if we're actually changing tabs
        if (showBookmarkedValue !== showBookmarked) {
            setShowBookmarked(showBookmarkedValue);
            // Scroll to top when switching tabs
            window.scrollTo(0, 0);
        }
    };

    // Simplify the fetchChats function to remove scroll position tracking
    const fetchChats = async () => {
        setLoading(true);
        try {
            // Update URL to include bookmark filter
            const bookmarkParam = showBookmarked ? '?bookmarked=true' : '';
            const keywordParam = keyword ? `${showBookmarked ? '&' : '?'}keyword=${keyword}` : '';
            const url = `/api/chat-history/${bookmarkParam}${keywordParam}`;
            
            console.log("Fetching chat history with URL:", url);
            const response = await api.get(url);
            console.log("Chat history response:", response.data);
            
            setChatSessions(response.data);
            setError('');
        } catch (error) {
            console.error('Error fetching chat history:', error);
            setError('Failed to load chat history. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        // Scroll to top for new search results
        window.scrollTo(0, 0);
        fetchChats();
    };

    const handleDeleteChat = async (sessionId) => {
        if (!window.confirm('Are you sure you want to delete this chat?')) {
            return;
        }
        
        try {
            await api.delete(`/api/chat-session/delete/${sessionId}/`);
            setChatSessions(chatSessions.filter(session => session.id !== sessionId));
        } catch (error) {
            console.error('Error deleting chat session:', error);
            setError('Failed to delete chat. Please try again.');
        }
    };

    const handleBack = () => {
        navigate(-1); // Goes back to previous page
    };

    const handleNewChat = () => {
        // Ensure we reset the state by explicitly using an empty state
        navigate('/chat', { state: null });
    };

    const handleChatSelect = (session) => {
        // // Now update the session view count in the background
        // api.post(`/api/chat-session/view/${session.id}/`)
        //     .catch(err => console.error('Error updating view count:', err));
        
        // Get all messages in chronological order to ensure we pass the correct first message
        const chronologicalMessages = [...(session.messages || [])].sort((a, b) => {
            return new Date(a.timestamp) - new Date(b.timestamp);
        });
        
        // Get the first message for title
        const firstMessage = chronologicalMessages.length > 0 
            ? chronologicalMessages[0] 
            : null;
            
        // Find the first message ID for bookmark functionality
        const firstMessageId = firstMessage ? firstMessage.id : null;

        // Transform the messages into alternating user/ai messages for the chat view
        const formattedChatHistory = [];
        
        for (const msg of chronologicalMessages) {
            // Add user message
            formattedChatHistory.push({
                id: msg.id + '-user',
                type: 'user',
                content: msg.message,
                timestamp: msg.timestamp
            });
            
            // Add AI response with model mode information
            formattedChatHistory.push({
                id: msg.id + '-ai',
                type: 'ai',
                content: msg.response,
                timestamp: msg.timestamp,
                model_mode: msg.model_mode,
                is_automatic: msg.is_automatic
            });
        }

        navigate(`/chat/${session.id}`, {
            state: {
                selectedChat: {
                    id: session.id,
                    // Use first message as title if no explicit title exists
                    title: session.title || (firstMessage ? firstMessage.message : "Untitled Chat"),
                    timestamp: session.created_at,
                    bookmarked: session.bookmarked,
                    firstMessageId: firstMessageId
                },
                chatHistory: formattedChatHistory,
                chatSession: session.id,
                remainingMessages: session.remaining_messages
            }
        });
    };

    const handleStartRenaming = (e, session) => {
        e.stopPropagation();
        
        // Don't allow another rename to start if we're still saving
        if (isSaving) {
            return;
        }
        
        // Check if this is too soon after a previous rename
        const now = Date.now();
        const timeSinceLastRename = now - lastRenameTimestamp.current;
        
        // Prevent multiple renames within 1 second to avoid potential API conflicts
        if (timeSinceLastRename < 1000) {
            console.log("Rename requested too quickly after previous rename, ignoring");
            return;
        }
        
        setEditingChatId(session.id);
        setNewTitle(session.title || '');
    };

    const handleSaveTitle = async (e, sessionId) => {
        e.stopPropagation();
        if (!newTitle.trim()) {
            return;
        }
        
        // Don't allow multiple simultaneous saves
        if (isSaving) {
            return;
        }
        
        try {
            // Indicate save in progress
            setIsSaving(true);
            
            // Step 1: Save the current scroll position
            const scrollPosition = window.pageYOffset;
            
            // Step 2: Enforce character limit (40 characters)
            const MAX_TITLE_LENGTH = 40;
            let finalTitle = newTitle.trim();
            
            if (finalTitle.length > MAX_TITLE_LENGTH) {
                finalTitle = finalTitle.substring(0, MAX_TITLE_LENGTH);
            }
            
            // Step 3: Optimistically update the UI first for immediate feedback
            setChatSessions(prevSessions => 
                prevSessions.map(session => 
                    session.id === sessionId 
                        ? { ...session, title: finalTitle } 
                        : session
                )
            );
            
            // Step 4: Exit editing mode immediately for better UX
            setEditingChatId(null);
            setError(''); // Clear any previous errors
            
            // Step 5: Make the API call in the background
            const response = await api.put(`/api/chat-session/rename/${sessionId}/`, { title: finalTitle });
            console.log("Rename successful:", response.data);
            
            // Update the last rename timestamp
            lastRenameTimestamp.current = Date.now();
            
            // Step 6: Restore scroll position
            setTimeout(() => {
                window.scrollTo(0, scrollPosition);
            }, 10);
        } catch (error) {
            console.error('Error renaming chat session:', error);
            
            // Try to extract more specific error message from the response
            const errorMessage = error.response?.data?.detail || 
                               error.response?.data?.error || 
                               'Failed to rename chat. Please try again.';
            setError(errorMessage);
            
            // If the API call fails, revert to the original title
            const originalSession = chatSessions.find(s => s.id === sessionId);
            if (originalSession) {
                setChatSessions(prevSessions => 
                    prevSessions.map(session => 
                        session.id === sessionId 
                            ? { ...session, title: originalSession.title } 
                            : session
                    )
                );
            }
            
            // Exit editing mode
            setEditingChatId(null);
            
            // Clear error message after 5 seconds
            setTimeout(() => {
                setError('');
            }, 5000);
        } finally {
            // Reset saving state
            setIsSaving(false);
        }
    };

    const handleCancelRename = (e) => {
        if (e) e.stopPropagation();
        setEditingChatId(null);
        setNewTitle('');
    };

    // Add a keyboard handler for better rename experience
    const handleRenameKeyDown = (e, sessionId) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSaveTitle(e, sessionId);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancelRename(e);
        }
    };

    const handleToggleBookmark = async (e, sessionId, isCurrentlyBookmarked) => {
        e.stopPropagation(); // Prevent navigating to the chat
        
        try {
            // Find the first message in this session to get its ID
            const session = chatSessions.find(s => s.id === sessionId);
            if (!session || !session.messages || session.messages.length === 0) {
                setError("No chat messages found to bookmark");
                return;
            }
            
            const firstMessageId = session.messages[0].id;
            
            // First, optimistically update the UI for immediate feedback without any jumps
            setChatSessions(prevSessions => 
                prevSessions.map(session => 
                    session.id === sessionId 
                        ? { ...session, bookmarked: !isCurrentlyBookmarked } 
                        : session
                )
            );
            
            // Then make the API call in the background
            if (isCurrentlyBookmarked) {
                // Call the unbookmark endpoint
                await api.post(`/api/unbookmark-chat/${firstMessageId}/`);
            } else {
                // Call the bookmark endpoint
                await api.post(`/api/bookmark-chat/${firstMessageId}/`);
            }
            
            // No need to call fetchChats here - we've already updated the UI
            // This is what was causing the jumpiness
        } catch (error) {
            console.error("Error toggling bookmark:", error);
            setError("Failed to update bookmark. Please try again.");
            
            // If there was an error, revert the optimistic update
            setChatSessions(prevSessions => 
                prevSessions.map(session => 
                    session.id === sessionId 
                        ? { ...session, bookmarked: isCurrentlyBookmarked } 
                        : session
                )
            );
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
        // Navigate to account info page
        navigate('/account-info');
    };

    const handleDeleteAccount = () => {
        // Close the profile menu
        setShowProfileMenu(false);
        // Navigate to delete account page
        navigate('/delete-account');
    };

    const handleAboutApp = () => {
        // Close the profile menu
        setShowProfileMenu(false);
        // Navigate to about page
        navigate('/about');
    };

    // Add a helper function to get the first chronological message
    const getFirstChronologicalMessage = (messages) => {
        if (!messages || messages.length === 0) return null;
        
        // Sort messages by timestamp
        return [...messages].sort((a, b) => {
            return new Date(a.timestamp) - new Date(b.timestamp);
        })[0];
    };

    // Add or update the renderChatTitle function to prioritize first message
    const renderChatTitle = (session) => {
        // Get the first chronological message
        const messages = session.messages || [];
        const firstMessage = getFirstChronologicalMessage(messages);
        
        // Priority:
        // 1. Use the explicitly set title if available
        // 2. Otherwise use the first message content as title
        // 3. Fallback to "Untitled Chat" if neither is available
        
        if (session.title) {
            // Use the explicit title, truncated if needed
            return session.title.length > 40 
                ? `${session.title.substring(0, 40)}...` 
                : session.title;
        } else if (firstMessage && firstMessage.message) {
            // Use the first message content as the title
            return firstMessage.message.length > 40
                ? `${firstMessage.message.substring(0, 40)}...`
                : firstMessage.message;
        } else {
            return "Untitled Chat";
        }
    };

    return (
        <div className="chat-history-container">
            <div className="history-header">
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
                        <button 
                            onClick={handleBack} 
                            className="icon-button"
                            data-tooltip="Go Back"
                            style={{backgroundColor: 'rgb(234, 244, 235)'}}
                        >
                            <FaArrowLeft className="header-icon" />
                        </button>
                    </div>
                </div>
                
                <div className="history-title-container">
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3px' }}>
                        <FaRobot style={{ fontSize: '28px', color: '#4285f4', marginRight: '12px' }} />
                        <FaAws style={{ fontSize: '28px', color: '#ff9900' }} />
                    </div>
                    <h2 style={{ 
                        fontFamily: 'Times New Roman, serif', 
                        fontWeight: 'bold', 
                        fontSize: '28px',
                        color: '#000'
                    }}>History</h2>
                </div>
                
                <div className="header-right">
                    <button 
                        onClick={handleNewChat}
                        className="icon-button"
                        data-tooltip="New Chat"
                    >
                        <FaEdit className="header-icon" />
                    </button>
                </div>
            </div>
            
            <div className="search-container">
                <form onSubmit={handleSearch} className="search-form">
                    <div className="search-input-wrapper">
                        <FaSearch className="search-icon" />
                        <input
                            type="text"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            placeholder={showBookmarked ? "Search Your Bookmarks" : "Search Your Chats"}
                            className="search-input"
                        />
                    </div>
                    <button type="submit" className="search-button">Search</button>
                </form>
            </div>
            
            <div className="tabs-container">
                <button 
                    className={`tab ${!showBookmarked ? 'active-tab' : ''}`}
                    onClick={() => handleTabSwitch(false)}
                >
                    Chats
                </button>
                <button 
                    className={`tab ${showBookmarked ? 'active-tab' : ''}`}
                    onClick={() => handleTabSwitch(true)}
                >
                    Bookmarks
                </button>
            </div>
            
            {error && <p className="error-message">{error}</p>}
            
            {loading ? (
                <p className="loading-message">Loading chat history...</p>
            ) : chatSessions.length === 0 ? (
                <p className="no-chats-message">
                    {showBookmarked 
                        ? "You don't have any bookmarked chats yet." 
                        : "You don't have any chat history yet."}
                </p>
            ) : (
                <div className="chat-list">
                    {chatSessions.map(session => {
                        // Get the messages in chronological order (oldest first)
                        const chronologicalMessages = [...(session.messages || [])].sort((a, b) => {
                            // Sort by timestamp (assuming timestamps are strings in format "YYYY-MM-DD HH:MM:SS")
                            return new Date(a.timestamp) - new Date(b.timestamp);
                        });
                        
                        // Get the first message for title and preview
                        const firstMessage = chronologicalMessages.length > 0 
                            ? chronologicalMessages[0] 
                            : null;
                            
                        // Calculate the correct message count
                        let messageCount;
                        
                        if (session.messages && session.messages.length > 0) {
                            // Use the actual length of the messages array
                            messageCount = session.messages.length;
                        } else if (typeof session.message_count === 'number') {
                            // Fallback to backend-provided count
                            messageCount = session.message_count;
                        } else {
                            // Last resort fallback
                            messageCount = session.remaining_messages !== undefined 
                                ? 5 - session.remaining_messages 
                                : 0;
                        }
                        // The key was to prioritize using the actual length 
                        // of the messages array, which gives you the most accurate count. 
                        // The previous calculation was trying to infer the count from the remaining messages, 
                        // which wasn't reliable.

                        
                        // Ensure we always have at least 1 message if there are any messages at all
                        if (session.messages && session.messages.length > 0 && messageCount === 0) {
                            messageCount = 1;
                        }
                        
                        return (
                            <div 
                                key={session.id} 
                                className={`chat-item ${session.bookmarked ? 'bookmarked' : ''}`}
                                onClick={() => handleChatSelect(session)}
                            >
                                <div className="chat-header-row">
                                    <span className="chat-timestamp">
                                        <FaClock className="list-icon" /> {formatTimestamp(session.timestamp)} (local time)
                                    </span>
                                    <span className="message-count">
                                        <FaComments className="list-icon" /> {messageCount} {messageCount === 1 ? 'Message' : 'Messages'}
                                    </span>
                                </div>
                                <div className="chat-content">
                                    {editingChatId === session.id ? (
                                        <div className="title-edit-container">
                                            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                                <input
                                                    type="text"
                                                    value={newTitle}
                                                    onChange={(e) => setNewTitle(e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onKeyDown={(e) => handleRenameKeyDown(e, session.id)}
                                                    className="title-edit-input"
                                                    autoFocus
                                                    maxLength={40}
                                                    disabled={isSaving}
                                                    placeholder="Enter chat title..."
                                                />
                                                <div style={{ 
                                                    fontSize: '0.75rem', 
                                                    color: newTitle.length > 35 ? '#cc0000' : '#777',
                                                    textAlign: 'left',
                                                    marginLeft: '5px',
                                                    marginTop: '2px'
                                                }}>
                                                    {newTitle.length}/40 characters
                                                </div>
                                            </div>
                                            <div className="title-edit-buttons">
                                                <button 
                                                    onClick={(e) => handleSaveTitle(e, session.id)}
                                                    className={`title-save-btn ${isSaving ? 'saving' : ''}`}
                                                    data-tooltip="Save"
                                                    disabled={isSaving}
                                                >
                                                    {isSaving ? <span className="saving-indicator">...</span> : <FaCheck />}
                                                </button>
                                                <button 
                                                    onClick={handleCancelRename}
                                                    className="title-cancel-btn"
                                                    data-tooltip="Cancel"
                                                    disabled={isSaving}
                                                >
                                                    <FaTimes />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="chat-info-container">
                                            <div className="title-and-text">
                                                <h3 className="chat-title">
                                                    {renderChatTitle(session)}
                                                </h3>
                                                
                                                <p className="preview-message">
                                                    <strong>You:</strong> {firstMessage?.message?.substring(0, 60) || "No message"}
                                                    {firstMessage?.message?.length > 60 ? "..." : ""}
                                                </p>
                                                <p className="preview-response">
                                                    <strong>Assistant:</strong> {firstMessage?.response?.substring(0, 60) || "No response"}
                                                    {firstMessage?.response?.length > 60 ? "..." : ""}
                                                </p>
                                                {firstMessage && firstMessage.model_mode && (
                                                    <p className="preview-mode">
                                                        <strong>Mode:</strong> {" "}
                                                        {firstMessage.is_automatic && <span title="Automatic">⟳ </span>}
                                                        {firstMessage.model_mode === "Math Correct" ? 
                                                            <span title="Math Reasoning Mode">🧮 Math Reasoning</span> : 
                                                            <span title="Default Mode">💡 Default</span>
                                                        }
                                                    </p>
                                                )}
                                            </div>
                                            
                                            <div className="chat-actions-row">
                                                <button 
                                                    onClick={(e) => handleStartRenaming(e, session)}
                                                    className="action-btn rename-btn"
                                                    data-tooltip="Rename Chat"
                                                >
                                                    <FaPencilAlt className="action-icon" />
                                                </button>
                                                <button 
                                                    onClick={(e) => handleToggleBookmark(e, session.id, session.bookmarked)}
                                                    className="action-btn bookmark-btn"
                                                    data-tooltip={session.bookmarked ? "Remove Bookmark" : "Bookmark Chat"}
                                                >
                                                    {session.bookmarked 
                                                        ? <FaBookmark className="action-icon bookmark-icon-active" /> 
                                                        : <FaRegBookmark className="action-icon" />}
                                                </button>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteChat(session.id);
                                                    }}
                                                    className="action-btn delete-btn"
                                                    data-tooltip="Delete Chat"
                                                >
                                                    <FaTrashAlt className="action-icon" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ChatHistory;