"""
Monitoring Module for LLM API Service.

This module provides functionality to track and report system and application performance metrics,
including request latency, token usage, model usage statistics, memory consumption, and CPU usage.
"""

import time
import logging
import psutil
import json
import threading
from django.conf import settings
from django.core.cache import cache
import boto3
from datetime import datetime, timedelta
from contextlib import contextmanager
from collections import defaultdict

logger = logging.getLogger(__name__)

# Constants
METRICS_CACHE_KEY = "llm_performance_metrics"
METRICS_CACHE_TTL = 60 * 60 * 24  # 24 hours
METRICS_LOCK_KEY = "llm_metrics_lock"
CLOUDWATCH_NAMESPACE = "AI/LLMService"
CLOUDWATCH_REGION = settings.AWS_REGION if hasattr(settings, "AWS_REGION") else "us-east-1"

# Thread lock for metrics updates
_metrics_lock = threading.Lock()

# Performance metrics storage
_performance_metrics = {
    "total_requests": 0,
    "total_latency": 0,  # in seconds
    "cached_responses": 0,
    "errors": 0,
    "token_usage": {
        "prompt": 0,
        "completion": 0,
        "total": 0
    },
    "requests_by_model": defaultdict(int),
    "last_reset": datetime.now().isoformat()
}

# Initialize CloudWatch client if enabled
cloudwatch_enabled = getattr(settings, "CLOUDWATCH_METRICS_ENABLED", False)
cloudwatch_client = None
if cloudwatch_enabled:
    try:
        cloudwatch_client = boto3.client("cloudwatch", region_name=CLOUDWATCH_REGION)
    except Exception as e:
        logger.error(f"Failed to initialize CloudWatch client: {str(e)}")
        cloudwatch_enabled = False

def get_system_metrics():
    """
    Get current system metrics including CPU and memory usage.
    
    Returns:
        dict: System metrics including CPU and memory usage
    """
    try:
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        
        return {
            "cpu_percent": cpu_percent,
            "memory_percent": memory.percent,
            "memory_used": memory.used,
            "memory_total": memory.total
        }
    except Exception as e:
        logger.error(f"Error getting system metrics: {str(e)}")
        return {
            "cpu_percent": 0,
            "memory_percent": 0,
            "memory_used": 0,
            "memory_total": 0
        }

def _load_metrics_from_cache():
    """Load metrics from cache or initialize if not present."""
    global _performance_metrics
    cached_metrics = cache.get(METRICS_CACHE_KEY)
    if cached_metrics:
        try:
            _performance_metrics = json.loads(cached_metrics)
        except json.JSONDecodeError:
            logger.error("Failed to decode cached metrics")
    else:
        # Initialize with default values and save to cache
        _save_metrics_to_cache()

def _save_metrics_to_cache():
    """Save current metrics to cache."""
    try:
        cache.set(METRICS_CACHE_KEY, json.dumps(_performance_metrics), METRICS_CACHE_TTL)
    except Exception as e:
        logger.error(f"Failed to save metrics to cache: {str(e)}")

def _acquire_metrics_lock(timeout=5):
    """
    Acquire a lock for updating metrics.
    
    Args:
        timeout: Maximum time to wait for lock in seconds
        
    Returns:
        bool: True if lock acquired, False otherwise
    """
    end_time = time.time() + timeout
    while time.time() < end_time:
        if cache.add(METRICS_LOCK_KEY, 1, timeout=30):  # Lock expires after 30s
            return True
        time.sleep(0.1)
    return False

def _release_metrics_lock():
    """Release the metrics lock."""
    cache.delete(METRICS_LOCK_KEY)

