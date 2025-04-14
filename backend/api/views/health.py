"""
Health check views for API monitoring.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import psutil
import time


class HealthCheckView(APIView):
    """
    View for health check endpoint to monitor API service status.
    Returns basic system health metrics.
    """
    def get(self, request):
        """
        Handle GET requests to return health status.
        """
        # Get basic system metrics
        health_data = {
            'status': 'up',
            'timestamp': time.time(),
            'cpu_usage': psutil.cpu_percent(),
            'memory_usage': psutil.virtual_memory().percent,
            'disk_usage': psutil.disk_usage('/').percent,
        }
        
        return Response(health_data, status=status.HTTP_200_OK) 