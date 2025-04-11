import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Chat from "./components/Chat";
import ChatHistory from "./components/ChatHistory";
import About from "./components/About";
import AIImplementation from "./components/AIImplementation";
import AWSImplementation from "./components/AWSImplementation";
import AccountInfo from "./components/AccountInfo";
import DeleteAccount from "./components/DeleteAccount";
import Home from "./pages/Home";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing"; // Keep the Landing component for unauthenticated users
// import PageHeader from "./components/PageHeader";
import ErrorBoundary from "./components/ErrorBoundary"; // Import ErrorBoundary

// ScrollToTop component to handle scrolling to top on page navigation
function ScrollToTop() {
  const { pathname } = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  
  return null;
}

function Logout() {
  localStorage.clear();
  return <Navigate to="/" />; // Redirect to Landing page after logout
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Unauthenticated landing page */}
          <Route path="/" element={<Landing />} />

          {/* Authentication routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/logout" element={<Logout />} />

          {/* Protected routes for authenticated users */}
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <Chat />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat/:id"
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <Chat />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat-history"
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <ChatHistory />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/about"
            element={
              <ProtectedRoute>
                <About />
              </ProtectedRoute>
            }
          />
          <Route
            path="/about/ai-implementation"
            element={
              <ProtectedRoute>
                <AIImplementation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/about/aws-implementation"
            element={
              <ProtectedRoute>
                <AWSImplementation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account-info"
            element={
              <ProtectedRoute>
                <AccountInfo />
              </ProtectedRoute>
            }
          />
          <Route
            path="/delete-account"
            element={
              <ProtectedRoute>
                <DeleteAccount />
              </ProtectedRoute>
            }
          />

          {/* Not Found route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;