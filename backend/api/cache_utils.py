"""
Caching utilities for LLM operations.

This module provides caching decorators and functions for improving the performance
of LLM operations by caching results in Redis (via ElastiCache) or local memory.
"""

import hashlib
import json
import time
import functools
from django.core.cache import cache
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

# Cache TTL values (in seconds)
CACHE_TTL_SHORT = 300  # 5 minutes
CACHE_TTL_MEDIUM = 3600  # 1 hour
CACHE_TTL_LONG = 86400  # 1 day
CACHE_TTL_VERY_LONG = 604800  # 1 week

def get_cache_key(prefix, *args, **kwargs):
    """
    Generate a consistent cache key from arguments.
    
    Args:
        prefix: String prefix for the cache key
        *args, **kwargs: Arguments to include in the key
        
    Returns:
        String: A consistent cache key
    """
    # Convert args and kwargs to a string representation
    key_data = {
        'args': args,
        'kwargs': {k: v for k, v in kwargs.items() if k != 'self'}
    }
    
    # Create a deterministic JSON string
    key_json = json.dumps(key_data, sort_keys=True)
    
    # Create an MD5 hash of the JSON string for a fixed-length key
    key_hash = hashlib.md5(key_json.encode()).hexdigest()
    
    # Return the prefixed key
    return f"{prefix}:{key_hash}"

def cached_llm_response(ttl=CACHE_TTL_MEDIUM):
    """
    Decorator for caching LLM responses.
    
    Args:
        ttl: Cache TTL in seconds
        
    Returns:
        Callable: Decorated function
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Skip caching if cache is disabled or in development mode
            if settings.DEBUG and not settings.CACHES['default']['BACKEND'].endswith('.LocMemCache'):
                return func(*args, **kwargs)
            
            # Don't cache if the user explicitly requests a fresh response
            if kwargs.get('skip_cache', False):
                kwargs.pop('skip_cache', None)
                return func(*args, **kwargs)
                
            # Generate a cache key
            cache_key = get_cache_key(f"llm:{func.__name__}", *args, **kwargs)
            
            # Try to get from cache
            cached_result = cache.get(cache_key)
            if cached_result is not None:
                logger.info(f"Cache hit for {cache_key}")
                return cached_result
                
            # Generate result if not in cache
            logger.info(f"Cache miss for {cache_key}, computing result")
            start_time = time.time()
            result = func(*args, **kwargs)
            exec_time = time.time() - start_time
            
            # Only cache if execution was expensive (> 0.5 seconds)
            if exec_time > 0.5:
                logger.info(f"Caching result for {cache_key} (execution took {exec_time:.2f}s)")
                cache.set(cache_key, result, ttl)
            else:
                logger.info(f"Not caching fast result ({exec_time:.2f}s) for {cache_key}")
                
            return result
        return wrapper
    return decorator

def cached_tokenization(ttl=CACHE_TTL_VERY_LONG):
    """
    Decorator for caching tokenization results.
    
    Args:
        ttl: Cache TTL in seconds
        
    Returns:
        Callable: Decorated function
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(input_text, *args, **kwargs):
            # Skip caching for very short inputs
            if len(input_text) < 100:
                return func(input_text, *args, **kwargs)
                
            # Generate a cache key - just hash the input text for tokenization
            text_hash = hashlib.md5(input_text.encode()).hexdigest()
            cache_key = f"tokenize:{text_hash}"
            
            # Try to get from cache
            cached_result = cache.get(cache_key)
            if cached_result is not None:
                return cached_result
                
            # Generate result if not in cache
            result = func(input_text, *args, **kwargs)
            cache.set(cache_key, result, ttl)
            return result
        return wrapper
    return decorator

def invalidate_cache_for_session(chat_session_id):
    """
    Invalidate all cached results for a specific chat session.
    This is useful when the conversation context changes significantly.
    
    Args:
        chat_session_id: The session ID to invalidate caches for
    """
    # This is a pattern-based deletion approach that works with Redis
    # For other cache backends, this might need adaptation
    cache_key_pattern = f"llm:*:{chat_session_id}:*"
    
    try:
        # Try Redis-specific pattern deletion if using django-redis
        if hasattr(cache, 'delete_pattern'):
            cache.delete_pattern(cache_key_pattern)
            logger.info(f"Invalidated cache pattern: {cache_key_pattern}")
        else:
            # Fallback - we can't easily do pattern matching with default cache
            logger.warning(f"Cannot invalidate pattern {cache_key_pattern} with current cache backend")
    except Exception as e:
        logger.error(f"Error invalidating cache: {str(e)}")

def apply_caching_to_llm_handler():
    """
    Apply caching decorators to the LLM handler functions.
    This should be called during Django's AppConfig.ready() method.
    """
    try:
        from . import llm_handler
        
        # Apply caching to tokenize_input
        original_tokenize = llm_handler.tokenize_input
        llm_handler.tokenize_input = cached_tokenization()(original_tokenize)
        
        # Store original generate_response
        if not hasattr(llm_handler, '_original_generate_response'):
            llm_handler._original_generate_response = llm_handler.generate_response
            
            # Replace with cached version
            @cached_llm_response()
            def cached_generate_response(user_input, chat_session_id="default", model_mode="auto"):
                # We only want to cache on user_input for identical messages
                return llm_handler._original_generate_response(
                    user_input=user_input,
                    chat_session_id=chat_session_id,
                    model_mode=model_mode
                )
            
            llm_handler.generate_response = cached_generate_response
            
        logger.info("Successfully applied caching to LLM handler functions")
    except Exception as e:
        logger.error(f"Failed to apply caching to LLM handler: {str(e)}") 