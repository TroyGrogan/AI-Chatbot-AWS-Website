# Generated by Django 5.1.6 on 2025-03-02 16:36

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0011_remove_chat_remaining_messages_delete_chatsession'),
    ]

    operations = [
        migrations.AddField(
            model_name='chat',
            name='remaining_messages',
            field=models.IntegerField(default=5),
        ),
    ]
