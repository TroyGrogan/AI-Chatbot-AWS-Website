import { Link } from "react-router-dom";
import "../styles/Landing.css"; // Import the CSS
import { FaRobot, FaAws } from 'react-icons/fa'; // Import the icons

function Landing() {
  return (
    <div className="landing-container">
      <div className="landing-form">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3px' }}>
          <FaRobot style={{ fontSize: '28px', color: '#4285f4', marginRight: '12px' }} />
          <FaAws style={{ fontSize: '28px', color: '#ff9900' }} />
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 25px 0' }}>AI Chatbot AWS Website</h1>
        <div style={{ width: '100%' }}>
          <Link to="/signup" style={{ width: '100%', display: 'block' }}>
            <button style={{ width: '95%', fontSize: '16px', padding: '10px 0', marginBottom: '10px' }}>Sign Up</button>
          </Link>
          <Link to="/login" style={{ width: '100%', display: 'block' }}>
            <button style={{ width: '95%', fontSize: '16px', padding: '10px 0' }}>Log In</button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Landing;