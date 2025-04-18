# Generated by Django 5.1.6 on 2025-03-02 18:38

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0012_chat_remaining_messages'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='chat',
            options={'ordering': ['-created_at']},
        ),
        migrations.RemoveField(
            model_name='chat',
            name='remaining_messages',
        ),
        migrations.AddField(
            model_name='chat',
            name='title',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AlterField(
            model_name='chat',
            name='chat_session',
            field=models.CharField(max_length=50),
        ),
        migrations.AlterField(
            model_name='chat',
            name='response',
            field=models.TextField(),
        ),
        migrations.AlterField(
            model_name='chat',
            name='user',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL),
        ),
    ]
