from django.contrib.auth.models import User
from rest_framework import generics, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import Note, Chat
from .serializers import UserSerializer, NoteSerializer, ChatSerializer, UserUpdateSerializer
from django.db.models import Q
from django.contrib.auth import logout
from .llm_handler import generate_response, LlamaModel, clear_chat_history, load_history_from_database
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
import uuid
from django.shortcuts import get_object_or_404

class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]

class NoteListCreate(generics.ListCreateAPIView):
    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Note.objects.filter(author=user)

    def perform_create(self, serializer):
        if serializer.is_valid():
            note = serializer.save(author=self.request.user)
            if "ask_anything" in self.request.data:  # Handle "Ask Anything" feature
                note.is_chat_note = True
                note.save()
            # Basic quota check for chat-related notes
            user_chat_notes = Note.objects.filter(author=self.request.user, is_chat_note=True).count()
            if user_chat_notes > 3:  # Chat limit
                raise serializers.ValidationError("Chat note quota limit exceeded.")
        else:
            print(serializer.errors)

class NoteDelete(generics.DestroyAPIView):
    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Note.objects.filter(author=user)

class ChatListCreate(generics.ListCreateAPIView):
    serializer_class = ChatSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Chat.objects.filter(user=user)  # Supports "Chat History"

    def perform_create(self, serializer):
        if serializer.is_valid():
            chat = serializer.save(user=self.request.user)  # Supports "New Chat"
            # Basic quota check for chats
            user_chats = Chat.objects.filter(user=self.request.user).count()
            if user_chats > 3:  # Example limit; adjust as needed
                raise serializers.ValidationError("Chat quota limit exceeded.")
        else:
            print(serializer.errors)

class ChatHistoryView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = self.request.user
        keyword = request.query_params.get('keyword', None)
        bookmarked_only = request.query_params.get('bookmarked', 'false').lower() == 'true'
        
        # Get all chats for this user
        chats = Chat.objects.filter(user=user)
        
        # Apply filters
        if bookmarked_only:
            chats = chats.filter(bookmarked=True)
            
        if keyword:
            chats = chats.filter(
                Q(message__icontains=keyword) | 
                Q(response__icontains=keyword)
            )
            
        # Group chats by chat_session
        chat_sessions = {}
        
        for chat in chats:
            session_id = chat.chat_session
            remaining = int(getattr(chat, 'remaining_messages', 5))
            
            # Check if any message in this session is bookmarked
            is_session_bookmarked = Chat.objects.filter(
                user=user,
                chat_session=session_id,
                bookmarked=True
            ).exists()
            
            if session_id not in chat_sessions:
                # Count the actual number of messages directly from the database
                actual_message_count = Chat.objects.filter(
                    user=user,
                    chat_session=session_id
                ).count() // 2  # Each exchange (user + AI) is stored as two records
                
                # Create a new session entry
                chat_sessions[session_id] = {
                    'id': session_id,
                    'messages': [],
                    'created_at': chat.created_at,
                    'remaining_messages': remaining,
                    'title': chat.title,
                    'timestamp': chat.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                    'bookmarked': is_session_bookmarked,
                    'message_count': actual_message_count
                }
            
            # Add this message to the session
            chat_sessions[session_id]['messages'].append({
                'id': chat.id,
                'message': chat.message,
                'response': chat.response,
                'timestamp': chat.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                'bookmarked': chat.bookmarked,
                'model_mode': chat.model_mode,
                'is_automatic': chat.is_automatic
            })
            
            # Update remaining messages to use the most recent count
            if chat.created_at > chat_sessions[session_id]['created_at']:
                chat_sessions[session_id]['created_at'] = chat.created_at
                chat_sessions[session_id]['remaining_messages'] = remaining
                chat_sessions[session_id]['timestamp'] = chat.created_at.strftime("%Y-%m-%d %H:%M:%S")
                
                if chat.title:
                    chat_sessions[session_id]['title'] = chat.title
        
        # Convert the dictionary to a list and sort by most recent session
        chat_list = list(chat_sessions.values())
        chat_list.sort(key=lambda x: x['created_at'], reverse=True)
        
        return Response(chat_list)

class ChatDelete(generics.DestroyAPIView):
    serializer_class = ChatSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Chat.objects.filter(user=user)  # Only allow deletion of user's own chats

