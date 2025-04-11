import Form from "../components/Form"
import { Link } from "react-router-dom"
import { FaRobot, FaAws, FaArrowLeft } from 'react-icons/fa';

function SignUp() {
    // Create icons element to pass to Form with exact same styling as landing page
    const icons = (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3px' }}>
            <FaRobot style={{ fontSize: '28px', color: '#4285f4', marginRight: '12px' }} />
            <FaAws style={{ fontSize: '28px', color: '#ff9900' }} />
        </div>
    );
    
    return (
        <div style={{ position: 'relative' }}>
            <Link to="/" style={{ 
                position: 'absolute', 
                top: '20px', 
                left: '20px', 
                color: '#555', 
                fontSize: '20px',
                textDecoration: 'none',
                transition: 'color 0.2s ease-in-out'
            }} className="back-button" data-tooltip="Go Back">
                <FaArrowLeft />
            </Link>
            <Form 
                route="/api/user/register/" 
                method="signup" 
                icons={icons}
            />
        </div>
    );
}

export default SignUp;