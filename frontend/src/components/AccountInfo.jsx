import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaUser, FaSave, FaKey, FaRobot, FaAws, FaEye, FaEyeSlash, FaCheck, FaTimes } from 'react-icons/fa';
import api from '../api';
import '../styles/About.css'; // Reuse the about styles for consistency
import LoadingIndicator from './LoadingIndicator';
import { ACCESS_TOKEN, REFRESH_TOKEN } from '../constants';

const AccountInfo = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', isError: false });
    const [activeTab, setActiveTab] = useState('username'); // 'username' or 'password'
    
    // Password visibility states
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    
    // Password validation state
    const [passwordsMatch, setPasswordsMatch] = useState(true);

    // Verify authentication on component mount
    useEffect(() => {
        // Check if user is authenticated
        const token = localStorage.getItem(ACCESS_TOKEN);
        if (!token) {
            console.error('No authentication token found');
            navigate('/login');
            return;
        }

        // Log the token to help debug
        console.log('Auth token exists:', !!token);
        
        // Fetch user info only if authenticated
        const fetchUserInfo = async () => {
            try {
                const response = await api.get('/api/user/info/');
                setUsername(response.data.username);
                console.log('Fetched user info successfully:', response.data.username);
            } catch (error) {
                console.error('Error fetching user info:', error);
                // If error is authentication-related, redirect to login
                if (error.response && error.response.status === 401) {
                    console.error('Authentication error, redirecting to login');
                    navigate('/login');
                }
            }
        };

        fetchUserInfo();
    }, [navigate]);

    // Update passwordsMatch state when either password field changes
    useEffect(() => {
        if (confirmPassword) {
            setPasswordsMatch(newPassword === confirmPassword);
        } else {
            setPasswordsMatch(true);
        }
    }, [newPassword, confirmPassword]);

    const handleUsernameUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ text: '', isError: false });

        try {
            // Verify token exists before making request
            const token = localStorage.getItem(ACCESS_TOKEN);
            if (!token) {
                setMessage({ text: 'Authentication required. Please login again.', isError: true });
                setTimeout(() => navigate('/login'), 2000);
                return;
            }

            const response = await api.put('/api/user/update/', { username });
            setMessage({ text: 'Username updated successfully!', isError: false });
        } catch (error) {
            console.error('Error updating username:', error);
            if (error.response && error.response.status === 401) {
                setMessage({ text: 'Authentication expired. Please login again.', isError: true });
                setTimeout(() => navigate('/login'), 2000);
            } else if (error.response && error.response.status === 400) {
                setMessage({ 
                    text: error.response.data.username || "Username is already taken! Please pick another username.", 
                    isError: true 
                });
            } else {
                setMessage({ 
                    text: 'An error occurred while updating your username. Please try again.', 
                    isError: true 
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ text: '', isError: false });

        // Verify token exists before continuing
        const token = localStorage.getItem(ACCESS_TOKEN);
        if (!token) {
            setMessage({ text: 'Authentication required. Please login again.', isError: true });
            setTimeout(() => navigate('/login'), 2000);
            setLoading(false);
            return;
        }

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            setMessage({ text: 'Passwords do not match!', isError: true });
            setLoading(false);
            return;
        }

        // Frontend password validation
        if (newPassword.length < 8) {
            setMessage({ text: 'Password must be at least 8 characters long.', isError: true });
            setLoading(false);
            return;
        }

        if (/^\d+$/.test(newPassword)) {
            setMessage({ text: 'Password cannot be entirely numeric.', isError: true });
            setLoading(false);
            return;
        }

        // Create request payload - include username which is required by the backend
        const requestData = {
            username: username, // Always include current username
            current_password: currentPassword,
            password: newPassword,
            password_confirm: confirmPassword
        };

        console.log('Sending password update request with username:', username);

        try {
            const response = await api.put('/api/user/update/', requestData);
            
            console.log('Password update successful:', response.data);
            
            setMessage({ text: 'Password updated successfully!', isError: false });
            // Reset password fields
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            console.error('Error updating password:', error);
            if (error.response && error.response.status === 401) {
                setMessage({ text: 'Authentication expired. Please login again.', isError: true });
                setTimeout(() => navigate('/login'), 2000);
            } else if (error.response) {
                console.error('Error response data:', error.response.data);
                let errorMsg = 'An error occurred while updating your password.';
                
                // Handle different error response formats
                if (typeof error.response.data === 'object') {
                    if (error.response.data.current_password) {
                        errorMsg = Array.isArray(error.response.data.current_password) 
                            ? error.response.data.current_password[0] 
                            : error.response.data.current_password;
                    } else if (error.response.data.password) {
                        errorMsg = Array.isArray(error.response.data.password)
                            ? error.response.data.password[0]
                            : error.response.data.password;
                    } else if (error.response.data.password_confirm) {
                        errorMsg = Array.isArray(error.response.data.password_confirm)
                            ? error.response.data.password_confirm[0]
                            : error.response.data.password_confirm;
                    } else if (error.response.data.username) {
                        errorMsg = Array.isArray(error.response.data.username)
                            ? error.response.data.username[0]
                            : error.response.data.username;
                    } else if (error.response.data.detail) {
                        errorMsg = error.response.data.detail;
                    } else if (error.response.data.error) {
                        errorMsg = error.response.data.error;
                    } else if (error.response.data.non_field_errors) {
                        errorMsg = Array.isArray(error.response.data.non_field_errors)
                            ? error.response.data.non_field_errors[0]
                            : error.response.data.non_field_errors;
                    }
                } else if (typeof error.response.data === 'string') {
                    errorMsg = error.response.data;
                }
                
                setMessage({ text: errorMsg, isError: true });
            } else {
                setMessage({ 
                    text: 'Network error occurred. Please check your connection and try again.', 
                    isError: true 
                });
            }
        } finally {
            setLoading(false);
        }
    };

    // Toggle password visibility handlers
    const togglePasswordVisibility = (field) => {
        switch(field) {
            case 'current':
                setShowCurrentPassword(!showCurrentPassword);
                break;
            case 'new':
                setShowNewPassword(!showNewPassword);
                break;
            case 'confirm':
                setShowConfirmPassword(!showConfirmPassword);
                break;
            default:
                break;
        }
    };

    // Mouse down/up handlers for eye icon
    const handleMouseDown = (field) => {
        switch(field) {
            case 'current':
                setShowCurrentPassword(true);
                break;
            case 'new':
                setShowNewPassword(true);
                break;
            case 'confirm':
                setShowConfirmPassword(true);
                break;
            default:
                break;
        }
    };

    const handleMouseUp = (field) => {
        switch(field) {
            case 'current':
                setShowCurrentPassword(false);
                break;
            case 'new':
                setShowNewPassword(false);
                break;
            case 'confirm':
                setShowConfirmPassword(false);
                break;
            default:
                break;
        }
    };

    return (
        <div className="about-container">
            <div className="about-header">
                <button 
                    onClick={() => navigate(-1)} 
                    className="back-button"
                    data-tooltip="Go Back"
                >
                    <FaArrowLeft />
                </button>
                <div className="about-title-container">
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3px' }}>
                        <FaRobot style={{ fontSize: '28px', color: '#4285f4', marginRight: '12px' }} />
                        <FaAws style={{ fontSize: '28px', color: '#ff9900' }} />
                    </div>
                    <h2>Change Account Information</h2>
                </div>
                <div className="right-placeholder"></div>
            </div>

            <div className="about-content">
                <div className="about-section">
                    <div className="account-tabs">
                        <button 
                            className={`account-tab ${activeTab === 'username' ? 'active' : ''}`}
                            onClick={() => setActiveTab('username')}
                        >
                            <FaUser /> Change Username
                        </button>
                        <button 
                            className={`account-tab ${activeTab === 'password' ? 'active' : ''}`}
                            onClick={() => setActiveTab('password')}
                        >
                            <FaKey /> Change Password
                        </button>
                    </div>

                    {message.text && (
                        <div className={`message ${message.isError ? 'error' : 'success'}`}>
                            {message.text}
                        </div>
                    )}

                    {activeTab === 'username' ? (
                        <form onSubmit={handleUsernameUpdate} className="account-form">
                            <div className="form-group">
                                <label htmlFor="username">Username</label>
                                <input
                                    type="text"
                                    id="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                            </div>
                            <button type="submit" className="account-button aws-button" disabled={loading}>
                                {loading ? <LoadingIndicator /> : <><FaSave /> Update Username</>}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handlePasswordUpdate} className="account-form">
                            <div className="form-group">
                                <label htmlFor="currentPassword">Current Password</label>
                                <div className="password-input-container">
                                    <input
                                        type={showCurrentPassword ? "text" : "password"}
                                        id="currentPassword"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        required
                                    />
                                    <div 
                                        className="password-toggle-icon"
                                        onMouseDown={() => handleMouseDown('current')}
                                        onMouseUp={() => handleMouseUp('current')}
                                        onMouseLeave={() => handleMouseUp('current')}
                                    >
                                        {showCurrentPassword ? <FaEye /> : <FaEyeSlash />}
                                    </div>
                                </div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="newPassword">New Password</label>
                                <div className="password-input-container">
                                    <input
                                        type={showNewPassword ? "text" : "password"}
                                        id="newPassword"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                    />
                                    <div 
                                        className="password-toggle-icon"
                                        onMouseDown={() => handleMouseDown('new')}
                                        onMouseUp={() => handleMouseUp('new')}
                                        onMouseLeave={() => handleMouseUp('new')}
                                    >
                                        {showNewPassword ? <FaEye /> : <FaEyeSlash />}
                                    </div>
                                </div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="confirmPassword">
                                    Confirm New Password
                                    {confirmPassword && (
                                        passwordsMatch ? 
                                            <span className="password-match-indicator match"><FaCheck /> Passwords match</span> : 
                                            <span className="password-match-indicator no-match"><FaTimes /> Passwords don't match</span>
                                    )}
                                </label>
                                <div className="password-input-container">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        id="confirmPassword"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        className={confirmPassword && !passwordsMatch ? "error-input" : ""}
                                    />
                                    <div 
                                        className="password-toggle-icon"
                                        onMouseDown={() => handleMouseDown('confirm')}
                                        onMouseUp={() => handleMouseUp('confirm')}
                                        onMouseLeave={() => handleMouseUp('confirm')}
                                    >
                                        {showConfirmPassword ? <FaEye /> : <FaEyeSlash />}
                                    </div>
                                </div>
                            </div>
                            <div className="password-requirements">
                                <p>Password must:</p>
                                <ul>
                                    <li>Be at least 8 characters long</li>
                                    <li>Not be too common</li>
                                    <li>Not be entirely numeric</li>
                                </ul>
                            </div>
                            <button 
                                type="submit" 
                                className="account-button aws-button" 
                                disabled={loading || (confirmPassword && !passwordsMatch)}
                            >
                                {loading ? <LoadingIndicator /> : <><FaSave /> Update Password</>}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AccountInfo; 