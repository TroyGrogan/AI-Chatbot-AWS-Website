"""
LLM Response Cache Management.

This module provides functions for efficiently caching LLM responses
with advanced features like TTL control, cache eviction strategies,
and smart cache invalidation based on prompt similarity.
"""

import json
import hashlib
import logging
import time
from typing import Dict, Any, Optional, List, Tuple
from django.core.cache import cache
from django.conf import settings
import threading
from datetime import datetime, timedelta

from .monitoring import record_latency

logger = logging.getLogger(__name__)

# Constants
DEFAULT_CACHE_TTL = 60 * 60 * 24  # 24 hours
CACHE_PREFIX = "llm_response_"
CACHE_METADATA_PREFIX = "llm_metadata_"
CACHE_STATS_KEY = "llm_cache_stats"
MAX_CACHED_ITEMS = getattr(settings, "LLM_MAX_CACHED_ITEMS", 10000)
MIN_CACHE_EXPIRY_TIME = getattr(settings, "LLM_MIN_CACHE_EXPIRY_TIME", 60 * 5)  # 5 minutes
MAX_CACHE_SIZE_MB = getattr(settings, "LLM_MAX_CACHE_SIZE_MB", 1024)  # 1GB

# Cache statistics storage
_cache_stats = {
    "total_cache_requests": 0,
    "cache_hits": 0,
    "cache_misses": 0,
    "cache_items_count": 0,
    "estimated_cache_size_mb": 0,
    "evictions": 0,
    "last_reset": datetime.now().isoformat(),
}

def _generate_cache_key(prompt: str, model: str, parameters: Dict[str, Any] = None) -> str:
    """
    Generate a cache key based on the prompt, model, and parameters.
    
    Args:
        prompt: The user prompt
        model: The LLM model name
        parameters: Model parameters that affect generation
        
    Returns:
        str: The cache key
    """
    # Create a normalized representation of the request
    serializable_params = {}
    if parameters:
        # Only include parameters that affect output
        for param in ["temperature", "top_p", "max_tokens", "stop", "frequency_penalty", "presence_penalty"]:
            if param in parameters:
                serializable_params[param] = parameters[param]
    
    cache_data = {
        "prompt": prompt,
        "model": model,
        "parameters": serializable_params
    }
    
    # Create hash
    serialized = json.dumps(cache_data, sort_keys=True)
    hash_key = hashlib.md5(serialized.encode("utf-8")).hexdigest()
    
    return f"{CACHE_PREFIX}{hash_key}"

def _get_cache_metadata_key(cache_key: str) -> str:
    """Get the metadata key for a cache item."""
    return f"{CACHE_METADATA_PREFIX}{cache_key[len(CACHE_PREFIX):]}"

def _update_cache_stats(hit: bool, item_size_mb: float = 0, eviction: bool = False):
    """
    Update cache statistics.
    
    Args:
        hit: Whether the cache request was a hit
        item_size_mb: Size of the cached item in MB
        eviction: Whether an item was evicted
    """
    global _cache_stats
    stats = cache.get(CACHE_STATS_KEY)
    if stats:
        try:
            _cache_stats = json.loads(stats)
        except json.JSONDecodeError:
            logger.error("Failed to decode cache stats")
    
    _cache_stats["total_cache_requests"] += 1
    
    if hit:
        _cache_stats["cache_hits"] += 1
    else:
        _cache_stats["cache_misses"] += 1
        
    if eviction:
        _cache_stats["evictions"] += 1
        
    if item_size_mb > 0:
        # Adjust estimated cache size and count
        if hit:
            # Item already existed, no change to size or count
            pass
        else:
            # New item added
            _cache_stats["cache_items_count"] += 1
            _cache_stats["estimated_cache_size_mb"] += item_size_mb

    # Save updated stats
    cache.set(CACHE_STATS_KEY, json.dumps(_cache_stats), None)  # No expiry

