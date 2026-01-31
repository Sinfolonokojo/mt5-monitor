# AWS Learning Plan for MT5 Monitor

## System Context

| Metric | Current Value |
|--------|---------------|
| VPS Agents | 10 (VPS1-VPS10) |
| MT5 Accounts | ~10-30 accounts |
| API Requests | ~8,640/day (1 req/10min × 10 agents × 6/hr × 24hr) |
| Data Storage | ~5-50 MB (JSON files) |
| Trade History | ~1,000-10,000 trades/month |
| Frontend Users | 1-5 concurrent |

---

## Phase 1: AWS Foundations & Frontend Migration

### Duration: 1-2 Weeks
### Difficulty: ⭐⭐ (Beginner)

#### What You'll Learn
- AWS Account setup and IAM best practices
- S3 static website hosting
- CloudFront CDN configuration
- Route 53 DNS (optional)

#### Tasks

| Task | Time | Description |
|------|------|-------------|
| AWS Account Setup | 2 hrs | Create account, enable MFA, create IAM user |
| S3 Bucket Creation | 1 hr | Create bucket, configure static hosting |
| Upload Frontend | 1 hr | Build React app, upload to S3 |
| CloudFront Setup | 2 hrs | Create distribution, configure SSL |
| DNS Configuration | 1 hr | (Optional) Connect custom domain |
| **Total** | **7 hrs** | |

#### Monthly Cost Estimate

| Service | Usage | Cost |
|---------|-------|------|
| S3 Storage | 50 MB | $0.00 (free tier) |
| S3 Requests | 100,000 GET/month | $0.00 (free tier) |
| CloudFront | 50 GB transfer | $0.00 (free tier first year) |
| Route 53 | 1 hosted zone | $0.50/month |
| **Total** | | **$0.50/month** |

