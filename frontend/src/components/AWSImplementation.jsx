import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaAws, FaServer, FaDatabase, FaShieldAlt, FaNetworkWired, FaCloud } from 'react-icons/fa';
import '../styles/Implementation.css';
import PageHeader from './PageHeader';

const AWSImplementation = () => {
    const navigate = useNavigate();

    const handleBack = () => {
        navigate('/about');
    };

    // Ensure the page is scrolled to top when component mounts
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="implementation-container" data-type="aws">
            <div className="implementation-header">
                <button 
                    onClick={handleBack} 
                    className="back-button"
                    data-tooltip="Go Back"
                >
                    <FaArrowLeft className="header-icon" />
                </button>
                <div className="implementation-title-container">
                    <h2>
                        <PageHeader type="aws" />
                    </h2>
                </div>
                <div className="right-placeholder"></div>
            </div>

            <div className="implementation-content">
                <section className="implementation-section">
                    <h3><FaCloud className="header-icon aws-icon" /> Cloud Infrastructure:</h3>
                    <p>
                        This application is deployed on Amazon Web Services (AWS), utilizing a range of services 
                        to ensure reliability, scalability, and security.
                    </p>
                </section>

                <section className="implementation-section">
                    <h3><FaServer className="header-icon aws-icon" /> Compute Services:</h3>
                    <ul>
                        <li><strong>EC2 Instances:</strong> Used for hosting the Django backend application</li>
                        <li><strong>S3 Buckets:</strong> Static asset storage and React frontend hosting</li>
                        <li><strong>Lambda Functions:</strong> Serverless functionality for specific tasks</li>
                    </ul>
                </section>

                <section className="implementation-section">
                    <h3><FaDatabase className="header-icon aws-icon" /> Database Services:</h3>
                    <ul>
                        <li><strong>RDS (PostgreSQL):</strong> Relational database for storing user data, chat history, and application state</li>
                        <li><strong>ElastiCache:</strong> Caching layer for improved performance</li>
                    </ul>
                </section>

                <section className="implementation-section">
                    <h3><FaNetworkWired className="header-icon aws-icon" /> Networking:</h3>
                    <ul>
                        <li><strong>Virtual Private Cloud (VPC):</strong> Isolated network environment</li>
                        <li><strong>API Gateway:</strong> API management and request routing</li>
                        <li><strong>CloudFront:</strong> Content delivery network for fast global access</li>
                        <li><strong>Route 53:</strong> DNS management and routing</li>
                    </ul>
                </section>

                <section className="implementation-section">
                    <h3><FaShieldAlt className="header-icon aws-icon" /> Security:</h3>
                    <ul>
                        <li><strong>Identity and Access Management (IAM):</strong> Fine-grained access control</li>
                        <li><strong>SSL/TLS Encryption:</strong> Secure data transmission</li>
                        <li><strong>Security Groups:</strong> Firewall rules for EC2 instances</li>
                        <li><strong>AWS WAF:</strong> Web application firewall for protection against common web exploits</li>
                    </ul>
                </section>
            </div>
        </div>
    );
};

export default AWSImplementation; 