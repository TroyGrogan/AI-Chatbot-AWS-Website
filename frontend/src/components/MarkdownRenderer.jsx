import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock';
import 'katex/dist/katex.min.css';
import katex from 'katex';

const MarkdownRenderer = ({ content }) => {
  // Check if content is valid
  if (!content || typeof content !== 'string') {
    return <div className="markdown-content empty">No content</div>;
  }

  // Regex patterns for code blocks
  const fencedCodeBlockRegex = /```([\w-]*)\n([\s\S]*?)```/g;
  const indentedCodeBlockRegex = /(?:^|\n)( {4}|\t)(.+)(?:\n|$)/g;
  
  // Regex patterns for LaTeX math expressions
  const inlineMathRegex = /\$([^\$]+)\$/g;
  const blockMathRegex = /\$\$([^\$]+)\$\$/g;

  // Process and extract code blocks
  const placeholders = [];
  const mathPlaceholders = [];
  
  // First, handle block math expressions ($$...$$)
  let processedContent = content.replace(blockMathRegex, (match, formula) => {
    // console.log("Found block math:", match);
    const placeholder = `__BLOCK_MATH_${mathPlaceholders.length}__`;
    mathPlaceholders.push({ 
      type: 'block',
      formula: formula.trim()
    });
    return placeholder;
  });
  
  // Then handle inline math expressions ($...$)
  processedContent = processedContent.replace(inlineMathRegex, (match, formula) => {
    // Check if this is actually currency, not math (simple heuristic)
    if (/^\d+(\.\d{2})?$/.test(formula.trim())) {
      return match; // Leave currency as is
    }
    
    // Clean up LaTeX formulas for proper rendering
    let cleanFormula = formula.trim();
    
    // Add proper spacing for math operators if missing
    cleanFormula = cleanFormula.replace(/([0-9])([+\-])/g, '$1 $2');
    
    // Fix common LaTeX notation issues
    cleanFormula = cleanFormula
      .replace(/\^(\d+)/g, '^{$1}')           // Convert x^2 to x^{2} for better rendering
      .replace(/\\frac([^{])/g, '\\frac{$1}')  // Fix fractions without braces
      .replace(/\\\(/g, '(')                  // Replace \( with (
      .replace(/\\\)/g, ')');                 // Replace \) with )
        
    const placeholder = `__INLINE_MATH_${mathPlaceholders.length}__`;
    mathPlaceholders.push({ 
      type: 'inline',
      formula: cleanFormula
    });
    return placeholder;
  });

  // Handle fenced code blocks (```language\ncode```)
  let contentWithPlaceholders = processedContent.replace(fencedCodeBlockRegex, (match, language, code) => {
    const placeholder = `__CODE_BLOCK_${placeholders.length}__`;
    placeholders.push({ 
      language: language.trim() || 'plaintext', 
      code: code.trim(), 
      type: 'fenced' 
    });
    return placeholder;
  });
  
  // Then handle indented code blocks (lines starting with 4 spaces or tabs)
  // Skip this if we're inside a list or other structure where indentation has meaning
  if (!contentWithPlaceholders.includes('- ') && !contentWithPlaceholders.includes('* ')) {
    contentWithPlaceholders = contentWithPlaceholders.replace(indentedCodeBlockRegex, (match, indent, code) => {
      // Only convert to code blocks if there are consecutive indented lines
      if (match.split('\n').length > 1) {
        const placeholder = `__CODE_BLOCK_${placeholders.length}__`;
        placeholders.push({ 
          language: 'plaintext', 
          code: code.trim(), 
          type: 'indented' 
        });
        return placeholder;
      }
      return match; // Leave single indented lines as they are
    });
  }
  
  // Split by placeholders but keep them in the result
  const parts = contentWithPlaceholders.split(/(__CODE_BLOCK_\d+__|__INLINE_MATH_\d+__|__BLOCK_MATH_\d+__)/g);

  // Create refs for math elements
  const mathRefs = useRef([]);
  
  // Use effect to render KaTeX after component mounts or updates
  useEffect(() => {
    // Reset refs array if needed
    if (mathRefs.current.length !== mathPlaceholders.length) {
      mathRefs.current = Array(mathPlaceholders.length).fill().map(() => React.createRef());
      // console.log(`Created ${mathPlaceholders.length} refs for math elements`);
    }
    
    // Render math expressions using KaTeX directly
    mathPlaceholders.forEach((mathItem, index) => {
      const el = mathRefs.current[index]?.current;
      if (!el) {
        // console.log(`Error: No ref element for math ${index}`);
        return;
      }
      
      try {
        // console.log(`Rendering math: ${mathItem.formula} (${mathItem.type})`);
        katex.render(mathItem.formula, el, {
          displayMode: mathItem.type === 'block',
          throwOnError: false,
          output: 'html'
        });
        // console.log(`Successfully rendered math formula ${index}`);
      } catch (error) {
        console.error(`Error rendering KaTeX (${mathItem.type}):`, error.message);
        console.error(`Formula was: "${mathItem.formula}"`);
        el.textContent = mathItem.type === 'block' 
          ? `$$${mathItem.formula}$$` 
          : `$${mathItem.formula}$`;
      }
    });
  }, [content, mathPlaceholders]); // Rerun effect if content or placeholders change

  return (
    <div className="markdown-content">
      {parts.map((part, index) => {
        // Check if this part is a code block placeholder
        const codeBlockMatch = part.match(/__CODE_BLOCK_(\d+)__/);
        
        // Check if this part is a math expression placeholder
        const inlineMathMatch = part.match(/__INLINE_MATH_(\d+)__/);
        const blockMathMatch = part.match(/__BLOCK_MATH_(\d+)__/);
        
        if (codeBlockMatch) {
          const blockIndex = parseInt(codeBlockMatch[1], 10);
          // Check if the index is valid
          if (blockIndex < placeholders.length) {
            const { language, code } = placeholders[blockIndex];
            return <CodeBlock key={`code-${index}`} language={language} code={code} />;
          }
          // Fallback if placeholder index is out of bounds
          return <p key={`invalid-${index}`}>{part}</p>;
        }
        
        if (inlineMathMatch) {
          const mathIndex = parseInt(inlineMathMatch[1], 10);
          if (mathIndex < mathPlaceholders.length) {
            // Ensure ref exists before rendering
            const ref = mathRefs.current[mathIndex] || (mathRefs.current[mathIndex] = React.createRef());
            return (
              <span 
                key={`inline-math-${index}`} 
                className="inline-math"
                style={{ display: 'inline-block', padding: '0 2px' }}
                ref={ref}
              />
            );
          }
          return <span key={`invalid-math-${index}`}>{part}</span>;
        }
        
        if (blockMathMatch) {
          const mathIndex = parseInt(blockMathMatch[1], 10);
          if (mathIndex < mathPlaceholders.length) {
            // Ensure ref exists before rendering
            const ref = mathRefs.current[mathIndex] || (mathRefs.current[mathIndex] = React.createRef());
            return (
              <div 
                key={`block-math-${index}`} 
                className="math-block"
                style={{ display: 'flex', justifyContent: 'center', width: '100%', padding: '0.5rem 0' }}
                ref={ref}
              />
            );
          }
          return <div key={`invalid-block-math-${index}`}>{part}</div>;
        }
        
        // Skip rendering empty parts or parts consisting only of whitespace
        if (!part || !part.trim()) {
          // Keep line breaks that resulted from splitting placeholders
          if (part && part.includes('\n')){
              return part.split('\n').map((line, lineIndex) => (
                  line ? <span key={`line-${index}-${lineIndex}`}>{line}</span> : <br key={`br-${index}-${lineIndex}`} />
              ));
          }
          return null;
        }
        
        // Render remaining parts as markdown
        return (
          <ReactMarkdown
            key={`md-${index}`}
            rehypePlugins={[rehypeSanitize]} 
            remarkPlugins={[remarkGfm]}
            components={{
              // Style headers
              h1: ({ node, ...props }) => <h1 style={{ borderBottom: '1px solid #eaecef', paddingBottom: '0.3em' }} {...props} />,
              h2: ({ node, ...props }) => <h2 style={{ borderBottom: '1px solid #eaecef', paddingBottom: '0.3em' }} {...props} />,
              h3: ({ node, ...props }) => <h3 style={{ fontWeight: 600 }} {...props} />,
              h4: ({ node, ...props }) => <h4 style={{ fontWeight: 600 }} {...props} />,
              
              // Style lists
              ul: ({ node, ...props }) => <ul style={{ paddingLeft: '2em' }} {...props} />,
              ol: ({ node, ...props }) => <ol style={{ paddingLeft: '2em' }} {...props} />,
              
              // Style list items
              li: ({ node, ...props }) => <li style={{ margin: '0.25em 0' }} {...props} />,
              
              // Style links
              a: ({ node, ...props }) => <a style={{ color: '#0366d6', textDecoration: 'none' }} {...props} />,
              
              // Style blockquotes
              blockquote: ({ node, ...props }) => (
                <blockquote
                  style={{
                    borderLeft: '3px solid #dfe2e5',
                    paddingLeft: '1em',
                    color: '#6a737d',
                    margin: '1em 0',
                    marginLeft: 0
                  }}
                  {...props}
                />
              ),
              
              // Style inline code (not code blocks)
              code: ({ node, inline, ...props }) => {
                return inline ? (
                  <code
                    style={{
                      backgroundColor: 'rgba(27, 31, 35, 0.05)',
                      borderRadius: '3px',
                      padding: '0.2em 0.4em',
                      fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace',
                      fontSize: '85%'
                    }}
                    {...props}
                  />
                ) : null; // Code blocks handled separately
              },
              
              // Style paragraphs
              p: ({ node, ...props }) => <p style={{ margin: '0.5em 0' }} {...props} />,
              
              // Style tables
              table: ({ node, ...props }) => (
                <table
                  style={{
                    borderCollapse: 'collapse',
                    width: 'auto',
                    maxWidth: '100%',
                    margin: '1em 0'
                  }}
                  {...props}
                />
              ),
              th: ({ node, ...props }) => (
                <th
                  style={{
                    border: '1px solid #dfe2e5',
                    padding: '6px 13px',
                    fontWeight: 600
                  }}
                  {...props}
                />
              ),
              td: ({ node, ...props }) => (
                <td
                  style={{
                    border: '1px solid #dfe2e5',
                    padding: '6px 13px'
                  }}
                  {...props}
                />
              ),
              tr: ({ node, ...props }) => (
                <tr
                  style={{ borderTop: '1px solid #c6cbd1' }}
                  {...props}
                />
              ),
            }}
          >
            {part}
          </ReactMarkdown>
        );
      })}
    </div>
  );
};

export default MarkdownRenderer; 