#### Resources
- [AWS Free Tier](https://aws.amazon.com/free/)
- [S3 Static Website Tutorial](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)
- [CloudFront + S3 Tutorial](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/GettingStarted.SimpleDistribution.html)

---

## Phase 2: Centralized Logging & Monitoring

### Duration: 1-2 Weeks
### Difficulty: ⭐⭐ (Beginner-Intermediate)

#### What You'll Learn
- CloudWatch Logs agent installation
- Log groups and retention policies
- CloudWatch Metrics and Dashboards
- SNS notifications and alerting

#### Tasks

| Task | Time | Description |
|------|------|-------------|
| CloudWatch Agent on VPS1 | 2 hrs | Install agent, configure log streaming |
| Log Group Setup | 1 hr | Create log groups for main-backend |
| Dashboard Creation | 2 hrs | Build monitoring dashboard |
| SNS Topic Setup | 1 hr | Create topic, add email subscribers |
| CloudWatch Alarms | 2 hrs | Set up alerts for errors, agent failures |
| Extend to VPS2-10 | 3 hrs | Deploy CloudWatch agent to all VPS |
| **Total** | **11 hrs** | |

#### Monthly Cost Estimate

| Service | Usage | Cost |
|---------|-------|------|
| CloudWatch Logs Ingestion | 5 GB/month | $2.50 |
| CloudWatch Logs Storage | 5 GB (30 days) | $0.15 |
| CloudWatch Metrics | 10 custom metrics | $0.00 (free tier) |
| CloudWatch Dashboards | 1 dashboard | $0.00 (first 3 free) |
| SNS | 100 email notifications | $0.00 (free tier) |
| **Total** | | **~$3/month** |

#### Log Configuration Example
```python
# main-backend/app/cloudwatch_logger.py
import watchtower
import logging

# Stream logs to CloudWatch
handler = watchtower.CloudWatchLogHandler(
    log_group='mt5-monitor',
    stream_name='main-backend'
)
logger = logging.getLogger()
logger.addHandler(handler)
```

---

## Phase 3: Database Migration (DynamoDB)

### Duration: 2-3 Weeks
### Difficulty: ⭐⭐⭐ (Intermediate)

#### What You'll Learn
- DynamoDB table design and partition keys
- Python boto3 SDK
- On-demand vs provisioned capacity
- DynamoDB Streams (optional)

#### Tasks

| Task | Time | Description |
|------|------|-------------|
| DynamoDB Basics | 3 hrs | Learn concepts, create first table |
| Phases Table | 4 hrs | Migrate `phases.json` to DynamoDB |
| VS Groups Table | 3 hrs | Migrate `vs_data.json` to DynamoDB |
| Trade Cache Table | 6 hrs | Migrate `trade_cache.json` (complex) |
| Update Backend Code | 6 hrs | Replace file managers with DynamoDB |
| Testing & Validation | 4 hrs | Ensure data integrity |
| **Total** | **26 hrs** | |

#### Table Designs

**Table: mt5_phases**
```
Partition Key: account_number (String)
Attributes: phase, updated_at, updated_by
```

**Table: mt5_vs_groups**
```
Partition Key: account_number (String)
Attributes: vs_group, updated_at
GSI: vs_group-index (for querying accounts by group)
```

**Table: mt5_trade_cache**
```
Partition Key: account_number (String)
Sort Key: position_id (String)
Attributes: trade_data, profit, close_time, sync_time
```

#### Monthly Cost Estimate

| Service | Usage | Cost |
|---------|-------|------|
| DynamoDB Storage | 100 MB | $0.025 |
| DynamoDB Writes | 100,000 WCU/month | $0.00 (free tier: 25 WCU) |
| DynamoDB Reads | 500,000 RCU/month | $0.00 (free tier: 25 RCU) |
| On-Demand Reads | 1M requests | $0.25 |
| On-Demand Writes | 500K requests | $0.625 |
| **Total (On-Demand)** | | **~$1-5/month** |

#### Code Example
```python
# main-backend/app/dynamodb_phase_manager.py
import boto3
from datetime import datetime

class DynamoDBPhaseManager:
    def __init__(self):
        self.dynamodb = boto3.resource('dynamodb')
        self.table = self.dynamodb.Table('mt5_phases')

    def get_phase(self, account_number: str) -> str:
        response = self.table.get_item(Key={'account_number': account_number})
        return response.get('Item', {}).get('phase', 'F1')

    def set_phase(self, account_number: str, phase: str):
        self.table.put_item(Item={
            'account_number': account_number,
            'phase': phase,
            'updated_at': datetime.utcnow().isoformat()
        })
```

---

## Phase 4: Caching with ElastiCache (Redis)

### Duration: 1-2 Weeks
### Difficulty: ⭐⭐⭐ (Intermediate)

#### What You'll Learn
- Redis basics and data structures
- ElastiCache cluster configuration
- VPC networking and security groups
- Cache invalidation strategies

#### Tasks

| Task | Time | Description |
|------|------|-------------|
| VPC Setup | 2 hrs | Create VPC, subnets, security groups |
| ElastiCache Cluster | 2 hrs | Create Redis cluster |
| VPN/Bastion Setup | 3 hrs | Connect VPS to AWS VPC |
| Migrate Cache Code | 4 hrs | Replace SimpleCache with Redis |
| Testing | 2 hrs | Validate cache behavior |
| **Total** | **13 hrs** | |

#### Monthly Cost Estimate

| Service | Usage | Cost |
|---------|-------|------|
| ElastiCache (cache.t3.micro) | 1 node, 24/7 | $12.41/month |
| Data Transfer | Minimal | ~$1/month |
| **Total** | | **~$13-15/month** |

> **Note:** This is the most expensive component. Consider using DynamoDB DAX or skip this phase initially.

#### Alternative: DynamoDB DAX
If cost is a concern, use DynamoDB Accelerator (DAX) instead:
- Integrates directly with DynamoDB
- $0.00 for first 750 hrs/month (free tier)
- Simpler setup, no VPC required

---

## Phase 5: Authentication with Cognito

### Duration: 2-3 Weeks
### Difficulty: ⭐⭐⭐⭐ (Intermediate-Advanced)

#### What You'll Learn
- User pools and identity pools
- JWT tokens and validation
- OAuth 2.0 / OpenID Connect
- Frontend authentication flows

#### Tasks

| Task | Time | Description |
|------|------|-------------|
| Cognito User Pool | 2 hrs | Create user pool, configure settings |
| App Client Setup | 1 hr | Create app client for frontend |
| Frontend Integration | 6 hrs | Add login/logout with AWS Amplify |
| Backend JWT Validation | 4 hrs | Validate tokens in FastAPI |
| Protected Routes | 3 hrs | Add authorization to endpoints |
| User Management | 2 hrs | Admin features, password reset |
| **Total** | **18 hrs** | |

#### Monthly Cost Estimate

| Service | Usage | Cost |
|---------|-------|------|
| Cognito MAU | 5 users | $0.00 (first 50,000 free) |
| Cognito Advanced | Not used | $0.00 |
| **Total** | | **$0.00** |

#### Frontend Integration Example
```javascript
// frontend/src/services/auth.js
import { Amplify } from 'aws-amplify';
import { signIn, signOut, getCurrentUser } from 'aws-amplify/auth';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_xxxxx',
      userPoolClientId: 'xxxxx'
    }
  }
});

export const login = async (username, password) => {
  return await signIn({ username, password });
};
```

---

## Phase 6: Secrets Management

### Duration: 3-5 Days
### Difficulty: ⭐⭐ (Beginner)

#### What You'll Learn
- AWS Secrets Manager
- Secret rotation
- IAM roles for EC2/Lambda
- Environment variable best practices

#### Tasks

| Task | Time | Description |
|------|------|-------------|
| Create Secrets | 1 hr | Store VPS credentials, API keys |
| Update Backend | 3 hrs | Fetch secrets from Secrets Manager |
| IAM Role Setup | 2 hrs | Create role for backend service |
| Remove .env Secrets | 1 hr | Clean up hardcoded secrets |
| **Total** | **7 hrs** | |

#### Monthly Cost Estimate

| Service | Usage | Cost |
|---------|-------|------|
| Secrets Manager | 5 secrets | $2.00 |
| API Calls | 10,000/month | $0.05 |
| **Total** | | **~$2/month** |

---

## Phase 7: API Gateway (Optional)

### Duration: 1-2 Weeks
### Difficulty: ⭐⭐⭐ (Intermediate)

#### What You'll Learn
- REST API Gateway setup
- Rate limiting and throttling
- API keys and usage plans
- Request/response transformation

#### Tasks

| Task | Time | Description |
|------|------|-------------|
| Create REST API | 2 hrs | Define resources and methods |
| Lambda Integration | 4 hrs | (Optional) Migrate endpoints to Lambda |
| HTTP Integration | 3 hrs | Proxy to existing FastAPI backend |
| Rate Limiting | 2 hrs | Configure usage plans |
| Custom Domain | 2 hrs | Connect API to custom domain |
| **Total** | **13 hrs** | |

#### Monthly Cost Estimate

| Service | Usage | Cost |
|---------|-------|------|
| API Gateway | 1M requests | $0.00 (free tier first year) |
| After Free Tier | 1M requests | $3.50/month |
| **Total** | | **$0-3.50/month** |

---

## Phase 8: Message Queue (SQS) for Trading

### Duration: 1-2 Weeks
### Difficulty: ⭐⭐⭐⭐ (Advanced)

#### What You'll Learn
- Message queue patterns
- Async processing with workers
- Dead letter queues
- Exactly-once vs at-least-once delivery

#### Tasks

| Task | Time | Description |
|------|------|-------------|
| SQS Queue Setup | 1 hr | Create queues for trade operations |
| Producer Code | 3 hrs | Send trade requests to queue |
| Consumer Worker | 5 hrs | Process trade messages |
| Dead Letter Queue | 2 hrs | Handle failed trades |
| Testing & Monitoring | 3 hrs | Validate reliability |
| **Total** | **14 hrs** | |

#### Monthly Cost Estimate

| Service | Usage | Cost |
|---------|-------|------|
| SQS | 1M requests | $0.00 (first 1M free) |
| **Total** | | **$0.00** |

---

## Complete Cost Summary

### Monthly Costs by Phase

| Phase | Service | Monthly Cost |
|-------|---------|--------------|
| 1 | S3 + CloudFront | $0.50 |
| 2 | CloudWatch | $3.00 |
| 3 | DynamoDB | $2.00 |
| 4 | ElastiCache Redis | $13.00 |
| 5 | Cognito | $0.00 |
| 6 | Secrets Manager | $2.00 |
| 7 | API Gateway | $0.00 |
| 8 | SQS | $0.00 |
| **Total (All Phases)** | | **~$20.50/month** |

### Budget-Conscious Path (Skip Phase 4)

| Phase | Service | Monthly Cost |
|-------|---------|--------------|
| 1-3, 5-8 | All except ElastiCache | **~$7.50/month** |

### First Year with Free Tier

| Period | Estimated Cost |
|--------|---------------|
| Months 1-12 | $3-10/month (free tier benefits) |
| After Year 1 | $15-25/month |

---

## Time Investment Summary

### By Phase

| Phase | Focus | Hours | Calendar Time |
|-------|-------|-------|---------------|
| 1 | Frontend + S3 | 7 hrs | 1-2 weeks |
| 2 | Logging + Monitoring | 11 hrs | 1-2 weeks |
| 3 | DynamoDB | 26 hrs | 2-3 weeks |
| 4 | ElastiCache | 13 hrs | 1-2 weeks |
| 5 | Authentication | 18 hrs | 2-3 weeks |
| 6 | Secrets | 7 hrs | 3-5 days |
| 7 | API Gateway | 13 hrs | 1-2 weeks |
| 8 | SQS | 14 hrs | 1-2 weeks |
| **Total** | | **109 hrs** | **12-18 weeks** |

### Realistic Schedule (Part-time: 10 hrs/week)

| Month | Phases | Focus |
|-------|--------|-------|
| Month 1 | 1-2 | Frontend migration, logging |
| Month 2 | 3 | DynamoDB migration |
| Month 3 | 4-5 | Caching, authentication |
| Month 4 | 6-8 | Secrets, API Gateway, SQS |

### Intensive Schedule (Full-time: 40 hrs/week)

| Week | Phases | Focus |
|------|--------|-------|
| Week 1-2 | 1-2 | Frontend, logging |
| Week 3-4 | 3 | DynamoDB |
| Week 5 | 4 | ElastiCache |
| Week 6-7 | 5 | Authentication |
| Week 8 | 6-8 | Final integrations |

---

## Recommended Learning Order

### Priority 1: High Value, Low Cost (Start Here)
1. **Phase 2: CloudWatch** - Immediate visibility into your system
2. **Phase 3: DynamoDB** - Replace fragile JSON files
3. **Phase 6: Secrets Manager** - Security improvement

### Priority 2: Nice to Have
4. **Phase 1: S3 + CloudFront** - Better than Vercel for AWS learning
5. **Phase 5: Cognito** - Add user authentication

### Priority 3: Advanced (When Ready)
6. **Phase 7: API Gateway** - Production-grade API management
7. **Phase 8: SQS** - Reliable trade processing
8. **Phase 4: ElastiCache** - Skip unless you have latency issues

---

## AWS Certifications Path

If you want to formalize your learning:

| Certification | Relevance | Study Time |
|---------------|-----------|------------|
| AWS Cloud Practitioner | Foundation | 20-40 hrs |
| AWS Solutions Architect Associate | Best for this project | 80-120 hrs |
| AWS Developer Associate | Good for coding focus | 60-100 hrs |

---

## Free Learning Resources

1. **AWS Free Tier** - 12 months of free services
   - https://aws.amazon.com/free/

2. **AWS Skill Builder** - Free courses
   - https://skillbuilder.aws/

3. **AWS Workshops** - Hands-on labs
   - https://workshops.aws/

4. **YouTube: AWS Official Channel**
   - https://www.youtube.com/c/amazonwebservices

5. **freeCodeCamp AWS Course**
   - 10+ hour free course on YouTube

---

## Next Steps

1. **Create AWS Account** with MFA enabled
2. **Start with Phase 2** (CloudWatch) for immediate value
3. **Join AWS Discord/Reddit** communities for support
4. **Set billing alerts** at $5, $10, $20 thresholds

---

*Document created: 2026-01-31*
*System: MT5 Monitor with 10 VPS agents*
