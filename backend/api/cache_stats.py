"""
Cache Statistics Module for LLM API Service.

This module provides functionality to track cache usage statistics including
hit rates, size information, and performance metrics for the application's caching layer.
"""

import time
import logging
import threading
from datetime import datetime
from django.core.cache import cache

logger = logging.getLogger(__name__)

# Cache statistics key in cache
CACHE_STATS_KEY = "llm_api_cache_stats"
CACHE_STATS_LOCK_KEY = "llm_api_cache_stats_lock"
CACHE_STATS_LOCK_TIMEOUT = 60  # 60 seconds
CACHE_STATS_TTL = 86400  # 24 hours

# Thread lock for cache stats updates
_cache_stats_lock = threading.Lock()

# Cache statistics storage
_cache_stats = {
    "hits": 0,
    "misses": 0,
    "size_estimates": {
        "entries": 0,
        "bytes": 0
    },
    "last_reset": datetime.now().isoformat()
}

def _acquire_cache_lock():
    """Acquire a distributed lock for cache statistics updates."""
    lock_value = str(time.time())
    acquired = cache.add(CACHE_STATS_LOCK_KEY, lock_value, CACHE_STATS_LOCK_TIMEOUT)
    return acquired

def _release_cache_lock():
    """Release the distributed lock for cache statistics."""
    cache.delete(CACHE_STATS_LOCK_KEY)

def _load_stats_from_cache():
    """Load cache statistics from cache or initialize if not present."""
    global _cache_stats
    cached_stats = cache.get(CACHE_STATS_KEY)
    if cached_stats and isinstance(cached_stats, dict):
        _cache_stats = cached_stats

def _save_stats_to_cache():
    """Save current cache statistics to cache."""
    try:
        cache.set(CACHE_STATS_KEY, _cache_stats, CACHE_STATS_TTL)
    except Exception as e:
        logger.error(f"Failed to save cache statistics to cache: {str(e)}")

def log_cache_hit():
    """
    Log a cache hit.
    """
    with _cache_stats_lock:
        _load_stats_from_cache()
        _cache_stats["hits"] += 1
        _save_stats_to_cache()

def log_cache_miss():
    """
    Log a cache miss.
    """
    with _cache_stats_lock:
        _load_stats_from_cache()
        _cache_stats["misses"] += 1
        _save_stats_to_cache()

def update_cache_size(entries=None, size_bytes=None):
    """
    Update cache size estimates.
    
    Args:
        entries (int): Number of entries in the cache
        size_bytes (int): Size of the cache in bytes
    """
    with _cache_stats_lock:
        _load_stats_from_cache()
        
        if entries is not None:
            _cache_stats["size_estimates"]["entries"] = entries
            
        if size_bytes is not None:
            _cache_stats["size_estimates"]["bytes"] = size_bytes
            
        _save_stats_to_cache()

def get_cache_stats():
    """
    Get current cache statistics.
    
    Returns:
        dict: Cache statistics including hit rate
    """
    with _cache_stats_lock:
        _load_stats_from_cache()
        
        stats = _cache_stats.copy()
        total_requests = stats["hits"] + stats["misses"]
        
        # Calculate hit rate
        if total_requests > 0:
            stats["hit_rate"] = (stats["hits"] / total_requests) * 100
        else:
            stats["hit_rate"] = 0
            
        stats["total_requests"] = total_requests
        stats["timestamp"] = datetime.now().isoformat()
        
        return stats

def reset_cache_stats():
    """
    Reset all cache statistics to their initial values.
    """
    with _cache_stats_lock:
        global _cache_stats
        _cache_stats = {
            "hits": 0,
            "misses": 0,
            "size_estimates": {
                "entries": 0,
                "bytes": 0
            },
            "last_reset": datetime.now().isoformat()
        }
        _save_stats_to_cache()
    
    logger.info("Cache statistics have been reset")

def estimate_cache_size():
    """
    Estimate the current cache size by sampling keys.
    This is an approximation and may not be exact.
    
    Returns:
        tuple: (number of entries, size in bytes)
    """
    try:
        # This implementation depends on the cache backend
        # For Redis, we might use redis_client.info("memory")
        # For Memcached, we could use stats command
        # This is a placeholder implementation
        
        # Try to get all keys with a specific prefix if possible
        # Note: This approach may not work for all cache backends
        # and should be customized based on the specific backend used
        
        # Placeholder values
        entries = 0
        size_bytes = 0
        
        # Update stats with the estimates
        update_cache_size(entries=entries, size_bytes=size_bytes)
        
        return (entries, size_bytes)
    except Exception as e:
        logger.error(f"Error estimating cache size: {str(e)}")
        return (0, 0)

def clear_cache():
    """
    Clear the entire cache.
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        cache.clear()
        
        # Reset statistics after clearing
        with _cache_stats_lock:
            _cache_stats["size_estimates"]["entries"] = 0
            _cache_stats["size_estimates"]["bytes"] = 0
            _save_stats_to_cache()
            
        logger.info("Cache has been cleared")
        return True
    except Exception as e:
        logger.error(f"Error clearing cache: {str(e)}")
        return False

class CacheMonitor:
    """Context manager for monitoring cache operations."""
    
    def __init__(self, key):
        """
        Initialize the cache monitor.
        
        Args:
            key (str): The cache key being accessed
        """
        self.key = key
        self.hit = False
        
    def record_hit(self):
        """Record that the cache access was a hit."""
        self.hit = True
        
    def record_miss(self):
        """Record that the cache access was a miss."""
        self.hit = False
        
    def __enter__(self):
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.hit:
            log_cache_hit()
        else:
            log_cache_miss() 