def _estimate_item_size_mb(item: Any) -> float:
    """
    Estimate the size of a cache item in megabytes.
    
    Args:
        item: The item to measure
        
    Returns:
        float: Size in MB
    """
    try:
        serialized = json.dumps(item)
        return len(serialized.encode('utf-8')) / (1024 * 1024)
    except Exception:
        # If we can't serialize, make a conservative estimate
        return 0.5  # 500KB

def _should_apply_ttl_extension(cache_key: str, access_count: int) -> bool:
    """
    Determine if a cache item should have its TTL extended based on usage.
    
    Args:
        cache_key: The cache key
        access_count: Number of times the item has been accessed
        
    Returns:
        bool: True if TTL should be extended
    """
    # Implement adaptive TTL extension based on access patterns
    # More frequently accessed items get longer TTL
    if access_count <= 1:
        return False
    
    # For items accessed 2-5 times, extend TTL 50% of the time
    if access_count <= 5:
        return (int(cache_key[-1], 16) % 2) == 0
        
    # For items accessed 6+ times, always extend TTL
    return True

def _manage_cache_size():
    """
    Manage cache size by evicting least recently used items if needed.
    
    This is called periodically to ensure the cache doesn't grow too large.
    """
    stats = cache.get(CACHE_STATS_KEY)
    if not stats:
        return
    
    try:
        cache_stats = json.loads(stats)
        estimated_size_mb = cache_stats.get("estimated_cache_size_mb", 0)
        
        # Check if we need to evict items
        if estimated_size_mb <= MAX_CACHE_SIZE_MB:
            return
            
        # Get all cache metadata to find eviction candidates
        all_keys = cache.keys(f"{CACHE_METADATA_PREFIX}*")
        all_metadata = {}
        
        for key in all_keys:
            metadata = cache.get(key)
            if metadata:
                cache_key = CACHE_PREFIX + key[len(CACHE_METADATA_PREFIX):]
                all_metadata[cache_key] = metadata
                
        # Sort by last_accessed (oldest first)
        eviction_candidates = sorted(
            all_metadata.items(), 
            key=lambda x: x[1].get("last_accessed", 0)
        )
        
        # Evict items until we're under the size limit
        size_to_reclaim = estimated_size_mb - (MAX_CACHE_SIZE_MB * 0.8)  # Target 80% usage
        reclaimed = 0
        
        for cache_key, metadata in eviction_candidates:
            if reclaimed >= size_to_reclaim:
                break
                
            # Evict this item
            item_size = metadata.get("size_mb", 0.1)
            metadata_key = _get_cache_metadata_key(cache_key)
            
            cache.delete(cache_key)
            cache.delete(metadata_key)
            
            reclaimed += item_size
            _update_cache_stats(hit=False, eviction=True)
            
            logger.debug(f"Evicted cache item {cache_key}, reclaimed {item_size}MB")
            
        # Update total estimated size
        if stats := cache.get(CACHE_STATS_KEY):
            cache_stats = json.loads(stats)
            cache_stats["estimated_cache_size_mb"] -= reclaimed
            cache_stats["cache_items_count"] -= len(eviction_candidates)
            cache.set(CACHE_STATS_KEY, json.dumps(cache_stats), None)
            
    except Exception as e:
        logger.error(f"Error managing cache size: {str(e)}")

def get_cache_stats():
    """
    Get cache statistics.
    
    Returns:
        dict: Current cache statistics
    """
    stats = cache.get(CACHE_STATS_KEY)
    if stats:
        try:
            return json.loads(stats)
        except json.JSONDecodeError:
            logger.error("Failed to decode cache stats")
    
    # If no stats or error, return the current in-memory stats
    return _cache_stats.copy()

def reset_cache_stats():
    """
    Reset cache statistics.
    
    Returns:
        dict: New initialized stats
    """
    global _cache_stats
    _cache_stats = {
        "total_cache_requests": 0,
        "cache_hits": 0,
        "cache_misses": 0,
        "cache_items_count": 0,
        "estimated_cache_size_mb": 0,
        "evictions": 0,
        "last_reset": datetime.now().isoformat(),
    }
    
    cache.set(CACHE_STATS_KEY, json.dumps(_cache_stats), None)
    return _cache_stats.copy()