class SignOutView(APIView):
    def post(self, request):
        logout(request)
        # Return a simple success response instead of redirecting
        return Response(
            {"detail": "Successfully logged out"},
            status=status.HTTP_200_OK
        )

# Chat View (send message and get response)
class ChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        message = request.data.get('message', '')
        chat_session = request.data.get('chat_session', 'default')
        model_mode = request.data.get('model_mode', 'auto')  # Get model mode, default to auto
        
        if not message:
            return Response({'error': 'Message is required'}, status=400)
        
        # Validate model_mode
        if model_mode not in ['auto', 'default', 'math']:
            model_mode = 'auto'  # Default to auto if invalid
        
        # Debug print to verify the chat counting logic
        print(f"User: {request.user.username}, Chat session: {chat_session}, Mode: {model_mode}")
        
        # Check if user has reached the limit for this chat session
        session_messages_count = Chat.objects.filter(
            user=request.user, 
            chat_session=chat_session
        ).count()
        
        if session_messages_count >= 5:
            return Response({
                'error': 'Chat limit reached. Please start a new chat.',
                'limit_reached': True
            }, status=400)
        
        # Load existing conversation history from database
        if session_messages_count > 0:
            load_history_from_database(request.user, chat_session)
        
        # Generate response with chat session context and model mode
        response_data = generate_response(message, chat_session, model_mode)
        
        # Extract the response text from the response data object
        if isinstance(response_data, dict) and 'response' in response_data:
            ai_response = response_data['response']
            mode = response_data.get('mode', 'GPT4 Correct')
            is_automatic = response_data.get('is_automatic', model_mode == 'auto')
        else:
            # Fallback for compatibility with older code
            ai_response = response_data
            mode = 'GPT4 Correct'
            is_automatic = model_mode == 'auto'
        
        # Calculate remaining messages
        remaining_messages = 5 - (session_messages_count + 1)
        
        # Save the chat with remaining_messages data
        chat = Chat.objects.create(
            user=request.user,
            message=message,
            response=ai_response,
            chat_session=chat_session,
            remaining_messages=remaining_messages,  # Actually save the value to the database
            model_mode=mode,  # Save the model mode
            is_automatic=is_automatic  # Save whether mode was automatic
        )
        
        return Response({
            'response': ai_response,
            'remaining_messages': remaining_messages,
            'limit_reached': remaining_messages <= 0,
            'chat_session': chat_session,
            'mode': mode,
            'is_automatic': is_automatic
        })

class InitializeModelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            print("Initializing LLM model...")
            llama_model = LlamaModel()
            
            if not llama_model.is_initialized():
                print("Model not initialized, calling initialize_model()...")
                llama_model.initialize_model()
                print("Model initialization completed successfully")
            else:
                print("Model already initialized, skipping initialization")
                
            return Response({'status': 'Model initialized successfully'})
        except FileNotFoundError as e:
            error_message = str(e)
            print(f"Model file not found error: {error_message}")
            return Response(
                {'error': f'Model file not found: {error_message}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            error_message = str(e)
            import traceback
            traceback.print_exc()
            print(f"Model initialization error: {error_message}")
            return Response(
                {'error': f'Failed to initialize model: {error_message}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class NewChatSessionView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        # Generate a unique session ID (timestamp + random string)
        import time
        import random
        import string
        
        timestamp = int(time.time())
        random_str = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
        new_session_id = f"{timestamp}-{random_str}"
        
        # Clear any existing history for this new session ID (just to be safe)
        clear_chat_history(new_session_id)
        
        return Response({
            'chat_session': new_session_id,
            'remaining_messages': 5
        })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_chat_session(request, session_id):
    try:
        # Get all chats for this session
        chats = Chat.objects.filter(
            chat_session=session_id,
            user=request.user
        ).order_by('created_at')
        
        if not chats.exists():
            return Response(
                {'error': 'Chat session not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get the remaining messages count from the most recent chat in this session
        latest_chat = chats.latest('created_at')
        remaining_messages = int(getattr(latest_chat, 'remaining_messages', 5))
        
        # Return both the chat data and the remaining messages count
        serializer = ChatSerializer(chats, many=True)
        return Response({
            'chats': serializer.data,
            'remaining_messages': remaining_messages
        })
        
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

class ChatSessionView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, session_id):
        try:
            # Get all chats for this session
            chats = Chat.objects.filter(
                chat_session=session_id,
                user=request.user
            ).order_by('created_at')
            
            if not chats.exists():
                return Response(
                    {'error': 'Chat session not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get the remaining messages count from the most recent chat
            latest_chat = chats.latest('created_at')
            remaining_messages = int(getattr(latest_chat, 'remaining_messages', 5))
            
            # Check if this session is bookmarked (if any message is bookmarked)
            is_bookmarked = chats.filter(bookmarked=True).exists()
            
            # Serialize the chat data
            serializer = ChatSerializer(chats, many=True)
            
            return Response({
                'chats': serializer.data,
                'remaining_messages': remaining_messages,
                'is_bookmarked': is_bookmarked
            })
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_chat_session(request, session_id):
    try:
        # Delete all chats with this session_id that belong to this user
        deleted_count, _ = Chat.objects.filter(
            user=request.user, 
            chat_session=session_id
        ).delete()
        
        # Clear conversation history for this session ID
        clear_chat_history(session_id)
        
        if deleted_count > 0:
            return Response(
                {"message": f"Successfully deleted chat session with {deleted_count} messages"}, 
                status=status.HTTP_200_OK
            )
        else:
            return Response(
                {"error": "Chat session not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
    except Exception as e:
        return Response(
            {"error": str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_chat(request):
    try:
        user_message = request.data.get('message', '')
        chat_session = request.data.get('chat_session', '')
        model_mode = request.data.get('model_mode', 'auto')  # Get model mode, default to auto
        
        if not chat_session:
            chat_session = str(uuid.uuid4())
        
        # Validate model_mode
        if model_mode not in ['auto', 'default', 'math']:
            model_mode = 'auto'  # Default to auto if invalid
        
        # Get count of existing messages in this session
        session_messages_count = Chat.objects.filter(
            user=request.user,
            chat_session=chat_session
        ).count()
        
        # Check if this is the first message
        is_first_message = session_messages_count == 0
        
        # Generate an automatic title from the first message
        # This ensures the chat title is always based on what the user first asked,
        # not subsequent messages in the conversation. The title will display in both
        # the chat view and chat history views.
        title = None
        if is_first_message:
            # Use the complete first message as the title, up to 40 characters
            MAX_TITLE_LENGTH = 40
            title = user_message[:MAX_TITLE_LENGTH]
            if len(user_message) > MAX_TITLE_LENGTH:
                title += '...'
        else:
            # Load existing conversation history from database
            load_history_from_database(request.user, chat_session)
        
        # Generate AI response with chat session context and model mode
        response_data = generate_response(user_message, chat_session, model_mode)
        
        # Extract the response text and mode information
        if isinstance(response_data, dict) and 'response' in response_data:
            ai_response = response_data['response']
            mode = response_data.get('mode', 'GPT4 Correct')
            is_automatic = response_data.get('is_automatic', model_mode == 'auto')
        else:
            # Fallback for compatibility with older code
            ai_response = response_data
            mode = 'GPT4 Correct'
            is_automatic = model_mode == 'auto'
        
        # Calculate remaining messages
        remaining_messages = 5 - (session_messages_count + 1)
        
        # Save the chat with all information
        chat = Chat.objects.create(
            user=request.user,
            chat_session=chat_session,
            message=user_message,
            response=ai_response,
            title=title,  # This will be None for non-first messages
            remaining_messages=remaining_messages,
            model_mode=mode,  # Save the model mode
            is_automatic=is_automatic  # Save whether mode was automatic
        )
        
        return Response(ChatSerializer(chat).data)
    except Exception as e:
        return Response(
            {"error": str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def rename_chat_session(request, session_id):
    try:
        new_title = request.data.get('title', '')
        
        if not new_title:
            return Response(
                {"error": "Title cannot be empty"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Log the rename request    
        print(f"Renaming chat session {session_id} to '{new_title}' for user {request.user.username}")
            
        # Find all chat messages in this session
        chats = Chat.objects.filter(
            user=request.user, 
            chat_session=session_id
        ).order_by('created_at')
        
        if not chats.exists():
            return Response(
                {"error": "Chat session not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Cache title for logging before update
        old_title = chats.first().title
        
        # Update the title on ALL messages in this session for consistency
        updated_count = chats.update(title=new_title)
        
        print(f"Updated {updated_count} messages with new title: '{new_title}' (was '{old_title}') for session {session_id}")
        
        # Return the updated data - this is important for optimistic UI updates
        return Response({
            "success": True,
            "message": f"Chat renamed successfully. Updated {updated_count} messages.", 
            "session_id": session_id,
            "title": new_title
        }, status=status.HTTP_200_OK)
    except Exception as e:
        import traceback
        print(f"Error in rename_chat_session: {str(e)}")
        traceback.print_exc()
        return Response(
            {"error": str(e), "detail": "An error occurred while renaming the chat."}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bookmark_chat(request, chat_id):
    """Bookmark a chat and all messages in its session"""
    try:
        # Get the chat to bookmark
        chat = get_object_or_404(Chat, id=chat_id, user=request.user)
        session_id = chat.chat_session
        
        # Update all messages in this session
        Chat.objects.filter(
            user=request.user, 
            chat_session=session_id
        ).update(bookmarked=True)
        
        return Response({"message": "Chat session bookmarked successfully"}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def unbookmark_chat(request, chat_id):
    """Remove bookmark from a chat and all messages in its session"""
    try:
        # Get the chat to unbookmark
        chat = get_object_or_404(Chat, id=chat_id, user=request.user)
        session_id = chat.chat_session
        
        # Update all messages in this session
        Chat.objects.filter(
            user=request.user, 
            chat_session=session_id
        ).update(bookmarked=False)
        
        return Response({"message": "Chat session unbookmarked successfully"}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def bookmarked_chats(request):
    """Get all bookmarked chats for the current user"""
    try:
        bookmarked = Chat.objects.filter(user=request.user, bookmarked=True).order_by('-created_at')
        
        # Group chats by chat_session
        chat_sessions = {}
        for chat in bookmarked:
            session_id = chat.chat_session
            remaining = int(getattr(chat, 'remaining_messages', 5))
            
            if session_id not in chat_sessions:
                # Create a new session entry
                chat_sessions[session_id] = {
                    'id': session_id,
                    'messages': [],
                    'created_at': chat.created_at,
                    'remaining_messages': remaining,
                    'title': chat.title
                }
            
            # Add this message to the session
            chat_sessions[session_id]['messages'].append({
                'id': chat.id,
                'message': chat.message,
                'response': chat.response,
                'timestamp': chat.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                'bookmarked': chat.bookmarked,
                'model_mode': chat.model_mode,
                'is_automatic': chat.is_automatic
            })
            
            # Update to use the most recent data
            if chat.created_at > chat_sessions[session_id]['created_at']:
                chat_sessions[session_id]['created_at'] = chat.created_at
                chat_sessions[session_id]['remaining_messages'] = remaining
                if chat.title:
                    chat_sessions[session_id]['title'] = chat.title
        
        # Convert the dictionary to a list and sort by most recent
        chat_list = list(chat_sessions.values())
        chat_list.sort(key=lambda x: x['created_at'], reverse=True)
        
        return Response(chat_list)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UserAccountUpdateView(generics.UpdateAPIView):
    serializer_class = UserUpdateSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        return self.request.user
        
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        # Debug logging
        print("Update request data:", request.data)
        
        # If we're only updating the password, make sure username is included
        update_data = request.data.copy()
        is_password_update = 'password' in update_data 
        is_username_update = 'username' in update_data

        # When updating only password, add current username to data
        if is_password_update and not is_username_update:
            update_data['username'] = instance.username
            print("Added username to request data for password-only update")
        
        serializer = self.get_serializer(instance, data=update_data, partial=partial)
        
        try:
            if not serializer.is_valid():
                print("Serializer validation errors:", serializer.errors)
                serializer.is_valid(raise_exception=True)  # Raise the validation error
                
            self.perform_update(serializer)
            
            # For password updates, save again to make sure the password is properly set
            if is_password_update:
                instance.save()
                print("Password updated successfully for user:", instance.username)
            
            if is_username_update:
                print("Username updated from to:", instance.username)
            
            # Return updated user info (without password)
            return Response({
                "message": "Account information updated successfully",
                "username": instance.username
            })
        except serializers.ValidationError as e:
            print("Validation error:", e.detail)
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print("Exception in user update:", str(e))
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class UserInfoView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email
        })

class DeleteAccountView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        user = request.user
        
        try:
            # Delete the user (this will cascade delete related data due to our model relationships)
            user.delete()
            return Response({"detail": "Your account has been successfully deleted."}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": f"Failed to delete account: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
