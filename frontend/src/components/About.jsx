import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaRobot, FaAws } from 'react-icons/fa';
import '../styles/About.css';

// Import ReactMarkdown and plugins for rendering math examples
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css'; // Import KaTeX CSS
import '../styles/Math.css'; // Import your Math styles if needed for examples

// Import CodeBlock for rendering code examples
import CodeBlock from './CodeBlock';
import '../styles/CodeBlock.css'; // Import CodeBlock styles

const About = () => {
    const navigate = useNavigate();

    // Ensure the page is scrolled to top when component mounts
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Sample code snippets for demonstration
    const pythonCode = `import os

def greet(name):
    """Greets the user."""
    print(f"Hello, {name}!")

if __name__ == "__main__":
    user_name = os.getenv("USER", "World")
    greet(user_name)`;

    const javascriptCode = `import React from 'react';

function HelloWorld({ name }) {
  // Simple React component
  return (
    <div className="greeting">
      <h1>Hello, {name || 'World'}!</h1>
      <p>Welcome to the example.</p>
    </div>
  );
}

export default HelloWorld;`;

    return (
        <div className="about-container">
            <div className="about-header">
                <button 
                    onClick={() => navigate('/chat')} 
                    className="back-button"
                    data-tooltip="Go Back"
                >
                    <FaArrowLeft className="header-icon" />
                </button>
                <div className="about-title-container">
                    <h2>About The App</h2>
                </div>
                <div className="right-placeholder"></div>
            </div>

            <div className="about-content">
                <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    width: '100%', 
                    textAlign: 'center',
                    marginBottom: '25px'
                }}>
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        marginBottom: '15px',
                        marginTop: '0px'
                    }}>
                        <FaRobot style={{ fontSize: '24px', color: '#4285f4', marginRight: '10px' }} />
                        <FaAws style={{ fontSize: '24px', color: '#ff9900' }} />
                    </div>
                    <h3 className="about-creator" style={{ 
                        textAlign: 'center', 
                        margin: '0 auto', 
                        width: '100%', 
                        padding: '0'
                    }}>
                        AI Chatbot AWS Website Created And Developed By:
                    </h3>
                    <p className="creator-name" style={{ 
                        textAlign: 'center',
                        width: 'auto',
                        display: 'inline-block',
                        margin: '8px 0 0 0',
                        padding: '0',
                        fontWeight: 'bold',
                        fontSize: '1.3rem'
                    }}>
                        <a 
                            href="https://github.com/TroyGrogan/AI-Chatbot-AWS-Website" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="creator-link"
                            style={{ textDecoration: 'none' }} // Prevent default underline
                        >
                            <span style={{ color: '#007bff' }}>Troy</span> <span style={{ color: '#ff9900' }}>Grogan</span>
                        </a>
                    </p>
                </div>

                <section className="about-section">
                    <h3>App Description:</h3>
                    <ul>
                        <li>This app uses <a href="https://www.python.org/" target="_blank" rel="noopener noreferrer">Python</a> and <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript" target="_blank" rel="noopener noreferrer">JavaScript</a> to create a simple AI Chatbot Website.</li>
                        <li>The AI model in use is a quantized version of the <a href="https://huggingface.co/TheBloke/openchat-3.5-0106-GGUF" target="_blank" rel="noopener noreferrer">"OpenChat 3.5-0106" model, made possible via "TheBloke"</a>.</li>
                        <li>This AI Chatbot Website was deployed through <a href="https://aws.amazon.com/" target="_blank" rel="noopener noreferrer">Amazon Web Services</a>.</li>
                        <li>Everything used to create this app was open-sourced.😊</li>
                    </ul>
                </section>

                <section className="about-section">
                    <h3>App Functionality:</h3>
                    <p>
                        On this website, the user is able to:
                    </p>
                    <ul>
                        <li>Create or Delete an account</li>
                        <li>Sign-in or Sign-out of their account</li>
                        <li>Chat with the conversational AI model (5 message limit)</li>
                        <li>Use Model Modes (💡GPT4 Correct & 🧮Math Correct)</li>
                        <li>Create a new Chat</li>
                        <li>View and Search Chat History</li>
                        <li>View the Chat's Timestamp and Date</li>
                        <li>Bookmark and Search Bookmarked Chats</li>
                    </ul>
                </section>

                <section className="about-section">
                    <h3>App Architecture:</h3>
                    <p>
                        This Full-Stack Web Application is done through:
                    </p>
                    <ul>
                        <li><a href="https://www.djangoproject.com/" target="_blank" rel="noopener noreferrer">Django</a> (Python) for the Backend</li>
                        <li><a href="https://react.dev/" target="_blank" rel="noopener noreferrer">React</a> (JavaScript) for the Frontend</li>
                        <li><a href="https://www.postgresql.org/" target="_blank" rel="noopener noreferrer">PostgreSQL</a> for Relational Database functionality</li>
                        <li><a href="https://www.codecademy.com/article/what-is-rest#:~:text=REST%2C%20or%20REpresentational%20State%20Transfer%2C%20is%20an%20architectural%20style%20for%20providing%20standards%20between%20computer%20systems%20on%20the%20web%2C%20making%20it%20easier%20for%20systems%20to%20communicate%20with%20each%20other." target="_blank" rel="noopener noreferrer">REST Architecture</a> for secure communication</li>
                        <li><a href="https://jwt.io/" target="_blank" rel="noopener noreferrer">JSON Web Token</a> for User Authentication and Authorization</li>
                    </ul>

                    <p>
                        This web app uses Django's <a href="https://www.django-rest-framework.org/" target="_blank" rel="noopener noreferrer">Representational State Transfer (REST) API</a> framework for secure information transfer over the internet.
                    </p>
                    <p>
                        The web app's User Account Information handling and encryption is done through Django's REST API <a href="https://django-rest-framework-simplejwt.readthedocs.io/en/latest/" target="_blank" rel="noopener noreferrer">JSON Web Token (JWT) Authentication</a> framework.
                    </p>
                </section>

                <section className="about-section">
                    <h3>Technical Implementation:</h3>
                    <p>
                        The core AI logic resides in the backend <strong><code>llm_handler.py</code></strong> module. 
                        This module has sophisticated handling and allows for the application to provide context-aware, 
                        appropriately formatted responses while managing system resources effectively.
                        
                        This module employs several key design patterns and techniques to manage the large language model efficiently and reliably:
                    </p>
                    
                    <h4>Singleton Pattern for Model Loading:</h4>
                    <p>
                        The <code>LlamaModel</code> class utilizes the Singleton design pattern. This ensures that only <em>one</em> instance of the large language model (the resource-intensive OpenChat model) is loaded into the application's memory, regardless of how many requests are made. This approach significantly conserves RAM and prevents the costly overhead of loading the multi-gigabyte model multiple times.
                    </p>

                    <h4>Thread Safety during Initialization:</h4>
                    <p>
                        To prevent race conditions where multiple concurrent user requests might try to initialize the model simultaneously, a <code>threading.Lock</code> is used within the Singleton's creation logic (<code>__new__</code> method). This lock ensures that only one thread can initialize the model at a time, guaranteeing a stable and predictable loading process in a multi-threaded web server environment.
                    </p>

                    <h4>Dual Model Modes (GPT4 Correct & Math Correct):</h4>
                    <p>
                        The handler implements two distinct operational modes to tailor the AI's responses:
                    </p>
                    <ul style={{ listStyle: 'none', paddingLeft: '0' }}>
                        <li style={{ marginBottom: '10px' }}>
                            <strong>💡 Default Mode (GPT4 Correct):</strong>
                            <p style={{ marginTop: '5px', marginBottom: '5px', paddingLeft: '20px' }}>
                                The default mode is best for coding, general tasks, and for general conversation, aiming for helpful and contextually relevant answers.
                            </p>
                        </li>
                        <li>
                            <strong>🧮 Mathematical Reasoning Mode (Math Correct):</strong>
                            <p style={{ marginTop: '5px', marginBottom: '0px', paddingLeft: '20px' }}>
                                A specialized mode activated and tailored for solving mathematical queries. In this mode, the AI receives specific instructions to solve problems step-by-step and, crucially, to format all mathematical notation (like fractions, integrals, and matrices) using LaTeX for clear rendering in the frontend.
                            </p>
                        </li>
                        <li style={{ marginTop: '10px' }}>
                            <h4 style={{ marginBottom: '5px', marginTop: '0px' }}><span className="mode-icon auto-icon" style={{ marginRight: '8px', fontSize: '1.1em', verticalAlign: 'middle' }}>⟳</span> Automatic Mode Detection:</h4>
                            <p style={{ marginTop: '5px', marginBottom: '0px', paddingLeft: '20px' }}>
                                The system automatically determines whether a user's input requires the "Math Correct" mode using the <code>is_math_query</code> function. This function analyzes the input text for mathematical keywords (solve, integrate, calculate), symbols (+, -, ∫, √), equations, and common mathematical structures. If detected, the "Math Correct" mode is engaged; otherwise, it defaults to "GPT4 Correct". Users might also have an option to manually select the mode.
                            </p>
                        </li>
                    </ul>

                    <h4>Dynamic Prompt Construction:</h4>
                    <p>
                        The <code>build_prompt_with_history</code> function dynamically constructs the input prompt sent to the model. It prepends the appropriate system message based on the selected mode (including LaTeX instructions for Math mode), adds the relevant conversation history (tagging each user and assistant message with its mode), and appends the current user input. This structured prompt guides the AI to respond in the desired persona and format.
                    </p>

                    <h4>Context Window Management:</h4>
                    <p>
                        To work within the model's maximum context limit (e.g., 8192 tokens), the handler intelligently manages the conversation history for each chat session. Before generating a response, it estimates the token count of the potential prompt (<code>estimate_prompt_tokens</code>). If it exceeds the limit, the <code>trim_history_to_fit_context</code> function strategically removes older messages (prioritizing the removal of messages from the middle of the conversation) while preserving the initial context and the most recent exchanges, ensuring conversation continuity without overloading the model.
                    </p>

                    <h4>Tokenization:</h4>
                    <p>
                        The handler interfaces with the underlying <code>llama-cpp-python</code> library to tokenize text, enabling accurate tracking of token counts for context management.
                    </p>

                </section>

                <div className="about-section">
                    <h3>Math Rendering</h3>
                    <p>The app supports beautiful math rendering powered by <a href="https://katex.org" target="_blank" rel="noopener noreferrer">KaTeX</a>. Here are some examples:</p>
                    
                    <div className="math-example">
                        <h4>Calculus Example</h4>
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {`$$\\int (4x^6 - 2x^3 + 7x - 4)\\,dx = \\frac{4}{7}x^7 - \\frac{1}{2}x^4 + \\frac{7}{2}x^2 - 4x + C$$`}
                        </ReactMarkdown>
                    </div>
                    
                    <div className="math-example">
                        <h4>Algebra Example</h4>
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {`Solving the quadratic equation $ax^2 + bx + c = 0$ gives us the formula: $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$`}
                        </ReactMarkdown>
                    </div>
                    
                </div>

                <section className="about-section">
                    <h3>Code Block Rendering</h3>
                    <p>Code is beautifully rendered with syntax highlighting, language detection, line numbers, and a copy button, powered by <a href="https://github.com/react-syntax-highlighter/react-syntax-highlighter" target="_blank" rel="noopener noreferrer">react-syntax-highlighter</a>. Here are some examples:</p>
                    
                    <div className="code-example">
                        <h4>Python Example</h4>
                        {/* Use CodeBlock directly - pass language via className */}
                        <CodeBlock className="language-python" >
                            {pythonCode}
                        </CodeBlock>
                    </div>
                    
                    <div className="code-example">
                        <h4>JavaScript (React) Example</h4>
                        {/* Use CodeBlock directly - pass language via className */}
                        <CodeBlock className="language-javascript" >
                            {javascriptCode}
                        </CodeBlock>
                    </div>
                </section>

                <div className="implementation-buttons">
                    <button 
                        className="implementation-btn ai-btn"
                        onClick={() => navigate('/about/ai-implementation')}
                    >
                        <FaRobot /> Info On AI Implementation
                    </button>
                    <button 
                        className="implementation-btn aws-btn"
                        onClick={() => navigate('/about/aws-implementation')}
                    >
                        <FaAws /> Info On AWS Implementation
                    </button>
                </div>
            </div>
        </div>
    );
};

export default About;