def get_cached_response(prompt: str, model: str, parameters: Dict[str, Any] = None) -> Tuple[Optional[Dict[str, Any]], bool]:
    """
    Get a cached LLM response if available.
    
    Args:
        prompt: The user prompt
        model: The LLM model name
        parameters: Model parameters
        
    Returns:
        Tuple[Optional[Dict], bool]: The cached response and a bool indicating if it was a cache hit
    """
    with record_latency(model_name=model, is_cached=True):
        cache_key = _generate_cache_key(prompt, model, parameters)
        metadata_key = _get_cache_metadata_key(cache_key)
        
        # Get the cached response
        cached_response = cache.get(cache_key)
        
        if cached_response:
            # Update metadata for this cache hit
            metadata = cache.get(metadata_key) or {}
            metadata["access_count"] = metadata.get("access_count", 0) + 1
            metadata["last_accessed"] = time.time()
            
            # Extend TTL if needed
            if _should_apply_ttl_extension(cache_key, metadata["access_count"]):
                # Calculate new TTL based on access patterns
                base_ttl = metadata.get("original_ttl", DEFAULT_CACHE_TTL)
                access_count = metadata["access_count"]
                
                # Extend TTL by a factor related to access count, up to 3x original
                extension_factor = min(3, 1 + (access_count / 10))
                new_ttl = int(base_ttl * extension_factor)
                
                # Update the expiry time
                cache.set(cache_key, cached_response, new_ttl)
                metadata["current_ttl"] = new_ttl
                logger.debug(f"Extended TTL for {cache_key} to {new_ttl}s (factor: {extension_factor})")
                
            # Save updated metadata
            cache.set(metadata_key, metadata, None)  # No expiry on metadata
            
            # Update statistics
            _update_cache_stats(hit=True)
            
            try:
                return json.loads(cached_response), True
            except json.JSONDecodeError:
                logger.error(f"Failed to decode cached response for {cache_key}")
                return None, False
        else:
            # Cache miss
            _update_cache_stats(hit=False)
            return None, False

def cache_response(prompt: str, model: str, response: Dict[str, Any], 
                   parameters: Dict[str, Any] = None, ttl: int = None) -> bool:
    """
    Cache an LLM response.
    
    Args:
        prompt: The user prompt
        model: The LLM model name
        response: The LLM response to cache
        parameters: Model parameters
        ttl: Time-to-live in seconds
        
    Returns:
        bool: True if successfully cached
    """
    with record_latency(model_name=model):
        if not getattr(settings, "LLM_CACHING_ENABLED", True):
            return False
            
        cache_key = _generate_cache_key(prompt, model, parameters)
        metadata_key = _get_cache_metadata_key(cache_key)
        
        try:
            # Serialize the response
            serialized_response = json.dumps(response)
            
            # Calculate size in MB
            size_mb = len(serialized_response.encode('utf-8')) / (1024 * 1024)
            
            # Check if we need to manage cache size first
            if _cache_stats["estimated_cache_size_mb"] + size_mb > MAX_CACHE_SIZE_MB:
                # Start a background thread to manage cache size
                threading.Thread(target=_manage_cache_size, daemon=True).start()
                
            # Set TTL based on size if not specified
            if ttl is None:
                # For larger responses, use shorter TTL
                if size_mb > 1:
                    ttl = min(DEFAULT_CACHE_TTL, int(DEFAULT_CACHE_TTL / size_mb))
                else:
                    ttl = DEFAULT_CACHE_TTL
                    
            # Enforce minimum TTL
            ttl = max(ttl, MIN_CACHE_EXPIRY_TIME)
            
            # Save response to cache
            cache.set(cache_key, serialized_response, ttl)
            
            # Save metadata
            metadata = {
                "model": model,
                "created": time.time(),
                "last_accessed": time.time(),
                "access_count": 1,
                "size_mb": size_mb,
                "original_ttl": ttl,
                "current_ttl": ttl,
            }
            cache.set(metadata_key, metadata, None)  # No expiry on metadata
            
            # Update statistics
            _update_cache_stats(hit=False, item_size_mb=size_mb)
            
            logger.debug(f"Cached response for {model}, size: {size_mb:.2f}MB, TTL: {ttl}s")
            return True
        except Exception as e:
            logger.error(f"Error caching response: {str(e)}")
            return False

