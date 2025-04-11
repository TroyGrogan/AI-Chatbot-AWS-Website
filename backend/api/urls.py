from django.urls import path
from . import views
from .views import bookmark_chat, unbookmark_chat, bookmarked_chats, DeleteAccountView

urlpatterns = [
    path("notes/", views.NoteListCreate.as_view(), name="note-list"),
    path("notes/delete/<int:pk>/", views.NoteDelete.as_view(), name="delete-note"),
    path("chats/", views.ChatListCreate.as_view(), name="chat-list"),
    path("user/signout/", views.SignOutView.as_view(), name="sign-out"),
    path("notes/ask/", views.NoteListCreate.as_view(), name="ask-anything"),
    path("chats/delete/<int:pk>/", views.ChatDelete.as_view(), name="delete-chat"),
    path('chat/', views.ChatView.as_view(), name='chat'),
    path('chat-history/', views.ChatHistoryView.as_view(), name='chat-history'),
    path('initialize_model/', views.InitializeModelView.as_view(), name='initialize-model'),
    path('new-chat-session/', views.NewChatSessionView.as_view(), name='new-chat-session'),
    path('chat-session/<str:session_id>/', views.ChatSessionView.as_view(), name='chat-session'),
    path('chat-session/delete/<str:session_id>/', views.delete_chat_session, name='delete-chat-session'),
    path('chat-session/rename/<str:session_id>/', views.rename_chat_session, name='rename-chat-session'),
    path('bookmark-chat/<int:chat_id>/', bookmark_chat, name='bookmark-chat'),
    path('unbookmark-chat/<int:chat_id>/', unbookmark_chat, name='unbookmark-chat'),
    path('bookmarked-chats/', bookmarked_chats, name='bookmarked-chats'),
    path('user/update/', views.UserAccountUpdateView.as_view(), name='user-account-update'),
    path('user/info/', views.UserInfoView.as_view(), name='user-info'),
    path('user/delete-account/', DeleteAccountView.as_view(), name='delete-account'),
]