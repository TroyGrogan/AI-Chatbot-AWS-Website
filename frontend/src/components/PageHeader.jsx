import React from 'react';
import { FaRobot, FaAws } from 'react-icons/fa';
import '../styles/Implementation.css';

const PageHeader = ({ type, title }) => {
  // Define colors for each type
  const colors = {
    ai: '#4285f4', // Google blue
    aws: '#ff9900'  // AWS orange
  };
  
  // Get the color for the current type
  const color = colors[type] || 'inherit';
  
  return (
    <div className="page-header-content">
      {type === 'ai' ? (
        <>
          <FaRobot className="header-logo robot-icon" style={{ color }} />
          <span style={{ color }}>{title || 'AI Implementation'}</span>
        </>
      ) : type === 'aws' ? (
        <>
          <FaAws className="header-logo aws-icon" style={{ color }} />
          <span style={{ color }}>{title || 'AWS Implementation'}</span>
        </>
      ) : null}
    </div>
  );
};

export default PageHeader;