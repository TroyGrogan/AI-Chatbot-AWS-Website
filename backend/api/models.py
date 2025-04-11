from django.db import models
from django.contrib.auth.models import User
from django.conf import settings

class Note(models.Model):
    title = models.CharField(max_length=100)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notes")
    is_chat_note = models.BooleanField(default=False)  # Indicates if this note is part of a chat
    chat_quota_used = models.IntegerField(default=0)   # Tracks quota usage for chat-related notes

    def __str__(self):
        return self.title

class Chat(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    note = models.ForeignKey(Note, on_delete=models.CASCADE, related_name="chats", null=True, blank=True)
    chat_session = models.CharField(max_length=50)
    message = models.TextField()
    response = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    title = models.CharField(max_length=255, blank=True, null=True)
    bookmarked = models.BooleanField(default=False)
    remaining_messages = models.IntegerField(default=5)
    model_mode = models.CharField(max_length=20, default="GPT4 Correct")  # Stores the AI model mode
    is_automatic = models.BooleanField(default=True)  # Whether mode was auto-detected
    
    def __str__(self):
        return f"Chat with {self.user.username} - {self.created_at}"

    class Meta:
        ordering = ['-created_at']