@contextmanager
def record_latency(model_name=None, is_cached=False, offloaded=False):
    """
    Context manager to record latency for an LLM operation.
    
    Args:
        model_name: Name of the LLM model being used
        is_cached: Whether the response is from cache
        offloaded: Whether the request was offloaded to Lambda
        
    Yields:
        None
    """
    start_time = time.time()
    error_occurred = False
    
    try:
        yield
    except Exception:
        error_occurred = True
        raise
    finally:
        latency = time.time() - start_time
        threading.Thread(
            target=_update_metrics,
            args=(latency, model_name, is_cached, offloaded, error_occurred),
            daemon=True
        ).start()

def _update_metrics(latency, model_name, is_cached, offloaded, error_occurred):
    """
    Update metrics with information from a request.
    
    Args:
        latency: Request latency in seconds
        model_name: Name of the LLM model
        is_cached: Whether the response was from cache
        offloaded: Whether the request was offloaded
        error_occurred: Whether an error occurred
    """
    # Try to acquire lock for updating metrics
    if not _acquire_metrics_lock():
        logger.warning("Could not acquire metrics lock, skipping update")
        return

    try:
        # Load latest metrics
        _load_metrics_from_cache()
        
        # Update counters
        _performance_metrics["total_requests"] += 1
        _performance_metrics["total_latency"] += latency
        
        if is_cached:
            _performance_metrics["cached_responses"] += 1
        
        if offloaded:
            _performance_metrics["lambda_offloaded"] += 1
            
        if error_occurred:
            _performance_metrics["errors"] += 1
            
        # Update token usage
        _performance_metrics["token_usage"]["prompt"] += 0  # Assuming no prompt tokens for now
        _performance_metrics["token_usage"]["completion"] += 0  # Assuming no completion tokens for now
        _performance_metrics["token_usage"]["total"] += 0  # Assuming no total tokens for now
        
        # Update model-specific stats
        if model_name:
            _performance_metrics["requests_by_model"][model_name] += 1
        
        # Save updated metrics to cache
        _save_metrics_to_cache()
        
        # Submit to CloudWatch if enabled
        if cloudwatch_enabled and cloudwatch_client:
            _push_metrics_to_cloudwatch(latency, model_name, is_cached, offloaded, error_occurred)
            
    except Exception as e:
        logger.error(f"Error updating metrics: {str(e)}")
    finally:
        _release_metrics_lock()

def _push_metrics_to_cloudwatch(latency, model_name, is_cached, offloaded, error_occurred):
    """
    Push metrics to CloudWatch.
    
    Args:
        latency: Request latency in seconds
        model_name: Name of the LLM model
        is_cached: Whether the response was from cache
        offloaded: Whether the request was offloaded
        error_occurred: Whether an error occurred
    """
    try:
        dimensions = [
            {
                'Name': 'Environment',
                'Value': settings.ENVIRONMENT
            }
        ]
        
        if model_name:
            dimensions.append({
                'Name': 'Model',
                'Value': model_name
            })
            
        metrics_data = [
            {
                'MetricName': 'Latency',
                'Dimensions': dimensions,
                'Value': latency,
                'Unit': 'Seconds'
            },
            {
                'MetricName': 'RequestCount',
                'Dimensions': dimensions,
                'Value': 1,
                'Unit': 'Count'
            }
        ]
        
        # Add cache metrics
        if is_cached:
            metrics_data.append({
                'MetricName': 'CacheHit',
                'Dimensions': dimensions,
                'Value': 1,
                'Unit': 'Count'
            })
            
        # Add offload metrics
        if offloaded:
            metrics_data.append({
                'MetricName': 'LambdaOffloaded',
                'Dimensions': dimensions,
                'Value': 1,
                'Unit': 'Count'
            })
            
        # Add error metrics
        if error_occurred:
            metrics_data.append({
                'MetricName': 'Error',
                'Dimensions': dimensions,
                'Value': 1,
                'Unit': 'Count'
            })
            
        # Push metrics
        cloudwatch_client.put_metric_data(
            Namespace=CLOUDWATCH_NAMESPACE,
            MetricData=metrics_data
        )
        
    except Exception as e:
        logger.error(f"Error pushing metrics to CloudWatch: {str(e)}")

