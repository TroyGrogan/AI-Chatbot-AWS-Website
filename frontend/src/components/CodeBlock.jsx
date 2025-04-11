import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FaCopy, FaCheck } from 'react-icons/fa';
import '../styles/CodeBlock.css';

// Map of common languages for better display names
const LANGUAGE_DISPLAY_NAMES = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  jsx: 'React JSX',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'React TSX',
  py: 'Python',
  python: 'Python',
  rb: 'Ruby',
  ruby: 'Ruby',
  java: 'Java',
  cpp: 'C++',
  c: 'C',
  cs: 'C#',
  csharp: 'C#',
  php: 'PHP',
  go: 'Go',
  rust: 'Rust',
  swift: 'Swift',
  kotlin: 'Kotlin',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sql: 'SQL',
  bash: 'Bash',
  sh: 'Shell',
  shell: 'Shell',
  yaml: 'YAML',
  yml: 'YAML',
  json: 'JSON',
  xml: 'XML',
  plaintext: 'Plain Text',
  txt: 'Plain Text',
  markdown: 'Markdown',
  md: 'Markdown'
};

// Languages supported by Prism
const SUPPORTED_LANGUAGES = [
  'javascript', 'jsx', 'typescript', 'tsx', 'python', 'java', 'ruby', 'c', 'cpp', 'csharp',
  'php', 'go', 'rust', 'swift', 'kotlin', 'html', 'css', 'scss', 'sql', 'bash', 'shell',
  'yaml', 'json', 'xml', 'markdown'
];

const CodeBlock = ({ node, inline, className, children, ...props }) => {
    const [isCopied, setIsCopied] = useState(false);
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : 'text'; // Default to 'text' if no language is specified
    const codeString = String(children).replace(/\n$/, ''); // Trim trailing newline

    const handleCopy = () => {
        navigator.clipboard.writeText(codeString).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000); // Reset icon after 2 seconds
        }, (err) => {
            console.error('Failed to copy code: ', err);
            // Optionally show an error message to the user
        });
    };

    // For inline code, just render a simple <code> tag
    if (inline) {
        return <code className={className} {...props}>{children}</code>;
    }

    // For block code, render with SyntaxHighlighter and header
    return !inline && match ? (
        <div className="code-block-container">
            <div className="code-block-header">
                <span className="language-name">{language}</span>
                <button onClick={handleCopy} className="copy-button" aria-label="Copy code">
                    <span style={{ marginRight: '5px', color: '#ccc' }}>Copy</span>
                    {isCopied ? <FaCheck size="1em" /> : <FaCopy size="1em" />}
                    <span className="copy-tooltip">{isCopied ? 'Copied!' : 'Copy code'}</span>
                </button>
            </div>
            <SyntaxHighlighter
                style={vscDarkPlus} // Apply the VS Code dark+ theme style
                language={language}
                PreTag="div" // Use div instead of pre to avoid nesting issues
                showLineNumbers={true} // Enable line numbers
                wrapLines={true} // Wrap long lines
                wrapLongLines={true} // Wrap long lines even without spaces
                {...props}
            >
                {codeString}
            </SyntaxHighlighter>
        </div>
    ) : (
        // Fallback for code blocks without a language specified - use standard dark theme
        <div className="code-block-container">
            <div className="code-block-header">
                <span className="language-name">text</span> {/* Default language name */}
                <button onClick={handleCopy} className="copy-button" aria-label="Copy code">
                    <span style={{ marginRight: '5px', color: '#ccc' }}>Copy</span>
                    {isCopied ? <FaCheck size="1em" /> : <FaCopy size="1em" />}
                    <span className="copy-tooltip">{isCopied ? 'Copied!' : 'Copy code'}</span>
                </button>
            </div>
            {/* Render the code content inside a pre/code structure applying dark theme styles */}
            <pre style={{
                fontFamily: "'Consolas', 'Monaco', 'Andale Mono', 'Ubuntu Mono', monospace",
                fontSize: '0.9em',
                lineHeight: '1.5',
                backgroundColor: '#1e1e1e',
                color: '#d4d4d4',
                padding: '12px',
                margin: 0,
                overflow: 'auto',
                borderBottomLeftRadius: '6px',
                borderBottomRightRadius: '6px'
            }}>
                <code {...props}>
                    {String(children).replace(/\n$/, '')}
                </code>
            </pre>
        </div>
    );
};

export default CodeBlock; 