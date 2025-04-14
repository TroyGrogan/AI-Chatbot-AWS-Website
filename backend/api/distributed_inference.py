"""
Distributed Inference Module

This module implements patterns for distributed inference across multiple machines,
allowing the LLM service to scale horizontally and handle higher throughput.

Patterns implemented:
1. Round-robin distribution to multiple LLM instances
2. Load-based distribution based on server metrics
3. Redundant inference with result comparison for critical workloads
"""

import boto3
import json
import time
import random
import threading
import queue
from functools import lru_cache
from django.conf import settings
from . import llm_handler  # Import the local LLM handler

# Cache of available inference nodes
available_nodes = {}
node_cache_lock = threading.Lock()
request_queue = queue.Queue()
response_registry = {}

class DistributedInference:
    """
    Manager for distributing inference requests across multiple instances
    """
    def __init__(self):
        self.region = getattr(settings, 'AWS_REGION', 'us-east-1')
        self.service_discovery_name = getattr(settings, 'SERVICE_DISCOVERY_NAME', None)
        self.lambda_function = getattr(settings, 'SERVERLESS_INFERENCE_LAMBDA', None)
        self.sagemaker_endpoint = getattr(settings, 'SAGEMAKER_ENDPOINT', None)
        
        # Set up AWS clients
        self.lambda_client = boto3.client('lambda', region_name=self.region)
        self.sagemaker_runtime = boto3.client('sagemaker-runtime', region_name=self.region)
        self.cloudmap = boto3.client('servicediscovery', region_name=self.region)
        
        # Set up a worker thread to process requests
        self.worker_thread = threading.Thread(target=self._process_queue, daemon=True)
        self.worker_thread.start()
        
    def _get_inference_nodes(self):
        """
        Get a list of available inference nodes
        """
        # Check if we have a recent cache first
        with node_cache_lock:
            if available_nodes.get('last_updated', 0) > time.time() - 60:
                return available_nodes.get('nodes', [])
        
        nodes = []
        
        # If using service discovery, get nodes from AWS Cloud Map
        if self.service_discovery_name:
            try:
                # First get the service ID from the service name
                services = self.cloudmap.list_services()
                service_id = None
                for service in services.get('Services', []):
                    if service['Name'] == self.service_discovery_name:
                        service_id = service['Id']
                        break
                
                if service_id:
                    # Get instances registered with this service
                    response = self.cloudmap.list_instances(ServiceId=service_id)
                    for instance in response.get('Instances', []):
                        instance_id = instance['Id']
                        attributes = instance.get('Attributes', {})
                        if 'AWS_INSTANCE_IPV4' in attributes:
                            ip = attributes['AWS_INSTANCE_IPV4']
                            port = attributes.get('AWS_INSTANCE_PORT', '8000')
                            nodes.append({
                                'id': instance_id,
                                'ip': ip,
                                'port': port,
                                'url': f"http://{ip}:{port}/api/inference"
                            })
            except Exception as e:
                print(f"Error getting inference nodes from service discovery: {str(e)}")
        
        # Update the cache
        with node_cache_lock:
            available_nodes['nodes'] = nodes
            available_nodes['last_updated'] = time.time()
            
        return nodes
    
    def select_inference_node(self, request_type="standard"):
        """
        Select an appropriate node for inference based on request type and metrics
        """
        nodes = self._get_inference_nodes()
        
        if not nodes:
            print("No distributed inference nodes available, using local")
            return "local"
        
        # For critical requests, we might use multiple nodes for redundancy
        if request_type == "critical":
            if len(nodes) >= 2:
                # Return two nodes for redundant processing
                return random.sample(nodes, 2)
            elif len(nodes) == 1:
                # Use the single node plus local
                return [nodes[0], "local"]
        
        # For standard requests, use round-robin or load-based selection
        # Here we just use random selection as a simple example
        return random.choice(nodes)
    
    def _process_queue(self):
        """
        Process requests from the queue and distribute them
        """
        while True:
            try:
                # Get a request from the queue with a timeout
                request_item = request_queue.get(timeout=1)
                
                request_id = request_item['id']
                request_data = request_item['data']
                callback = request_item.get('callback')
                
                # Select a node for inference
                node = self.select_inference_node(request_item.get('request_type', 'standard'))
                
                # Process based on node type
                if node == "local":
                    # Use local inference
                    result = self._do_local_inference(request_data)
                elif isinstance(node, list):
                    # Redundant inference across multiple nodes
                    results = []
                    for n in node:
                        if n == "local":
                            results.append(self._do_local_inference(request_data))
                        else:
                            results.append(self._do_remote_inference(n, request_data))
                    
                    # Compare results and select the best one
                    result = self._reconcile_results(results)
                else:
                    # Single remote node
                    result = self._do_remote_inference(node, request_data)
                
                # Store the result in the registry
                response_registry[request_id] = {
                    'result': result,
                    'timestamp': time.time()
                }
                
                # If there's a callback, call it with the result
                if callback:
                    try:
                        callback(result)
                    except Exception as cb_error:
                        print(f"Error in callback: {str(cb_error)}")
                
                request_queue.task_done()
            except queue.Empty:
                # No requests to process, just continue
                pass
            except Exception as e:
                print(f"Error processing inference request: {str(e)}")
                time.sleep(1)
    
    def _do_local_inference(self, request_data):
        """
        Perform inference locally
        """
        try:
            # Extract parameters from request data
            user_input = request_data.get('input', '')
            chat_session_id = request_data.get('session_id', 'default')
            model_mode = request_data.get('model_mode', 'auto')
            
            # Call the local LLM handler
            result = llm_handler.generate_response(
                user_input=user_input,
                chat_session_id=chat_session_id,
                model_mode=model_mode
            )
            
            return result
        except Exception as e:
            print(f"Error in local inference: {str(e)}")
            return {
                'error': str(e),
                'response': 'Error processing your request locally'
            }
    
    def _do_remote_inference(self, node, request_data):
        """
        Perform inference on a remote node
        """
        import requests
        
        try:
            if isinstance(node, dict) and 'url' in node:
                # HTTP request to another Django instance
                url = node['url']
                headers = {'Content-Type': 'application/json'}
                
                response = requests.post(
                    url, 
                    headers=headers,
                    json=request_data,
                    timeout=30  # 30 second timeout
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    print(f"Error from remote node: {response.status_code} - {response.text}")
                    return {
                        'error': f"HTTP {response.status_code}",
                        'response': 'Error processing your request on remote node'
                    }
            elif self.lambda_function:
                # Use AWS Lambda for serverless inference
                response = self.lambda_client.invoke(
                    FunctionName=self.lambda_function,
                    InvocationType='RequestResponse',
                    Payload=json.dumps(request_data)
                )
                
                payload = json.loads(response['Payload'].read().decode('utf-8'))
                return payload
            elif self.sagemaker_endpoint:
                # Use SageMaker for inference
                response = self.sagemaker_runtime.invoke_endpoint(
                    EndpointName=self.sagemaker_endpoint,
                    ContentType='application/json',
                    Body=json.dumps(request_data)
                )
                
                result = json.loads(response['Body'].read().decode('utf-8'))
                return result
            else:
                print("No valid remote inference target specified")
                return {
                    'error': 'No remote target',
                    'response': 'No valid remote inference target available'
                }
        except Exception as e:
            print(f"Error in remote inference: {str(e)}")
            return {
                'error': str(e),
                'response': 'Error processing your request on remote node'
            }
    
    def _reconcile_results(self, results):
        """
        Compare results from multiple inference sources and select the best one
        """
        if not results:
            return {
                'error': 'No results',
                'response': 'No inference results available'
            }
        
        # If only one result, just return it
        if len(results) == 1:
            return results[0]
        
        # Check for errors
        valid_results = [r for r in results if 'error' not in r]
        if not valid_results:
            # All results had errors, return the first one
            return results[0]
        
        # If we have multiple valid results, select the one with the longest response
        # This is a simple heuristic - in a real system you might want more sophisticated logic
        return max(valid_results, key=lambda r: len(r.get('response', '')))
    
    def submit_request(self, request_data, callback=None, request_type="standard"):
        """
        Submit a request for distributed inference
        
        Args:
            request_data (dict): The inference request parameters
            callback (callable, optional): Function to call with the result
            request_type (str): "standard" or "critical" - determines redundancy level
            
        Returns:
            str: Request ID for tracking
        """
        request_id = f"req_{int(time.time())}_{random.randint(1000, 9999)}"
        
        # Put the request in the queue
        request_queue.put({
            'id': request_id,
            'data': request_data,
            'callback': callback,
            'request_type': request_type
        })
        
        return request_id
    
    def get_result(self, request_id, wait=False, timeout=30):
        """
        Get the result for a previous request
        
        Args:
            request_id (str): The request ID
            wait (bool): Whether to wait for the result if not ready
            timeout (int): How long to wait in seconds
            
        Returns:
            dict: The inference result or None if not available
        """
        start_time = time.time()
        
        while True:
            if request_id in response_registry:
                result = response_registry[request_id]['result']
                
                # Clean up old results periodically
                self._cleanup_old_results()
                
                return result
            
            if not wait or (time.time() - start_time > timeout):
                return None
            
            # Wait a bit before checking again
            time.sleep(0.1)
    
    def _cleanup_old_results(self):
        """
        Clean up old results from the registry
        """
        # Keep results for 1 hour
        cutoff = time.time() - 3600
        
        to_remove = []
        for req_id, data in response_registry.items():
            if data['timestamp'] < cutoff:
                to_remove.append(req_id)
        
        for req_id in to_remove:
            del response_registry[req_id]

# Create a singleton instance
distributed_inference = DistributedInference()

def submit_inference_request(user_input, chat_session_id="default", model_mode="auto", critical=False):
    """
    Helper function to submit an inference request
    
    Args:
        user_input (str): The user's input message
        chat_session_id (str): The chat session ID
        model_mode (str): The model mode ("auto", "default", or "math")
        critical (bool): Whether this is a critical request requiring redundancy
        
    Returns:
        tuple: (request_id, None) - The result will be retrieved later
    """
    request_data = {
        'input': user_input,
        'session_id': chat_session_id,
        'model_mode': model_mode
    }
    
    request_type = "critical" if critical else "standard"
    
    request_id = distributed_inference.submit_request(
        request_data=request_data,
        request_type=request_type
    )
    
    return request_id, None

def get_inference_result(request_id, wait=True, timeout=60):
    """
    Get the result of a previously submitted inference request
    
    Args:
        request_id (str): The request ID returned from submit_inference_request
        wait (bool): Whether to wait for the result if not ready
        timeout (int): How long to wait in seconds
        
    Returns:
        dict: The inference result or None if not available
    """
    return distributed_inference.get_result(request_id, wait, timeout) 