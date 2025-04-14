# AWS Database Deployment Guide

This guide explains how to set up and deploy the database services for the AI LLM project on AWS.

## 1. Setting up AWS RDS PostgreSQL

### Creating a PostgreSQL Database

1. **Sign in to the AWS Management Console**
   - Navigate to the RDS service.

2. **Create a new database instance**
   - Click "Create database"
   - Choose PostgreSQL as the engine
   - Select PostgreSQL 14.x or newer

3. **Choose the appropriate instance size**
   - For development/testing: `db.t3.small` or `db.t3.medium`
   - For production: `db.m6g.large` or higher based on expected load

4. **Configure storage**
   - Start with 20-50GB for most applications
   - Enable storage autoscaling with a maximum of 100GB

5. **Configure connectivity**
   - Create a new VPC Security Group or use an existing one
   - Make sure to restrict access to your application's VPC
   - Do NOT make it publicly accessible for production deployments

6. **Configure database settings**
   - Database name: `ai_db` (or your preferred name)
   - Username: `postgres` (or your preferred username)
   - Set a strong password

7. **Enable encryption at rest**
   - Use AWS KMS for encryption

8. **Configure backups**
   - Enable automated backups
   - Set an appropriate backup window
   - Retention period: 7 days (or longer for production)

9. **Enable enhanced monitoring**
   - This helps with troubleshooting performance issues

10. **Create the database**
    - Review all settings and create the database

### Security Group Configuration

1. **Configure inbound rules**
   - Allow traffic on port 5432 only from your application instances
   - You can restrict by security group or by CIDR notation if your app servers have static IPs

2. **Configure outbound rules**
   - Allow all outbound traffic (this is the default)

## 2. Setting up AWS ElastiCache Redis

### Creating a Redis Cluster

1. **Navigate to the ElastiCache service**
   - Go to AWS Management Console > ElastiCache

2. **Create a Redis cluster**
   - Click "Create Redis cluster"
   - Choose "Cluster Mode disabled" (unless you need sharding for very high workloads)

3. **Configure cluster settings**
   - Cluster name: `ai-llm-cache`
   - Description: `Cache for AI LLM application`
   - Engine version: Choose the latest stable version (6.x or newer)

4. **Select node type**
   - For development/testing: `cache.t3.small`
   - For production: `cache.m6g.large` or higher based on expected cache size

5. **Configure advanced settings**
   - Number of replicas: 1 (for production) or 0 (for development)
   - Multi-AZ: Enable for production deployments
   - Subnet group: Select or create a subnet group in your VPC
   - Security group: Create or select a security group (same approach as RDS)

6. **Enable encryption**
   - Encryption in transit (required)
   - Encryption at rest (recommended for production)

7. **Backup configuration**
   - Enable automatic backups for production deployments
   - Set a reasonable backup window

8. **Create the cluster**
   - Review and create the cluster

### Security Group Configuration

1. **Configure inbound rules**
   - Allow traffic on port 6379 only from your application instances
   - Restrict by security group or CIDR notation

## 3. Configuring Environment Variables

Add these environment variables to your application environment:

```
# AWS RDS Configuration
USE_AWS_RDS=True
RDS_DB_NAME=ai_db
RDS_USERNAME=postgres
RDS_PASSWORD=your-secure-password
RDS_HOSTNAME=your-db-instance.xxxxxxxxxxxx.region.rds.amazonaws.com
RDS_PORT=5432

# AWS ElastiCache Configuration  
USE_ELASTICACHE=True
ELASTICACHE_ENDPOINT=redis://your-cluster.xxxxxx.region.cache.amazonaws.com:6379/1
```

## 4. Database Migration

Once your RDS instance is set up, you need to apply migrations and create an initial superuser:

```bash
# Apply migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser
```

## 5. Performance Optimization Tips

### RDS PostgreSQL

1. **Use connection pooling**
   - Consider using PgBouncer in front of RDS
   - This reduces the overhead of establishing new connections

2. **Monitor slow queries**
   - Use RDS Performance Insights to identify slow queries
   - Create appropriate indexes based on query patterns

3. **Consider read replicas**
   - For read-heavy workloads, create read replicas
   - Use a database router to direct reads to replicas

### ElastiCache Redis

1. **Cache efficiently**
   - Cache expensive computations, database queries, and API responses
   - Set appropriate TTLs (Time To Live) for cached items
   - Use compression for large items

2. **Monitor memory usage**
   - Keep an eye on memory usage metrics
   - Set up alarms for high memory usage

3. **Use pipeline operations**
   - Batch Redis operations together for better performance

## 6. Security Best Practices

1. **Use AWS Secrets Manager**
   - Store database credentials in AWS Secrets Manager
   - Rotate credentials regularly

2. **Enable SSL/TLS**
   - Enforce SSL connections to both RDS and ElastiCache
   - Verify SSL certificates in your application code

3. **Restrict network access**
   - Use private subnets for database resources
   - Only allow access from application servers

4. **Encrypt sensitive data**
   - Enable encryption at rest for both RDS and ElastiCache
   - Consider field-level encryption for extremely sensitive data

## 7. Monitoring and Maintenance

1. **Set up CloudWatch alarms**
   - Create alarms for CPU, memory, storage, and connection count
   - Set thresholds based on expected usage patterns

2. **Schedule maintenance windows**
   - Configure maintenance windows during low-traffic periods
   - Plan for occasional downtime during major version upgrades

3. **Backup strategy**
   - Test restoring from backups periodically
   - Consider cross-region backup copies for disaster recovery

4. **Scaling strategy**
   - Vertical scaling (instance class upgrades) for sudden growth
   - Consider read replicas and sharding for long-term scalability 