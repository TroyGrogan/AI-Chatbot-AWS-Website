import threading
from django.conf import settings
import os
import sys
import traceback
import re
from llama_cpp import Llama

def format_math_response(text):
    """Adds $$ delimiters around VERY basic math patterns."""
    if not text: return ''

    lines = text.split('\n')
    processed_lines = []
    explanatory_prefixes = (
        "Applying", "Rule:", "Property:", "Note:", "Therefore", "where C is",
        "Combining all these integrals", "Now, we can integrate", "To solve this integral"
    )

    for line in lines:
        trimmed_line = line.strip()
        if not trimmed_line:
            processed_lines.append(line)
            continue

        # --- Extremely Simplified Check --- 
        is_likely_block_math = False
        # 1. Contains integral
        if '∫' in trimmed_line:
            is_likely_block_math = True
        # 2. Contains = AND doesn't start with explanatory words
        elif '=' in trimmed_line and not trimmed_line.startswith(explanatory_prefixes):
            is_likely_block_math = True
        # 3. Starts with ( and contains )x^ (like the final result format)
        elif trimmed_line.startswith('(') and ')x^' in trimmed_line:
             is_likely_block_math = True
        # --- End Simplified Check --- 

        already_delimited = trimmed_line.startswith('$') or trimmed_line.endswith('$')

        if is_likely_block_math and not already_delimited:
            print(f"[Backend] Wrapping line as block math (extreme simple): {trimmed_line}")
            processed_lines.append(f"$$${trimmed_line}$$$")
        else:
            processed_lines.append(line) # Keep original line

    result = '\n'.join(processed_lines)

    if result != text:
        print("[Backend] Formatted math response (extreme simple checks).")
    return result

