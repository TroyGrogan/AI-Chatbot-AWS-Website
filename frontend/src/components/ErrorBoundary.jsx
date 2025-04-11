import React, { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can log the error to an error reporting service
    console.error("React ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    // Attempt to recover by resetting the error state
    this.setState({ hasError: false, error: null, errorInfo: null });
  }

  handleReload = () => {
    // Force a full page reload
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div style={{
          padding: '20px',
          margin: '30px auto',
          maxWidth: '600px',
          backgroundColor: '#fff5f5',
          border: '1px solid #e53e3e',
          borderRadius: '8px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#e53e3e' }}>Something went wrong</h2>
          <p>The application encountered an unexpected error. Please try again.</p>
          
          <div style={{ margin: '20px 0', display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <button 
              onClick={this.handleReset}
              style={{
                padding: '8px 16px',
                backgroundColor: '#fff',
                color: '#333',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Try Again
            </button>
            <button 
              onClick={this.handleReload}
              style={{
                padding: '8px 16px',
                backgroundColor: '#4285f4',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Reload Page
            </button>
          </div>
          
          {process.env.NODE_ENV === 'development' && (
            <details style={{ 
              marginTop: '20px', 
              textAlign: 'left',
              padding: '10px',
              backgroundColor: '#f8f8f8',
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              <summary style={{ fontWeight: 'bold', cursor: 'pointer' }}>Error Details</summary>
              <pre style={{ 
                overflowX: 'auto', 
                whiteSpace: 'pre-wrap',
                padding: '10px',
                color: '#e53e3e' 
              }}>
                {this.state.error && this.state.error.toString()}
                <br />
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary; 