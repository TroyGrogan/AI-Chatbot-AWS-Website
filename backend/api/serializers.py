from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Chat, Note  # Ensure Note is imported
from django.contrib.auth.password_validation import validate_password

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'password', 'email']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user

class UserUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    password_confirm = serializers.CharField(write_only=True, required=False)
    current_password = serializers.CharField(write_only=True, required=False)
    username = serializers.CharField(required=False)  # Make username not required
    
    class Meta:
        model = User
        fields = ['username', 'password', 'password_confirm', 'current_password']
        
    def validate_username(self, value):
        # Only validate username if it's being changed
        user = self.context['request'].user
        if value and value != user.username:
            if User.objects.exclude(pk=user.pk).filter(username=value).exists():
                raise serializers.ValidationError("Username is already taken! Please pick another username.")
        return value
    
    def validate(self, data):
        # Check if password fields are provided
        if 'password' in data:
            if not data.get('password_confirm'):
                raise serializers.ValidationError({"password_confirm": "Please confirm your password."})
            if data['password'] != data['password_confirm']:
                raise serializers.ValidationError({"password_confirm": "Password fields didn't match."})
            
            # Validate current password
            if not data.get('current_password'):
                raise serializers.ValidationError({"current_password": "Current password is required to set a new password."})
            
            user = self.context['request'].user
            if not user.check_password(data.get('current_password')):
                raise serializers.ValidationError({"current_password": "Current password is incorrect."})
            
            try:
                validate_password(data['password'], user=user)
            except Exception as e:
                raise serializers.ValidationError({"password": list(e.messages) if hasattr(e, 'messages') else str(e)})
        
        # For password-only updates, we need to restore the current username
        if 'password' in data and 'username' not in data:
            data['username'] = self.context['request'].user.username
        
        return data
    
    def update(self, instance, validated_data):
        # Remove confirmation fields
        validated_data.pop('password_confirm', None)
        validated_data.pop('current_password', None)
        
        # Handle password update
        password = validated_data.pop('password', None)
        if password:
            instance.set_password(password)
            
        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
            
        instance.save()
        return instance

# Serializer for our custom Note view
class NoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = ['id', 'title', 'content', 'created_at', 'is_chat_note', 'chat_quota_used']
        read_only_fields = ['created_at']

# Serializer for our custom Chat view
class ChatSerializer(serializers.ModelSerializer):
    timestamp = serializers.SerializerMethodField()
    
    class Meta:
        model = Chat
        fields = ['id', 'message', 'response', 'created_at', 'chat_session', 
                 'timestamp', 'remaining_messages', 'user', 'bookmarked', 'title',
                 'model_mode', 'is_automatic']
        read_only_fields = ['created_at', 'user']
    
    def get_timestamp(self, obj):
        return obj.created_at.strftime("%Y-%m-%d %H:%M:%S")