class LlamaModel:
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(LlamaModel, cls).__new__(cls)
                # Initialize the conversation history dictionary
                cls._instance.conversation_history = {}
        return cls._instance

    def initialize_model(self):
        """Initialize the model if it hasn't been loaded yet"""
        if not hasattr(self, 'llm'):
            try:
                # Get the absolute path to the base directory (project root)
                base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                model_file = "TheBloke-openchat-3.5-0106.Q3_K_M.gguf"
                model_path = os.path.join(base_dir, "backend", "ai_model", model_file)
                
                print(f"Trying to load model from: {model_path}")
                print(f"Current working directory: {os.getcwd()}")
                
                if not os.path.exists(model_path):
                    # Try an alternative path
                    alternative_path = os.path.join(base_dir, "ai_model", model_file)
                    print(f"Model not found, trying alternative path: {alternative_path}")
                    
                    if os.path.exists(alternative_path):
                        model_path = alternative_path
                    else:
                        raise FileNotFoundError(f"Model file not found at {model_path} or {alternative_path}")
                
                # Verify the file size to ensure it's not corrupt
                file_size = os.path.getsize(model_path) / (1024 * 1024 * 1024)  # Convert to GB
                print(f"Model file found at {model_path}, size: {file_size:.2f} GB")
                
                # Initialize with a larger context size and more RAM efficient n_batch setting
                try:
                    print("Creating Llama instance with parameters:")
                    print(f"- model_path: {model_path}")
                    print(f"- n_threads: 8")
                    print(f"- n_ctx: 8192")  # Increased from 2048 to 8192 (maximum for OpenChat-3.5)
                    print(f"- n_batch: 512")
                    
                    self.llm = Llama(
                        model_path=model_path, 
                        n_threads=8,
                        n_ctx=8192,     # Maximum context window for OpenChat-3.5
                        n_batch=512,    # Efficient batch size for inference
                        verbose=True    # Enable verbose mode for debugging
                    )
                    
                    # Store the context window size for reference
                    self.context_size = 8192
                    # Reserve tokens for the model's response (adjust as needed)
                    self.max_response_tokens = 2000  # Increased from 1000
                    # Maximum allowed context for prompt (leave room for response)
                    self.max_prompt_tokens = self.context_size - self.max_response_tokens
                    
                    print(f"Model loaded successfully with context window of {self.context_size} tokens!")
                    return True
                except Exception as model_init_error:
                    print(f"Error during Llama model initialization: {str(model_init_error)}")
                    traceback.print_exc()
                    raise
            except Exception as e:
                print(f"Error initializing model: {str(e)}", file=sys.stderr)
                traceback.print_exc()
                # Don't set self.llm if there was an error
                raise

    def is_initialized(self):
        """Check if the model has been initialized"""
        initialized = hasattr(self, 'llm')
        print(f"Model initialized: {initialized}")
        return initialized
    
    def count_tokens(self, text):
        """Count the number of tokens in a text string"""
        try:
            if not self.is_initialized():
                self.initialize_model()
            
            # Use the model's tokenizer to count tokens
            tokens = self.llm.tokenize(text.encode('utf-8'))
            return len(tokens)
        except Exception as e:
            print(f"Error counting tokens: {str(e)}")
            traceback.print_exc()
            # Return a conservative estimate as fallback
            return len(text.split()) * 2  # Rough estimate
    
    def add_to_history(self, chat_session_id, role, content, mode=None):
        """
        Add a message to the conversation history for a specific chat session
        
        Args:
            chat_session_id (str): Identifier for the chat session
            role (str): "user" or "assistant"
            content (str): Message content
            mode (str, optional): "Math Correct" or "GPT4 Correct" mode used
        """
        try:
            if chat_session_id not in self.conversation_history:
                self.conversation_history[chat_session_id] = []
            
            # If mode not specified, determine based on content for user messages
            if mode is None and role == "user":
                mode = "Math Correct" if self.is_math_query(content) else "GPT4 Correct"
            elif mode is None:
                # For assistant messages without specified mode, try to match the last user message
                last_msgs = self.conversation_history.get(chat_session_id, [])
                user_msgs = [msg for msg in last_msgs if msg["role"] == "user"]
                if user_msgs and "mode" in user_msgs[-1]:
                    mode = user_msgs[-1]["mode"]
                else:
                    mode = "GPT4 Correct"  # Default
            
            # Add message with mode info
            self.conversation_history[chat_session_id].append({
                "role": role, 
                "content": content,
                "mode": mode
            })
            
            # Use a very high limit (200 messages = 100 exchanges) for initial storage
            # The actual trimming to fit context window happens in trim_history_to_fit_context
            # This is just a safeguard against memory issues from extremely long conversations
            if len(self.conversation_history[chat_session_id]) > 200:
                # Remove oldest messages, keeping the most recent ones
                self.conversation_history[chat_session_id] = self.conversation_history[chat_session_id][-200:]
            
            print(f"Added message to history. Session: {chat_session_id}, Role: {role}, Mode: {mode}, Content length: {len(content)}")
            print(f"Current history length: {len(self.conversation_history[chat_session_id])} messages")
        except Exception as e:
            print(f"Error adding to history: {str(e)}")
            traceback.print_exc()
    
    def get_conversation_history(self, chat_session_id):
        """Get the conversation history for a specific chat session"""
        try:
            history = self.conversation_history.get(chat_session_id, [])
            print(f"Retrieved history for session {chat_session_id}: {len(history)} messages")
            return history
        except Exception as e:
            print(f"Error getting conversation history: {str(e)}")
            traceback.print_exc()
            return []
    
    def estimate_prompt_tokens(self, history, current_input):
        """Estimate the number of tokens in the full prompt with history"""
        try:
            # Determine if this is a math query
            is_math = self.is_math_query(current_input)
            mode = "Math Correct" if is_math else "GPT4 Correct"
            
            # Start with system prompt appropriate to the mode
            if is_math:
                system_prompt = ("Math Correct Assistant: You are a specialized assistant for mathematical reasoning. "
                                 "Solve math problems step-by-step, showing your work clearly. "
                                 "**CRITICAL:** You MUST format matrices using LaTeX. "
                                 "Use the `bmatrix` environment for standard matrices (e.g., `\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}`). "
                                 "Use the `array` environment within `\\left[...\\right]` for augmented matrices (e.g., `\\left[\\begin{array}{cc|c} 1 & 2 & 3 \\\\ 4 & 5 & 6 \\end{array}\\right]`). "
                                 "**DO NOT use plain text brackets `[]` or pipes `|` to represent matrices.** "
                                 "Ensure ALL mathematical expressions (fractions, integrals, matrices, variables, etc.) are enclosed in appropriate LaTeX delimiters (`$` for inline, `$$` for display block)."
                                 "\\n\\n")
            else:
                system_prompt = ("GPT4 Correct Assistant: I am a helpful assistant. "
                                 "I maintain the context of our conversation and provide accurate, relevant responses.\\n\\n")
            
            token_count = self.count_tokens(system_prompt)
            
            # Count tokens in history with appropriate mode tags
            for message in history:
                if message["role"] == "user":
                    if is_math:
                        msg_text = f"Math Correct User: {message['content']}<|end_of_turn|>\n"
                    else:
                        msg_text = f"GPT4 Correct User: {message['content']}<|end_of_turn|>\n"
                else:
                    if is_math:
                        msg_text = f"Math Correct Assistant: {message['content']}<|end_of_turn|>\n"
                    else:
                        msg_text = f"GPT4 Correct Assistant: {message['content']}<|end_of_turn|>\n"
                token_count += self.count_tokens(msg_text)
            
            # Count current input with appropriate mode tag
            if is_math:
                current_msg = f"Math Correct User: {current_input}<|end_of_turn|>\nMath Correct Assistant:"
            else:
                current_msg = f"GPT4 Correct User: {current_input}<|end_of_turn|>\nGPT4 Correct Assistant:"
            
            token_count += self.count_tokens(current_msg)
            
            print(f"Estimated total tokens for prompt: {token_count} (using {mode} mode)")
            return token_count
        except Exception as e:
            print(f"Error estimating prompt tokens: {str(e)}")
            traceback.print_exc()
            # Return a conservative estimate
            return 1500  # A high estimate to trigger trimming
    
    def trim_history_to_fit_context(self, chat_session_id, current_input):
        """Trim conversation history to fit within context window"""
        try:
            history = self.get_conversation_history(chat_session_id)
            estimated_tokens = self.estimate_prompt_tokens(history, current_input)
            
            # If we're already within the limit, no need to trim - return the full history
            if estimated_tokens <= self.max_prompt_tokens:
                print(f"History fits within context window ({estimated_tokens}/{self.max_prompt_tokens} tokens) - no trimming needed")
                return history
            
            # We need to trim history to fit within context window
            print(f"History exceeds context window ({estimated_tokens}/{self.max_prompt_tokens} tokens). Starting trimming process.")
            
            # Strategy for maximizing context with the 8192 token window:
            # 1. Always keep the most recent exchanges (recency is crucial)
            # 2. Try to preserve the beginning of the conversation for context grounding
            # 3. If needed, remove messages from the middle first
            
            # If the history is very long, first do a bulk trim to speed up processing
            if len(history) > 60:  # Increased from 30 to 60
                # Keep more messages at the beginning and end with our larger context window
                preserved_start = min(10, len(history) // 5)  # First 10 messages or 20% of history
                preserved_end = 40  # Last 20 exchanges (40 messages)
                
                if len(history) > preserved_start + preserved_end:
                    # Remove messages from the middle
                    middle_removed = history[:preserved_start] + history[-preserved_end:]
                    print(f"Initial bulk trimming: {len(history)} → {len(middle_removed)} messages ({len(history) - len(middle_removed)} removed from middle)")
                    history = middle_removed
                    
                    # Recalculate token count after bulk trimming
                    estimated_tokens = self.estimate_prompt_tokens(history, current_input)
                    print(f"After bulk trimming: {estimated_tokens}/{self.max_prompt_tokens} tokens")
            
            # If still too large, remove older messages iteratively until we fit
            removal_count = 0
            while estimated_tokens > self.max_prompt_tokens and len(history) > 6:  # Keep at least 3 exchanges (6 messages)
                # Remove messages from the middle, preserving the first exchange and recent messages
                if len(history) >= 10:  # When we have at least 5 exchanges
                    # Keep first 2 messages (system + first user) and the most recent messages
                    removed = history[2:4]  # Remove the oldest pair after first exchange
                    history = history[:2] + history[4:]
                    removal_type = "middle"
                else:
                    # With fewer messages, start removing oldest messages after first exchange
                    removed = history[2]
                    history = history[:2] + history[3:]
                    removal_type = "single"
                
                removal_count += len(removed) if isinstance(removed, list) else 1
                
                # Recalculate token count
                estimated_tokens = self.estimate_prompt_tokens(history, current_input)
                
                # Log less frequently to reduce console spam
                if removal_count % 4 == 0:
                    print(f"Removed {removal_count} {removal_type} messages, current tokens: {estimated_tokens}/{self.max_prompt_tokens}")
            
            # Update the conversation history
            self.conversation_history[chat_session_id] = history
            
            # Final log with token counts and percentages
            token_percentage = (estimated_tokens / self.max_prompt_tokens) * 100
            print(f"Trimming complete: {len(history)} messages retained ({estimated_tokens} tokens, {token_percentage:.1f}% of available context)")
            print(f"Removed a total of {removal_count} messages to fit within context window")
            
            return history
        except Exception as e:
            print(f"Error trimming history: {str(e)}")
            traceback.print_exc()
            # Return a minimal history in case of error
            return history[-6:] if len(history) > 6 else history
    
    def is_math_query(self, text):
        """
        Detect if the user's query is a mathematical question that would benefit from the Math Correct mode.
        
        Args:
            text (str): The user's input text
            
        Returns:
            bool: True if the query appears to be a math problem, False otherwise
        """
        # Check for common math patterns
        math_patterns = [
            # Equations with = sign
            r'=\s*\?',  # "x + 5 = ?"
            r'\?\s*=',  # "? = x + 5"
            r'=\s*$',   # "10.3 − 7988.8133 = "
            
            # Explicit math equations
            r'[0-9]+\s*[\+\-\*\/\^÷×]\s*[0-9]+\s*=',  # "5 + 3 = "
            r'=\s*[0-9]+\s*[\+\-\*\/\^÷×]\s*[0-9]+',  # "= 5 + 3"
            
            # Explicit math operations
            r'[0-9]+\s*[\+\-\*\/\^÷×]\s*[0-9]+',  # Numbers with operations: "5 + 3", "10 * 4"
            
            # Math keywords
            r'\b(?:solve|calculate|compute|evaluate|simplify|factor|expand|derive|integrate|differentiate|find\s+the\s+value|what\s+is\s+the\s+value)\b',
            
            # Math symbols
            r'[\+\-\*\/\^÷×√∫∬∮∂∑∏π≠≤≥±]',
            
            # Common math terms
            r'\b(?:equation|polynomial|fraction|decimal|percentage|algebra|calculus|trigonometry|geometry|linear|quadratic|exponential|logarithm|matrix|vector)\b',
            
            # Numbers with mathematical context
            r'[0-9]+\s*(?:squared|cubed|factorial|raised to|times|divided by|plus|minus|over|root|percent|%)',
            
            # Asking about numerical results
            r'(?:what is|find|compute|calculate|determine)\s+[0-9\+\-\*\/\^]',
            
            # Number sequences and patterns
            r'(?:sequence|series|pattern|progression).*[0-9,\s]+',
            
            # Math functions
            r'\b(?:sin|cos|tan|log|ln|exp|sqrt|pow)\s*\(',
            
            # Common math variables
            r'\b[xyz]\s*=|\b[xyz]\s*\+|\b[xyz]\s*\-|\b[xyz]\s*\*|\b[xyz]\s*\/|\b[xyz]\s*\^',
            
            # Advanced math topics
            r'\b(?:eigenvalue|eigenvector|determinant|integral|derivative|limit|infinity|converge|diverge|probability|statistics)\b',
            
            # More complex patterns for step-by-step solving
            r'solve\s+step\s+by\s+step',
            r'show\s+(?:your|the)\s+work',
            r'how\s+to\s+solve'
        ]
        
        # Check if any pattern matches
        for pattern in math_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                print(f"Detected math query based on pattern: {pattern}")
                return True
                
        # Also check for significant number of digits and mathematical symbols as a percentage of the text
        digits = sum(c.isdigit() for c in text)
        math_symbols = sum(c in '+-*/^()[]{}=<>≠≤≥±πΔ∞∫∂∑∏' for c in text)
        text_len = max(1, len(text.strip()))  # Avoid division by zero
        
        # If text has significant mathematical content (>15% digits+math symbols), consider it a math query
        math_density = (digits + math_symbols) / text_len
        if math_density > 0.15:
            print(f"Detected math query based on symbol density: {math_density:.2f}")
            return True
            
        return False
    
    def build_prompt_with_history(self, chat_session_id, user_input):
        """Build a prompt that includes conversation history, ensuring it fits within context window"""
        try:
            # Determine mode and system prompt based on the LATEST user input
            is_math = self.is_math_query(user_input)
            mode = "Math Correct" if is_math else "GPT4 Correct"
            
            # --> ADD FORMATTING INSTRUCTIONS <--
            formatting_instructions = "\nPlease format your response using Markdown. For any mathematical expressions or equations, enclose inline math with single dollar signs ($) and display/block math with double dollar signs ($$). For example: The result is $x=5$. The equation is $$E=mc^2$$.\n"

            if is_math:
                # Include more explicit instructions for math mode
                system_prompt = (
                    "Math Correct Assistant: You are a specialized assistant for mathematical reasoning. "
                    "Solve math problems step-by-step, showing your work clearly. "
                    "**CRITICAL:** You MUST format matrices using LaTeX. "
                    "Use the `bmatrix` environment for standard matrices (e.g., `\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}`). "
                    "Use the `array` environment within `\\left[...\\right]` for augmented matrices (e.g., `\\left[\\begin{array}{cc|c} 1 & 2 & 3 \\\\ 4 & 5 & 6 \\end{array}\\right]`). "
                    "**DO NOT use plain text brackets `[]` or pipes `|` to represent matrices.** "
                    "Ensure ALL mathematical expressions (fractions, integrals, matrices, variables, etc.) are enclosed in appropriate LaTeX delimiters (`$` for inline, `$$` for display block)."
                    f"{formatting_instructions}\\n"
                )
            else:
                system_prompt = (
                    "GPT4 Correct Assistant: I am a helpful assistant. "
                    "I maintain conversation context and provide relevant responses."
                    f"{formatting_instructions}\\n"
                )

            prompt = system_prompt
            
            # Trim history to fit within context window limits
            history = self.trim_history_to_fit_context(chat_session_id, user_input)
            
            # Add conversation history with the appropriate mode tags
            for message in history:
                # Get the message mode, defaulting to current mode if not present
                msg_mode = message.get("mode", mode)
                
                if message["role"] == "user":
                    if msg_mode == "Math Correct":
                        prompt += f"Math Correct User: {message['content']}<|end_of_turn|>\n"
                    else:
                        prompt += f"GPT4 Correct User: {message['content']}<|end_of_turn|>\n"
                else:
                    if msg_mode == "Math Correct":
                        prompt += f"Math Correct Assistant: {message['content']}<|end_of_turn|>\n"
                    else:
                        prompt += f"GPT4 Correct Assistant: {message['content']}<|end_of_turn|>\n"
            
            # Add the current user input with appropriate mode tag
            if mode == "Math Correct":
                prompt += f"Math Correct User: {user_input}<|end_of_turn|>\nMath Correct Assistant:"
            else:
                prompt += f"GPT4 Correct User: {user_input}<|end_of_turn|>\nGPT4 Correct Assistant:"
            
            # Final verification
            token_count = self.count_tokens(prompt)
            print(f"Final prompt token count: {token_count} (using {mode} mode)")
            
            # Check if we're still within limits
            if token_count > self.context_size:
                print(f"WARNING: Prompt exceeds context window ({token_count} > {self.context_size})")
                # Last resort fallback - use only the current input with appropriate mode
                if mode == "Math Correct":
                    prompt = f"Math Correct Assistant: I am a specialized assistant for mathematical reasoning. I carefully solve math problems step by step.\n\nMath Correct User: {user_input}<|end_of_turn|>\nMath Correct Assistant:"
                else:
                    prompt = f"GPT4 Correct Assistant: I am a helpful assistant. I maintain the context of our conversation and provide accurate, relevant responses.\n\nGPT4 Correct User: {user_input}<|end_of_turn|>\nGPT4 Correct Assistant:"
                print(f"Fallback to minimal prompt with token count: {self.count_tokens(prompt)}")
            
            return prompt
        except Exception as e:
            print(f"Error building prompt: {str(e)}")
            traceback.print_exc()
            # Last resort fallback with default mode
            return f"GPT4 Correct User: {user_input}<|end_of_turn|>\nGPT4 Correct Assistant:"

def generate_response(user_input, chat_session_id="default", model_mode="auto"):
    """
    Generate a response from the Llama model for the given user input,
    maintaining conversation context for the specific chat session.
    
    Args:
        user_input (str): The user's message
        chat_session_id (str): Identifier for the chat session
        model_mode (str): Model mode setting - "auto", "default", or "math"
        
    Returns:
        dict: Contains the AI's response and mode information
    """
    try:
        print(f"Generating response for input: '{user_input[:50]}...' (Session: {chat_session_id}, Mode: {model_mode})")
        
        llama_model = LlamaModel()
        if not llama_model.is_initialized():
            print("Model not initialized, initializing now...")
            llama_model.initialize_model()
        
        # Determine if this is a math query based on mode setting
        is_automatic = model_mode == "auto"
        
        if model_mode == "math":
            # Force math mode regardless of content
            is_math = True
            mode = "Math Correct"
            print(f"Using {mode} mode (manually selected)")
        elif model_mode == "default":
            # Force default mode regardless of content
            is_math = False
            mode = "GPT4 Correct"
            print(f"Using {mode} mode (manually selected)")
        else:
            # Auto mode - detect based on content
            is_math = llama_model.is_math_query(user_input)
            mode = "Math Correct" if is_math else "GPT4 Correct"
            print(f"Using {mode} mode (auto-detected)")
        
        # Add user input to conversation history with appropriate mode
        llama_model.add_to_history(chat_session_id, "user", user_input, mode)
        
        # Build the prompt with conversation history
        prompt = llama_model.build_prompt_with_history(chat_session_id, user_input)
        
        # Generate response with context, using more tokens from the larger context window
        print(f"Generating response with prompt length: {len(prompt)} characters")
        output = llama_model.llm(
            prompt, 
            max_tokens=2000,    # Increased from 1000 to use more of the available context
            stop=["<|end_of_turn|>"], 
            echo=False
        )
        response = output["choices"][0]["text"].strip()
        print(f"Generated response length: {len(response)} characters")
        
        # --- Log the RAW response BEFORE formatting --- 
        print(f"\n--- RAW AI Response --- \n{response}\n--- END RAW AI Response ---\n")
        # --- End logging --- 
        
        # Add AI response to conversation history
        llama_model.add_to_history(chat_session_id, "assistant", response, mode)
        
        # --- REMOVE THE REDUNDANT FORMATTING CALL --- 
        # formatted_response = format_math_response(response)
        # --- End formatting removal --- 
        
        # Return response with mode information
        return {
            "response": response, # Return RAW response from AI
            "mode": mode,
            "is_automatic": is_automatic
        }
    except Exception as e:
        print(f"Error generating response: {str(e)}")
        traceback.print_exc()
        
        # Fallback response mode - return a simple message without using the model
        fallback_response = {
            "response": (
                f"I'm sorry, but I'm experiencing technical difficulties right now. "
                f"There was an error initializing or using the language model: {str(e)}. "
                f"Please try refreshing the page or try again later."
            ),
            "mode": "GPT4 Correct",
            "is_automatic": model_mode == "auto"
        }
        return fallback_response

def tokenize_input(input_text):
    """
    Tokenize the input text using the Llama model.
    """
    try:
        llama_model = LlamaModel()
        if not llama_model.is_initialized():
            llama_model.initialize_model()
        
        tokens = llama_model.llm.tokenize(input_text.encode('utf-8'))
        return tokens
    except Exception as e:
        print(f"Error in tokenize_input: {str(e)}")
        # Return an empty list as a fallback
        return []

def clear_chat_history(chat_session_id):
    """
    Clear the conversation history for a specific chat session.
    Useful when starting a new conversation.
    
    Args:
        chat_session_id (str): Identifier for the chat session to clear
    """
    try:
        llama_model = LlamaModel()
        if chat_session_id in llama_model.conversation_history:
            del llama_model.conversation_history[chat_session_id]
            return True
        return False
    except Exception as e:
        print(f"Error clearing chat history: {str(e)}")
        return False

def load_history_from_database(user, chat_session_id):
    """
    Load conversation history from the database to ensure the in-memory 
    conversation history matches what's stored in the database.
    
    Args:
        user: The Django user object
        chat_session_id (str): Identifier for the chat session
    
    Returns:
        bool: True if history was loaded, False otherwise
    """
    try:
        # Import inside the function to avoid circular imports
        from django.apps import apps
        Chat = apps.get_model('api', 'Chat')
        
        # Get the model singleton
        llama_model = LlamaModel()
        if not llama_model.is_initialized():
            llama_model.initialize_model()
        
        # Clear existing history for this session (if any)
        if chat_session_id in llama_model.conversation_history:
            del llama_model.conversation_history[chat_session_id]
            
        # Get all messages for this chat session ordered by creation time
        chats = Chat.objects.filter(
            user=user,
            chat_session=chat_session_id
        ).order_by('created_at')
        
        # If no chats found, return False
        if not chats.exists():
            return False
            
        # Load each message and response into the conversation history
        for chat in chats:
            # Determine appropriate mode for this message (analyzing content)
            user_message_is_math = llama_model.is_math_query(chat.message)
            mode = "Math Correct" if user_message_is_math else "GPT4 Correct"
            
            # Add user message to history with detected mode
            llama_model.add_to_history(chat_session_id, "user", chat.message, mode)
            
            # Add AI response to history with same mode
            llama_model.add_to_history(chat_session_id, "assistant", chat.response, mode)
            
        print(f"Loaded {chats.count()} messages from database for session {chat_session_id}")
        return True
    except Exception as e:
        print(f"Error loading history from database: {str(e)}")
        return False

# This ensures the model is initialized before we try to use it, 
# regardless of whether the frontend called the initialization 
# endpoint or not.
