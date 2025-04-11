import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaExclamationTriangle, FaTrashAlt, FaRobot, FaAws } from 'react-icons/fa';
import '../styles/About.css'; // Reuse the about styles for consistency
import api from '../api';

const DeleteAccount = () => {
    const navigate = useNavigate();
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState('');
    const [showConfirmation, setShowConfirmation] = useState(false);

    const handleDeleteRequest = () => {
        setShowConfirmation(true);
    };

    const handleCancelDelete = () => {
        setShowConfirmation(false);
    };

    const handleConfirmDelete = async () => {
        setIsDeleting(true);
        setError('');
        
        try {
            await api.post('/api/user/delete-account/');
            
            // Clear tokens and local data
            localStorage.removeItem('access');
            localStorage.removeItem('refresh');
            
            // Redirect to login page
            navigate('/', { replace: true });
        } catch (error) {
            console.error('Failed to delete account:', error);
            setError(error.response?.data?.detail || 'Failed to delete account. Please try again.');
            setIsDeleting(false);
            setShowConfirmation(false);
        }
    };

    return (
        <div className="about-container">
            <div className="about-header">
                <button 
                    onClick={() => navigate(-1)} 
                    className="back-button"
                    data-tooltip="Go Back"
                    disabled={isDeleting}
                >
                    <FaArrowLeft />
                </button>
                
                <div className="about-title-container">
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3px' }}>
                        <FaRobot style={{ fontSize: '28px', color: '#4285f4', marginRight: '12px' }} />
                        <FaAws style={{ fontSize: '28px', color: '#ff9900' }} />
                    </div>
                    <h2 style={{ 
                        fontFamily: 'Times New Roman, serif', 
                        fontWeight: 'bold', 
                        fontSize: '28px',
                        color: '#000'
                    }}>Delete Account</h2>
                </div>
                
                <div className="right-placeholder"></div>
            </div>

            <div className="about-content" style={{ display: 'flex', justifyContent: 'center' }}>
                <div className="about-section" style={{ 
                    borderLeft: '3px solid #dc3545', 
                    maxWidth: '600px', 
                    width: '100%',
                    textAlign: 'center' 
                }}>
                    <h3 style={{ color: '#dc3545' }}>
                        <FaExclamationTriangle /> Warning: Account Deletion
                    </h3>
                    <p>Deleting your account is permanent and cannot be undone. All your data will be immediately removed, including:</p>
                    <ul style={{ display: 'inline-block', textAlign: 'left' }}>
                        <li>All chat history and messages</li>
                        <li>All bookmarked chats</li>
                        <li>Account settings and preferences</li>
                    </ul>
                    <p><strong>This action cannot be reversed.</strong></p>
                    
                    {error && (
                        <div className="error-message" style={{ 
                            backgroundColor: '#ffebee', 
                            color: '#c62828', 
                            padding: '10px', 
                            borderRadius: '4px',
                            marginBottom: '15px',
                            maxWidth: '400px',
                            margin: '0 auto 15px auto'
                        }}>
                            {error}
                        </div>
                    )}
                    
                    {!showConfirmation ? (
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <button 
                                onClick={handleDeleteRequest} 
                                className="delete-button"
                                disabled={isDeleting}
                                style={{
                                    backgroundColor: '#dc3545',
                                    color: 'white',
                                    border: 'none',
                                    padding: '10px 20px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <FaTrashAlt /> Delete My Account
                            </button>
                        </div>
                    ) : (
                        <div className="confirmation-dialog" style={{
                            border: '1px solid #dc3545',
                            borderRadius: '4px',
                            padding: '15px',
                            backgroundColor: '#ffebee',
                            maxWidth: '400px',
                            margin: '0 auto'
                        }}>
                            <p><strong>Are you absolutely sure?</strong></p>
                            <p>Once you delete your account, all of your data will be permanently removed and cannot be recovered.</p>
                            
                            <div style={{ display: 'flex', gap: '10px', marginTop: '15px', justifyContent: 'center' }}>
                                <button 
                                    onClick={handleCancelDelete}
                                    disabled={isDeleting}
                                    style={{
                                        backgroundColor: '#6c757d',
                                        color: 'white',
                                        border: 'none',
                                        padding: '8px 15px',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                
                                <button 
                                    onClick={handleConfirmDelete}
                                    disabled={isDeleting}
                                    style={{
                                        backgroundColor: '#dc3545',
                                        color: 'white',
                                        border: 'none',
                                        padding: '8px 15px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                    }}
                                >
                                    {isDeleting ? 'Deleting...' : (
                                        <>
                                            <FaTrashAlt /> Yes, Delete My Account
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DeleteAccount; 