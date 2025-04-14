"""
Django settings for ai_project project.
"""

import os
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/4.0/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-default-dev-key-change-in-production')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.environ.get('DEBUG', 'True').lower() == 'true'

ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'api',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'ai_project.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'ai_project.wsgi.application'

# Database
# https://docs.djangoproject.com/en/4.0/ref/settings/#databases

# Determine which database to use based on environment
if os.environ.get('USE_AWS_RDS', 'False').lower() == 'true':
    # AWS RDS PostgreSQL Configuration
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('RDS_DB_NAME', 'ai_db'),
            'USER': os.environ.get('RDS_USERNAME', 'postgres'),
            'PASSWORD': os.environ.get('RDS_PASSWORD', ''),
            'HOST': os.environ.get('RDS_HOSTNAME', ''),
            'PORT': os.environ.get('RDS_PORT', '5432'),
            'OPTIONS': {
                'sslmode': 'require',
            },
        }
    }
else:
    # Local SQLite Database (for development)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# Caching configuration
# https://docs.djangoproject.com/en/4.0/topics/cache/
if os.environ.get('USE_ELASTICACHE', 'False').lower() == 'true':
    # ElastiCache Redis Configuration
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": os.environ.get('ELASTICACHE_ENDPOINT', 'redis://127.0.0.1:6379/1'),
            "OPTIONS": {
                "CLIENT_CLASS": "django_redis.client.DefaultClient",
                "CONNECTION_POOL_KWARGS": {
                    "ssl_cert_reqs": None,
                },
            }
        }
    }
    
    # Use Redis for session cache as well
    SESSION_ENGINE = "django.contrib.sessions.backends.cache"
    SESSION_CACHE_ALIAS = "default"
    
    # Cache timeout in seconds (1 day)
    CACHE_MIDDLEWARE_SECONDS = 86400
    
    # Key prefix for cache entries
    CACHE_MIDDLEWARE_KEY_PREFIX = 'ai_llm_'
    
    # Use cache middleware
    MIDDLEWARE.insert(2, 'django.middleware.cache.UpdateCacheMiddleware')
    MIDDLEWARE.append('django.middleware.cache.FetchFromCacheMiddleware')
else:
    # Local memory cache (for development)
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'ai-llm-cache',
        }
    }

# Cache key function for static files
STATICFILES_STORAGE = 'django.contrib.staticfiles.storage.ManifestStaticFilesStorage'

# Password validation
# https://docs.djangoproject.com/en/4.0/ref/settings/#auth-password-validators
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
# https://docs.djangoproject.com/en/4.0/topics/i18n/
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/4.0/howto/static-files/
STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Default primary key field type
# https://docs.djangoproject.com/en/4.0/ref/settings/#default-auto-field
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS settings
CORS_ALLOW_ALL_ORIGINS = True

# AI LLM Settings
AWS_S3_BUCKET_NAME = os.environ.get('AWS_S3_BUCKET_NAME', 'ai-llm-models')

# Model Caching Settings 
CACHE_SIZE_GB = int(os.environ.get('CACHE_SIZE_GB', 2))

# Resource Monitoring Settings
CPU_THRESHOLD = int(os.environ.get('CPU_THRESHOLD', 80))
MEMORY_THRESHOLD = int(os.environ.get('MEMORY_THRESHOLD', 80))
ENABLE_CLOUDWATCH_METRICS = os.environ.get('ENABLE_CLOUDWATCH_METRICS', 'False').lower() == 'true'

# Serverless Offloading Settings
SERVERLESS_INFERENCE_ENDPOINT = os.environ.get('SERVERLESS_INFERENCE_ENDPOINT')
SERVERLESS_INFERENCE_LAMBDA = os.environ.get('SERVERLESS_INFERENCE_LAMBDA')
SAGEMAKER_ENDPOINT = os.environ.get('SAGEMAKER_ENDPOINT')

# Auto-scaling Settings
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')
ASG_NAME = os.environ.get('ASG_NAME')
ECS_CLUSTER = os.environ.get('ECS_CLUSTER')
ECS_SERVICE = os.environ.get('ECS_SERVICE')

# Distributed Inference Settings
SERVICE_DISCOVERY_NAME = os.environ.get('SERVICE_DISCOVERY_NAME')
ENABLE_DISTRIBUTED_INFERENCE = os.environ.get('ENABLE_DISTRIBUTED_INFERENCE', 'False').lower() == 'true' 