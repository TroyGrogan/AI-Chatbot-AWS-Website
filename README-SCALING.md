# Advanced Scaling for LLM Service

This document explains how to use the advanced scaling features in the LLM service, including model caching, serverless offloading, auto-scaling, and distributed inference.

## 1. Model Caching

The LLM service uses RAM caching to improve performance through the `LlamaRAMCache` feature of llama.cpp. The cache stores previously computed key-value pairs from the model to avoid redundant computation for repeated tokens.

### Configuration

Set the cache size through environment variables:

```bash
CACHE_SIZE_GB=4  # Cache size in gigabytes
```

## 2. Resource Monitoring and Serverless Offloading

The service monitors CPU and memory usage and can offload inference to serverless functions when resources are constrained.

### Configuration

```bash
# Resource thresholds for offloading
CPU_THRESHOLD=80
MEMORY_THRESHOLD=80
ENABLE_CLOUDWATCH_METRICS=True

# Serverless endpoints for offloading
SERVERLESS_INFERENCE_ENDPOINT=my-sagemaker-endpoint
SERVERLESS_INFERENCE_LAMBDA=my-lambda-function
```

### How it works

1. A background thread continuously monitors CPU and memory usage
2. If usage exceeds thresholds, requests are offloaded to serverless functions
3. If CloudWatch metrics are enabled, metrics are sent to AWS CloudWatch

## 3. Auto-scaling with AWS

The service can integrate with AWS Auto Scaling Groups and ECS for horizontal scaling.

### Configuration

```bash
# AWS auto-scaling settings
AWS_REGION=us-east-1
ASG_NAME=my-asg
ECS_CLUSTER=my-cluster
ECS_SERVICE=my-service
```

### How it works

1. The `AWSScalingManager` monitors resource usage and scaling metrics
2. It can integrate with EC2 Auto Scaling Groups for vertical scaling
3. It can integrate with ECS for horizontal scaling of the Django application

## 4. Distributed Inference

The service supports distributing inference across multiple instances for increased throughput and redundancy.

### Configuration

```bash
# Distributed inference settings
SERVICE_DISCOVERY_NAME=llm-service
ENABLE_DISTRIBUTED_INFERENCE=True
```

### How it works

1. Uses AWS Cloud Map for service discovery to find other LLM service instances
2. Distributes inference requests across available nodes based on load
3. Can use redundant processing for critical requests
4. Supports SageMaker and Lambda as additional inference targets

## 5. Full Example Docker Compose

```yaml
version: '3'
services:
  llm-service:
    build: .
    environment:
      # AWS Configuration
      AWS_REGION: us-east-1
      AWS_S3_BUCKET_NAME: ai-llm-models
      
      # Caching and Resource Monitoring
      CACHE_SIZE_GB: 4
      CPU_THRESHOLD: 75
      MEMORY_THRESHOLD: 80
      ENABLE_CLOUDWATCH_METRICS: "True"
      
      # Serverless Settings
      SERVERLESS_INFERENCE_ENDPOINT: my-sagemaker-endpoint
      
      # Distributed Inference
      SERVICE_DISCOVERY_NAME: llm-service
      ENABLE_DISTRIBUTED_INFERENCE: "True"
    ports:
      - "8000:8000"
```

## 6. Using with AWS ECS, EC2, or Lambda

This service is designed to work well in AWS environments:

### EC2 with Auto Scaling Group

1. Create an EC2 Launch Template with the application pre-installed
2. Create an Auto Scaling Group using the template
3. Set up CloudWatch Alarms to trigger scaling based on CPU/memory
4. Set the ASG_NAME environment variable to enable integration

### ECS with Auto Scaling

1. Create an ECS Cluster with the application container
2. Enable Service Auto Scaling in ECS
3. Set the ECS_CLUSTER and ECS_SERVICE environment variables

### SageMaker for Inference

1. Package the LLM model for SageMaker
2. Deploy to a SageMaker endpoint
3. Configure SAGEMAKER_ENDPOINT to enable offloading 