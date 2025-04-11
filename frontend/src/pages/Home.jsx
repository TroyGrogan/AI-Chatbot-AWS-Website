import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
    return (
        <div>
            <h1>Welcome</h1>
            <button><Link to="/chat">New Chat</Link></button>
            <button><Link to="/chat-history">Chat History</Link></button>
            <button><Link to="/login">Sign Out</Link></button>
            {/* Keep note-related UI here if desired */}
        </div>
    );
};

export default Home;