def invalidate_cache_item(prompt: str, model: str, parameters: Dict[str, Any] = None) -> bool:
    """
    Invalidate a specific cached item.
    
    Args:
        prompt: The user prompt
        model: The LLM model name
        parameters: Model parameters
        
    Returns:
        bool: True if the item was found and invalidated
    """
    try:
        cache_key = _generate_cache_key(prompt, model, parameters)
        metadata_key = _get_cache_metadata_key(cache_key)
        
        # Get metadata to update stats
        metadata = cache.get(metadata_key)
        if metadata:
            # Update statistics - decrease size and count
            size_mb = metadata.get("size_mb", 0)
            stats = cache.get(CACHE_STATS_KEY)
            if stats:
                try:
                    cache_stats = json.loads(stats)
                    cache_stats["estimated_cache_size_mb"] -= size_mb
                    cache_stats["cache_items_count"] -= 1
                    cache.set(CACHE_STATS_KEY, json.dumps(cache_stats), None)
                except Exception:
                    pass
        
        result1 = cache.delete(cache_key)
        result2 = cache.delete(metadata_key)
        
        return result1 or result2
    except Exception as e:
        logger.error(f"Error invalidating cache: {str(e)}")
        return False

def clear_model_cache(model: str = None) -> int:
    """
    Clear cache for a specific model or all models.
    
    Args:
        model: The model name, or None to clear all
        
    Returns:
        int: Number of items cleared
    """
    try:
        # Get all metadata keys
        all_keys = cache.keys(f"{CACHE_METADATA_PREFIX}*")
        items_cleared = 0
        
        for metadata_key in all_keys:
            metadata = cache.get(metadata_key)
            if not metadata:
                continue
                
            if model is None or metadata.get("model") == model:
                # This is a match, delete it
                cache_key = CACHE_PREFIX + metadata_key[len(CACHE_METADATA_PREFIX):]
                cache.delete(cache_key)
                cache.delete(metadata_key)
                items_cleared += 1
                
        # Reset the cache stats
        reset_cache_stats()
        
        return items_cleared
    except Exception as e:
        logger.error(f"Error clearing model cache: {str(e)}")
        return 0

def is_similar_prompt(prompt1: str, prompt2: str, threshold: float = 0.8) -> bool:
    """
    Check if two prompts are similar enough to reuse cached results.
    
    This is a simplified implementation. For production, consider using
    a proper text similarity algorithm or embedding-based comparison.
    
    Args:
        prompt1: First prompt
        prompt2: Second prompt
        threshold: Similarity threshold (0-1)
        
    Returns:
        bool: True if prompts are similar
    """
    # Simple, cheap similarity check 
    # For actual implementation, consider using proper text similarity algorithms
    # or embeddings comparison
    
    # Normalize prompts
    p1 = prompt1.lower().strip()
    p2 = prompt2.lower().strip()
    
    # If one is a substring of the other, they're likely similar
    if p1 in p2 or p2 in p1:
        return True
        
    # Simple word-based Jaccard similarity
    words1 = set(p1.split())
    words2 = set(p2.split())
    
    if not words1 or not words2:
        return False
        
    intersection = words1.intersection(words2)
    union = words1.union(words2)
    
    similarity = len(intersection) / len(union)
    
    return similarity >= threshold 