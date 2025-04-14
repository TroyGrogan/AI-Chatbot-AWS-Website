"""
AWS Auto-scaling and Distributed Inference Utilities

This module provides utilities for managing AWS auto-scaling and distributed inference
for the LLM service. It includes:

1. Configuration for EC2 Auto Scaling Groups
2. Functions to set up and manage a ECS cluster for horizontal scaling
3. Functions to monitor and report on distributed inference performance
"""

import boto3
import os
import json
import time
from threading import Thread
from datetime import datetime, timedelta

class AWSScalingManager:
    """
    Manages AWS scaling resources for the LLM service
    """
    def __init__(self):
        self.region = os.environ.get('AWS_REGION', 'us-east-1')
        self.asg_name = os.environ.get('ASG_NAME')
        self.ecs_cluster = os.environ.get('ECS_CLUSTER')
        self.ecs_service = os.environ.get('ECS_SERVICE')
        
        # Initialize AWS clients
        self.ec2 = boto3.client('ec2', region_name=self.region)
        self.autoscaling = boto3.client('autoscaling', region_name=self.region)
        self.ecs = boto3.client('ecs', region_name=self.region)
        self.cloudwatch = boto3.client('cloudwatch', region_name=self.region)
        
        # Store current metrics
        self.current_metrics = {}
        
    def setup_auto_scaling_group(self):
        """
        Create or update an Auto Scaling Group for the LLM service.
        This is typically done during initial deployment, not at runtime.
        """
        # This is just a sketch of the function - implementing this would require
        # more complex CloudFormation or Terraform scripts typically
        print("Setting up Auto Scaling Group for LLM service")
        
        # Example of how you might set up scaling policies
        if self.asg_name:
            try:
                # Create CPU-based scaling policy
                self.autoscaling.put_scaling_policy(
                    AutoScalingGroupName=self.asg_name,
                    PolicyName='CPUUtilizationScalingPolicy',
                    PolicyType='TargetTrackingScaling',
                    TargetTrackingConfiguration={
                        'PredefinedMetricSpecification': {
                            'PredefinedMetricType': 'ASGAverageCPUUtilization'
                        },
                        'TargetValue': 70.0,  # Target CPU utilization percentage
                        'ScaleInCooldown': 300,  # 5 minutes
                        'ScaleOutCooldown': 60   # 1 minute
                    }
                )
                print(f"Created CPU utilization scaling policy for ASG: {self.asg_name}")
                
                # Create memory-based scaling policy (requires custom metric)
                # This would require publishing memory metrics to CloudWatch first
                return True
            except Exception as e:
                print(f"Error setting up Auto Scaling Group: {str(e)}")
                return False
        else:
            print("No Auto Scaling Group name provided")
            return False
    
    def setup_ecs_service(self):
        """
        Set up an ECS service for horizontal scaling of Django application
        """
        # This is also typically done during initial deployment
        if self.ecs_cluster and self.ecs_service:
            try:
                # Update the service to enable auto-scaling
                self.ecs.update_service(
                    cluster=self.ecs_cluster,
                    service=self.ecs_service,
                    desiredCount=2,  # Start with at least 2 instances for high availability
                )
                
                # Register auto-scaling for the ECS service
                # This requires Application Auto Scaling API
                application_autoscaling = boto3.client('application-autoscaling', region_name=self.region)
                
                # Register the ECS service as a scalable target
                application_autoscaling.register_scalable_target(
                    ServiceNamespace='ecs',
                    ResourceId=f'service/{self.ecs_cluster}/{self.ecs_service}',
                    ScalableDimension='ecs:service:DesiredCount',
                    MinCapacity=2,
                    MaxCapacity=10
                )
                
                # Create a scaling policy based on ECS service CPU utilization
                application_autoscaling.put_scaling_policy(
                    PolicyName='ECSServiceCPUUtilizationPolicy',
                    ServiceNamespace='ecs',
                    ResourceId=f'service/{self.ecs_cluster}/{self.ecs_service}',
                    ScalableDimension='ecs:service:DesiredCount',
                    PolicyType='TargetTrackingScaling',
                    TargetTrackingScalingPolicyConfiguration={
                        'TargetValue': 70.0,
                        'PredefinedMetricSpecification': {
                            'PredefinedMetricType': 'ECSServiceAverageCPUUtilization'
                        },
                        'ScaleInCooldown': 300,
                        'ScaleOutCooldown': 60
                    }
                )
                
                print(f"Set up auto-scaling for ECS service: {self.ecs_service}")
                return True
            except Exception as e:
                print(f"Error setting up ECS service: {str(e)}")
                return False
        else:
            print("ECS cluster or service name not provided")
            return False
    
    def get_current_capacity(self):
        """
        Get the current capacity of the auto-scaling resources
        """
        result = {
            'asg_instances': 0,
            'ecs_tasks': 0,
            'last_updated': datetime.now().isoformat()
        }
        
        # Get ASG capacity
        if self.asg_name:
            try:
                asg_response = self.autoscaling.describe_auto_scaling_groups(
                    AutoScalingGroupNames=[self.asg_name]
                )
                if asg_response['AutoScalingGroups']:
                    asg = asg_response['AutoScalingGroups'][0]
                    result['asg_instances'] = len(asg['Instances'])
                    result['asg_desired_capacity'] = asg['DesiredCapacity']
                    result['asg_min_size'] = asg['MinSize']
                    result['asg_max_size'] = asg['MaxSize']
            except Exception as e:
                print(f"Error getting ASG capacity: {str(e)}")
        
        # Get ECS capacity
        if self.ecs_cluster and self.ecs_service:
            try:
                ecs_response = self.ecs.describe_services(
                    cluster=self.ecs_cluster,
                    services=[self.ecs_service]
                )
                if ecs_response['services']:
                    service = ecs_response['services'][0]
                    result['ecs_tasks'] = service['runningCount']
                    result['ecs_desired_count'] = service['desiredCount']
                    result['ecs_pending_count'] = service['pendingCount']
            except Exception as e:
                print(f"Error getting ECS service capacity: {str(e)}")
        
        self.current_metrics.update(result)
        return result
    
    def get_scaling_metrics(self):
        """
        Get metrics relevant to scaling decisions
        """
        # Get CloudWatch metrics for the LLM service
        end_time = datetime.now()
        start_time = end_time - timedelta(minutes=10)
        
        metrics = {}
        
        # Get CPU utilization for the ASG
        if self.asg_name:
            try:
                cpu_response = self.cloudwatch.get_metric_statistics(
                    Namespace='AWS/EC2',
                    MetricName='CPUUtilization',
                    Dimensions=[
                        {
                            'Name': 'AutoScalingGroupName',
                            'Value': self.asg_name
                        }
                    ],
                    StartTime=start_time,
                    EndTime=end_time,
                    Period=60,
                    Statistics=['Average']
                )
                
                if cpu_response['Datapoints']:
                    latest_point = sorted(cpu_response['Datapoints'], key=lambda x: x['Timestamp'])[-1]
                    metrics['asg_cpu_utilization'] = latest_point['Average']
            except Exception as e:
                print(f"Error getting ASG CPU metrics: {str(e)}")
        
        # Get custom LLM metrics
        try:
            llm_metrics_response = self.cloudwatch.get_metric_statistics(
                Namespace='LLM/Resources',
                MetricName='CPUUtilization',
                Dimensions=[
                    {
                        'Name': 'ServiceName',
                        'Value': 'LLMService'
                    }
                ],
                StartTime=start_time,
                EndTime=end_time,
                Period=60,
                Statistics=['Average', 'Maximum']
            )
            
            if llm_metrics_response['Datapoints']:
                latest_point = sorted(llm_metrics_response['Datapoints'], key=lambda x: x['Timestamp'])[-1]
                metrics['llm_cpu_utilization_avg'] = latest_point['Average']
                metrics['llm_cpu_utilization_max'] = latest_point['Maximum']
        except Exception as e:
            print(f"Error getting LLM custom metrics: {str(e)}")
        
        self.current_metrics.update(metrics)
        return metrics
    
    def should_scale_out(self):
        """
        Determine if the service should scale out based on metrics
        """
        # Get latest metrics
        self.get_current_capacity()
        self.get_scaling_metrics()
        
        # Check CPU utilization
        cpu_high = self.current_metrics.get('llm_cpu_utilization_avg', 0) > 70
        
        # Check if we're already at maximum capacity
        at_max_capacity = False
        if self.asg_name and 'asg_desired_capacity' in self.current_metrics:
            at_max_capacity = (self.current_metrics['asg_desired_capacity'] >= 
                              self.current_metrics['asg_max_size'])
        
        # Check if there are pending scaling actions
        has_pending_actions = False
        if self.ecs_cluster and self.ecs_service:
            has_pending_actions = (self.current_metrics.get('ecs_pending_count', 0) > 0)
        
        # Decision logic
        should_scale = cpu_high and not at_max_capacity and not has_pending_actions
        
        if should_scale:
            print("Recommending scale out based on high CPU utilization")
        
        return should_scale
    
    def should_scale_in(self):
        """
        Determine if the service should scale in based on metrics
        """
        # Get latest metrics
        self.get_current_capacity()
        self.get_scaling_metrics()
        
        # Check CPU utilization (low for scale in)
        cpu_low = self.current_metrics.get('llm_cpu_utilization_avg', 100) < 30
        
        # Check if we're already at minimum capacity
        at_min_capacity = False
        if self.asg_name and 'asg_desired_capacity' in self.current_metrics:
            at_min_capacity = (self.current_metrics['asg_desired_capacity'] <= 
                              self.current_metrics['asg_min_size'])
        
        # Check if there are pending scaling actions
        has_pending_actions = False
        if self.ecs_cluster and self.ecs_service:
            has_pending_actions = (self.current_metrics.get('ecs_pending_count', 0) > 0)
        
        # Decision logic - don't scale in if at minimum or if already scaling
        should_scale = cpu_low and not at_min_capacity and not has_pending_actions
        
        if should_scale:
            print("Recommending scale in based on low CPU utilization")
        
        return should_scale

# Create a global instance for use throughout the application
aws_scaling_manager = AWSScalingManager()

def setup_aws_auto_scaling():
    """
    Set up AWS auto-scaling for the application
    """
    # This could be called during Django's AppConfig.ready() method
    manager = aws_scaling_manager
    
    # Start a background thread to monitor and manage scaling
    def monitor_scaling():
        while True:
            try:
                manager.get_current_capacity()
                manager.get_scaling_metrics()
                
                # Log current state
                print(f"Current scaling state: {json.dumps(manager.current_metrics)}")
                
                # Sleep for 1 minute before checking again
                time.sleep(60)
            except Exception as e:
                print(f"Error in scaling monitor: {str(e)}")
                time.sleep(120)  # Wait longer if there was an error
    
    scaling_thread = Thread(target=monitor_scaling, daemon=True)
    scaling_thread.start()
    print("Started AWS scaling monitoring thread")
    
    return manager 