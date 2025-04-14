import os
import sys
# from api.llm_handler import LlamaModel, generate_response
from api.llm_handler_NONAWS import LlamaModel, generate_response

def test_model_initialization():
    """Test that the model initializes correctly"""
    try:
        print("Testing model initialization...")
        model = LlamaModel()
        model.initialize_model()
        print("Model initialized successfully!")
        return True
    except Exception as e:
        print(f"Error initializing model: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_response_generation():
    """Test generating a response with the model"""
    try:
        print("\nTesting response generation...")
        user_input = "What is the capital of France?"
        response = generate_response(user_input, "test-session")
        print(f"User: {user_input}")
        print(f"AI: {response}")
        return True
    except Exception as e:
        print(f"Error generating response: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_context_handling():
    """Test handling conversation context"""
    try:
        print("\nTesting context handling...")
        session_id = "context-test-session"
        
        # First message
        response1 = generate_response("My name is John. What's your name?", session_id)
        print(f"User: My name is John. What's your name?")
        print(f"AI: {response1}")
        
        # Second message that references the first
        response2 = generate_response("Do you remember my name?", session_id)
        print(f"User: Do you remember my name?")
        print(f"AI: {response2}")
        
        return True
    except Exception as e:
        print(f"Error testing context: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=== MODEL TESTING SCRIPT ===")
    
    # Setup Django environment
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    import django
    django.setup()
    
    # Run tests
    init_success = test_model_initialization()
    
    if init_success:
        resp_success = test_response_generation()
        ctx_success = test_context_handling()
        
        if resp_success and ctx_success:
            print("\nALL TESTS PASSED!")
            sys.exit(0)
        else:
            print("\nSOME TESTS FAILED!")
            sys.exit(1)
    else:
        print("\nMODEL INITIALIZATION FAILED!")
        sys.exit(1) 