def get_performance_metrics():
    """
    Get a copy of the current performance metrics.
    
    Returns:
        dict: Current performance metrics
    """
    with _metrics_lock:
        # Convert defaultdict to regular dict for serialization
        metrics_copy = _performance_metrics.copy()
        metrics_copy["requests_by_model"] = dict(metrics_copy["requests_by_model"])
        return metrics_copy

def reset_metrics():
    """
    Reset all performance metrics to their initial values.
    """
    with _metrics_lock:
        _performance_metrics["total_requests"] = 0
        _performance_metrics["total_latency"] = 0
        _performance_metrics["cached_responses"] = 0
        _performance_metrics["errors"] = 0
        _performance_metrics["token_usage"] = {
            "prompt": 0,
            "completion": 0,
            "total": 0
        }
        _performance_metrics["requests_by_model"] = defaultdict(int)
        _performance_metrics["last_reset"] = datetime.now().isoformat()
    
    logger.info("Performance metrics have been reset")

def track_token_usage(tokens_used, model_name=None):
    """
    Track token usage for billing and monitoring.
    
    Args:
        tokens_used: Number of tokens used in request
        model_name: Name of the LLM model
    """
    if not _acquire_metrics_lock():
        logger.warning("Could not acquire metrics lock for token tracking")
        return
        
    try:
        _load_metrics_from_cache()
        
        # Update total token usage
        _performance_metrics["token_usage"]["total"] += tokens_used
        
        # Update model-specific token usage if needed
        if model_name and hasattr(_performance_metrics["token_usage"], "by_model"):
            if model_name not in _performance_metrics["token_usage"]["by_model"]:
                _performance_metrics["token_usage"]["by_model"][model_name] = tokens_used
            else:
                _performance_metrics["token_usage"]["by_model"][model_name] += tokens_used
                
        _save_metrics_to_cache()
        
        # Push to CloudWatch if enabled
        if cloudwatch_enabled and cloudwatch_client:
            dimensions = [
                {
                    'Name': 'Environment',
                    'Value': settings.ENVIRONMENT
                }
            ]
            
            if model_name:
                dimensions.append({
                    'Name': 'Model',
                    'Value': model_name
                })
                
            cloudwatch_client.put_metric_data(
                Namespace=CLOUDWATCH_NAMESPACE,
                MetricData=[
                    {
                        'MetricName': 'TokenUsage',
                        'Dimensions': dimensions,
                        'Value': tokens_used,
                        'Unit': 'Count'
                    }
                ]
            )
            
    except Exception as e:
        logger.error(f"Error tracking token usage: {str(e)}")
    finally:
        _release_metrics_lock()

class LatencyMonitor:
    """Context manager for measuring and logging request latency."""
    
    def __init__(self, model, is_cached=False):
        """
        Initialize the latency monitor.
        
        Args:
            model (str): Model being used for the request
            is_cached (bool): Whether the response is from cache
        """
        self.model = model
        self.is_cached = is_cached
        self.start_time = None
        self.tokens_prompt = 0
        self.tokens_completion = 0
        self.is_error = False
    
    def __enter__(self):
        self.start_time = time.time()
        return self
    
    def set_token_counts(self, prompt_tokens, completion_tokens):
        """
        Set token counts for the current request.
        
        Args:
            prompt_tokens (int): Number of tokens in the prompt
            completion_tokens (int): Number of tokens in the completion
        """
        self.tokens_prompt = prompt_tokens
        self.tokens_completion = completion_tokens
    
    def set_error(self):
        """Mark the current request as having an error."""
        self.is_error = True
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            self.is_error = True
        
        latency = time.time() - self.start_time
        log_request(
            model=self.model,
            latency=latency,
            tokens_prompt=self.tokens_prompt,
            tokens_completion=self.tokens_completion,
            is_cached=self.is_cached,
            is_error=self.is_error
        ) 