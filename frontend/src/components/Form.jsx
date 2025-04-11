import { useState, useEffect } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "../constants";
import "../styles/Form.css";
import LoadingIndicator from "./LoadingIndicator";
import { FaEye, FaEyeSlash } from "react-icons/fa";

function Form({ route, method, redirectTo = "/chat", icons }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    
    // Password validation states for signup
    const [passwordErrors, setPasswordErrors] = useState([]);
    const [validations, setValidations] = useState({
        length: false,
        notCommon: true, // Can't validate common passwords on frontend
        notNumeric: false
    });

    const name = method === "login" ? "Login" : method === "signup" ? "Sign Up" : "Register";
    
    // Validate password when it changes (only for signup)
    useEffect(() => {
        if (method === "signup" && password) {
            const errors = [];
            
            // Check length
            const isLongEnough = password.length >= 8;
            if (!isLongEnough) {
                errors.push("Password must be at least 8 characters long");
            }
            
            // Check if entirely numeric
            const isNumeric = /^\d+$/.test(password);
            if (isNumeric) {
                errors.push("Password cannot be entirely numeric");
            }
            
            setValidations({
                length: isLongEnough,
                notNumeric: !isNumeric,
                notCommon: true // Set to true by default as we can't validate on frontend
            });
            
            setPasswordErrors(errors);
        }
    }, [password, method]);

    const handleSubmit = async (e) => {
        setLoading(true);
        setErrorMessage("");
        e.preventDefault();
        
        // Additional validation for signup
        if (method === "signup") {
            // Validate password requirements
            if (passwordErrors.length > 0) {
                setErrorMessage(passwordErrors[0]);
                setLoading(false);
                return;
            }
            
            // Validate password length
            if (password.length < 8) {
                setErrorMessage("Password must be at least 8 characters long");
                setLoading(false);
                return;
            }
            
            // Validate password is not entirely numeric
            if (/^\d+$/.test(password)) {
                setErrorMessage("Password cannot be entirely numeric");
                setLoading(false);
                return;
            }
        }

        try {
            const res = await api.post(route, { username, password });
            if (method === "login") {
                localStorage.setItem(ACCESS_TOKEN, res.data.access);
                localStorage.setItem(REFRESH_TOKEN, res.data.refresh);
                navigate(redirectTo);
            } else {
                navigate("/login");
            }
        } catch (error) {
            console.error("Form submission error:", error);
            
            // Check for 400 status code (Bad Request)
            if (error.response && error.response.status === 400) {
                if (method === "signup") {
                    if (error.response.data?.username) {
                        setErrorMessage("Username is already taken! Please pick another username.");
                    } else if (error.response.data?.password) {
                        setErrorMessage(typeof error.response.data.password === 'string' 
                            ? error.response.data.password 
                            : error.response.data.password[0]);
                    } else {
                        setErrorMessage("Username is already taken! Please pick another username.");
                    }
                } else {
                    setErrorMessage(error.response.data?.detail || "Invalid credentials. Please try again.");
                }
            } else {
                setErrorMessage(error.message || "An error occurred. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };
    
    // Mouse down/up handlers for eye icon
    const handleMouseDown = () => {
        setShowPassword(true);
    };

    const handleMouseUp = () => {
        setShowPassword(false);
    };

    return (
        <form onSubmit={handleSubmit} className="form-container">
            {icons && <div className="form-icons">{icons}</div>}
            <h1 style={{ margin: '0 0 15px 0' }}>{name}</h1>
            
            {errorMessage && (
                <div style={{ 
                    color: '#e74c3c',
                    marginBottom: '15px',
                    backgroundColor: '#fdecea',
                    padding: '10px',
                    borderRadius: '4px',
                    width: '100%',
                    textAlign: 'center'
                }}>
                    {errorMessage}
                </div>
            )}
            
            <input
                className="form-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
            />
            
            <div className="password-input-container">
                <input
                    className="form-input"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                />
                <div 
                    className="password-toggle-icon"
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {showPassword ? <FaEye /> : <FaEyeSlash />}
                </div>
            </div>
            
            {/* Password requirements (only for signup) */}
            {method === "signup" && (
                <div className="password-requirements">
                    <p>Password must:</p>
                    <ul>
                        <li>Be at least 8 characters long</li>
                        <li>Not be entirely numeric</li>
                        <li>Not be too common</li>
                    </ul>
                </div>
            )}
            
            {loading && <LoadingIndicator />}
            <button className="form-button" type="submit">
                {name}
            </button>
        </form>
    );
}

export default Form;