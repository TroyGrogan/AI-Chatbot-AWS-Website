"""
AWS Lambda handler for serverless LLM processing.

This module provides functions for offloading LLM processing to AWS Lambda
when the local system is under heavy load or for specific types of requests.
"""

import json
import base64
import time
import os
import boto3
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

# Lambda function settings
LAMBDA_FUNCTION_NAME = os.environ.get("AWS_LAMBDA_FUNCTION_NAME", "ai-llm-processor")
LAMBDA_REGION = os.environ.get("AWS_REGION", "us-east-1")
MAX_LAMBDA_PAYLOAD_SIZE = 6 * 1024 * 1024  # 6MB, Lambda limit is 6MB

# Configure AWS Lambda client
lambda_client = boto3.client('lambda', region_name=LAMBDA_REGION)

def is_offloading_enabled():
    """
    Check if Lambda offloading is enabled in settings.
    
    Returns:
        bool: True if offloading is enabled, False otherwise
    """
    return (
        hasattr(settings, 'SERVERLESS_OFFLOADING_ENABLED') and 
        settings.SERVERLESS_OFFLOADING_ENABLED
    )

def should_offload_request(request_data, system_metrics=None):
    """
    Determine if a request should be offloaded to Lambda.
    
    Args:
        request_data: Dict containing request information
        system_metrics: Dict containing CPU, memory usage info
        
    Returns:
        bool: True if the request should be offloaded, False otherwise
    """
    if not is_offloading_enabled():
        return False
        
    # Get thresholds from settings or use defaults
    cpu_threshold = getattr(settings, 'OFFLOAD_CPU_THRESHOLD', 80)
    memory_threshold = getattr(settings, 'OFFLOAD_MEMORY_THRESHOLD', 85)
    
    # Check system resource usage
    if system_metrics and (
        system_metrics.get('cpu_percent', 0) > cpu_threshold or
        system_metrics.get('memory_percent', 0) > memory_threshold
    ):
        logger.info(f"Offloading request due to resource constraints: CPU {system_metrics.get('cpu_percent')}%, Memory {system_metrics.get('memory_percent')}%")
        return True
    
    # Check for specific model modes that should always be offloaded
    if request_data.get('model_mode') in getattr(settings, 'ALWAYS_OFFLOAD_MODELS', []):
        logger.info(f"Offloading request for model mode: {request_data.get('model_mode')}")
        return True
        
    # Check request size - offload larger requests
    input_length = len(request_data.get('user_input', ''))
    large_request_threshold = getattr(settings, 'OFFLOAD_TOKEN_THRESHOLD', 2000)
    if input_length > large_request_threshold:
        logger.info(f"Offloading large request with {input_length} characters")
        return True
        
    return False

def prepare_lambda_payload(request_data):
    """
    Prepare a request payload for Lambda invocation.
    
    Args:
        request_data: Dict containing the request data
        
    Returns:
        Dict: Lambda-compatible payload
    """
    # Create a copy of the request data
    payload = request_data.copy()
    
    # Add metadata
    payload['metadata'] = {
        'timestamp': time.time(),
        'source': 'django-app',
        'version': getattr(settings, 'APP_VERSION', '1.0.0')
    }
    
    # Check payload size
    payload_json = json.dumps(payload)
    payload_size = len(payload_json.encode('utf-8'))
    
    if payload_size > MAX_LAMBDA_PAYLOAD_SIZE:
        # Truncate user input if needed
        logger.warning(f"Payload size ({payload_size} bytes) exceeds Lambda limit")
        
        # If the input is very large, we need to truncate it
        if 'user_input' in payload and len(payload['user_input']) > 1000:
            # Truncate to a safe size, preserving start and end context
            max_input_size = 1000  # This is a heuristic
            input_text = payload['user_input']
            half_size = max_input_size // 2
            payload['user_input'] = input_text[:half_size] + "..." + input_text[-half_size:]
            payload['truncated'] = True
            
            # Recalculate size
            payload_json = json.dumps(payload)
            payload_size = len(payload_json.encode('utf-8'))
            
            if payload_size > MAX_LAMBDA_PAYLOAD_SIZE:
                # If still too large, use a simplified payload
                logger.error("Payload still too large after truncation")
                return {
                    'error': 'Request too large for Lambda processing',
                    'metadata': payload['metadata']
                }
    
    return payload

def invoke_lambda_function(payload):
    """
    Invoke AWS Lambda function for LLM processing.
    
    Args:
        payload: Dict containing the request payload
        
    Returns:
        Dict: Response from Lambda function
    """
    try:
        logger.info(f"Invoking Lambda function {LAMBDA_FUNCTION_NAME}")
        response = lambda_client.invoke(
            FunctionName=LAMBDA_FUNCTION_NAME,
            InvocationType='RequestResponse',  # Synchronous
            Payload=json.dumps(payload)
        )
        
        # Parse the response
        response_payload = json.loads(response['Payload'].read().decode('utf-8'))
        
        # Check for Lambda execution errors
        if 'FunctionError' in response:
            logger.error(f"Lambda execution error: {response_payload}")
            return {
                'error': 'Lambda execution failed',
                'message': str(response_payload.get('errorMessage', 'Unknown error'))
            }
            
        return response_payload
        
    except Exception as e:
        logger.exception(f"Error invoking Lambda function: {str(e)}")
        return {
            'error': 'Failed to process request via Lambda',
            'message': str(e)
        }

def process_via_lambda(request_data, system_metrics=None):
    """
    Process an LLM request via AWS Lambda.
    
    Args:
        request_data: Dict containing the request data
        system_metrics: Dict containing system resource usage
        
    Returns:
        Dict: Response from Lambda processing
    """
    # Check if we should offload
    if not should_offload_request(request_data, system_metrics):
        return {'offloaded': False, 'reason': 'Offloading not required'}
    
    # Prepare the payload
    payload = prepare_lambda_payload(request_data)
    
    # Check if payload preparation failed
    if 'error' in payload:
        return payload
    
    # Invoke Lambda function
    start_time = time.time()
    response = invoke_lambda_function(payload)
    processing_time = time.time() - start_time
    
    # Add processing metadata
    response['offloaded'] = True
    response['processing_time'] = processing_time
    
    logger.info(f"Lambda processing completed in {processing_time:.2f}s")
    return response 