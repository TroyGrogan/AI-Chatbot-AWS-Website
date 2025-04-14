"""
Admin Dashboard Views for LLM API Service.

This module provides admin-only views for monitoring system performance,
cache statistics, and overall application health.
"""

import json
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from ..monitoring import get_performance_metrics, get_system_metrics, reset_metrics
from ..cache_stats import get_cache_stats, reset_cache_stats, estimate_cache_size, clear_cache

class AdminDashboardView(APIView):
    """
    Admin dashboard view providing performance metrics and system stats.
    Accessible only to admin users.
    """
    permission_classes = [IsAdminUser]

    @method_decorator(csrf_exempt)
    def get(self, request, format=None):
        """
        Get all admin dashboard metrics including performance and system metrics.
        """
        performance_metrics = get_performance_metrics()
        system_metrics = get_system_metrics()
        cache_stats = get_cache_stats()
        
        # Calculate additional derived metrics
        total_requests = performance_metrics.get("total_requests", 0)
        error_count = performance_metrics.get("errors", 0)
        error_rate = (error_count / total_requests * 100) if total_requests > 0 else 0
        
        # Combine all metrics
        dashboard_metrics = {
            "performance": performance_metrics,
            "system": system_metrics,
            "cache": cache_stats,
            "summary": {
                "total_requests": total_requests,
                "error_rate": error_rate,
                "cache_hit_rate": cache_stats.get("hit_rate", 0),
            }
        }
        
        return Response(dashboard_metrics, status=status.HTTP_200_OK)
    
    @method_decorator(csrf_exempt)
    def post(self, request, format=None):
        """
        Execute admin actions like resetting metrics or clearing cache.
        """
        action = request.data.get('action')
        
        if action == 'reset_performance_metrics':
            reset_metrics()
            return Response({"status": "Performance metrics reset successfully"}, 
                            status=status.HTTP_200_OK)
        
        elif action == 'reset_cache_stats':
            reset_cache_stats()
            return Response({"status": "Cache statistics reset successfully"}, 
                            status=status.HTTP_200_OK)
            
        elif action == 'clear_cache':
            success = clear_cache()
            if success:
                return Response({"status": "Cache cleared successfully"}, 
                                status=status.HTTP_200_OK)
            else:
                return Response({"status": "Failed to clear cache"}, 
                                status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                                
        elif action == 'refresh_cache_size':
            entries, size_bytes = estimate_cache_size()
            return Response({
                "status": "Cache size estimated",
                "entries": entries,
                "size_bytes": size_bytes,
                "size_mb": round(size_bytes / (1024 * 1024), 2) if size_bytes > 0 else 0
            }, status=status.HTTP_200_OK)
            
        else:
            return Response({"error": f"Unknown action: {action}"}, 
                            status=status.HTTP_400_BAD_REQUEST)

class PerformanceMetricsView(APIView):
    """
    View for retrieving and managing performance metrics.
    Accessible only to admin users.
    """
    permission_classes = [IsAdminUser]
    
    @method_decorator(csrf_exempt)
    def get(self, request, format=None):
        """Get performance metrics."""
        metrics = get_performance_metrics()
        return Response(metrics, status=status.HTTP_200_OK)
    
    @method_decorator(csrf_exempt)
    def post(self, request, format=None):
        """Reset performance metrics."""
        reset_metrics()
        return Response({"status": "Performance metrics reset successfully"}, 
                        status=status.HTTP_200_OK)

class CacheStatsView(APIView):
    """
    View for retrieving and managing cache statistics.
    Accessible only to admin users.
    """
    permission_classes = [IsAdminUser]
    
    @method_decorator(csrf_exempt)
    def get(self, request, format=None):
        """Get cache statistics."""
        stats = get_cache_stats()
        return Response(stats, status=status.HTTP_200_OK)
    
    @method_decorator(csrf_exempt)
    def post(self, request, format=None):
        """Manage cache actions."""
        action = request.data.get('action')
        
        if action == 'reset_stats':
            reset_cache_stats()
            return Response({"status": "Cache statistics reset successfully"}, 
                            status=status.HTTP_200_OK)
                            
        elif action == 'clear_cache':
            success = clear_cache()
            if success:
                return Response({"status": "Cache cleared successfully"}, 
                                status=status.HTTP_200_OK)
            else:
                return Response({"status": "Failed to clear cache"}, 
                                status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                                
        elif action == 'estimate_size':
            entries, size_bytes = estimate_cache_size()
            return Response({
                "entries": entries,
                "size_bytes": size_bytes,
                "size_mb": round(size_bytes / (1024 * 1024), 2) if size_bytes > 0 else 0
            }, status=status.HTTP_200_OK)
            
        else:
            return Response({"error": f"Unknown action: {action}"}, 
                            status=status.HTTP_400_BAD_REQUEST)

class SystemMetricsView(APIView):
    """
    View for retrieving system metrics.
    Accessible only to admin users.
    """
    permission_classes = [IsAdminUser]
    
    @method_decorator(csrf_exempt)
    def get(self, request, format=None):
        """Get system metrics."""
        metrics = get_system_metrics()
        return Response(metrics, status=status.HTTP_200_OK) 