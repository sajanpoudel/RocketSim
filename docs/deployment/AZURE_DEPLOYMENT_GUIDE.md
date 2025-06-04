# Complete Azure Deployment Guide for Rocket-Cursor AI

## Architecture Overview

This guide will deploy your Rocket-Cursor AI application to Azure using:
- **Azure Container Apps** for hosting containerized services
- **Azure Container Registry** for storing Docker images
- **Azure Application Gateway** for load balancing and SSL termination
- **Azure Redis Cache** for caching (alternative to Upstash)
- **Azure Key Vault** for secrets management
- **Azure CDN** for static asset delivery
- **GitHub Actions** for CI/CD

## Prerequisites

### 1. Azure CLI Setup
```bash
# Install Azure CLI (if not already installed)
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Login to Azure
az login

# Set your subscription (replace with your subscription ID)
az account set --subscription "your-subscription-id"
```

### 2. Required Environment Variables
Create a `.env.azure` file:
```env
# Azure Configuration
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_RESOURCE_GROUP=rocket-cursor-rg
AZURE_LOCATION=eastus
AZURE_CONTAINER_REGISTRY=rocketcursoracr
AZURE_CONTAINER_APP_ENV=rocket-cursor-env

# Application Configuration
OPENAI_API_KEY=your-openai-key
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key
NEXT_PUBLIC_OPENWEATHER_API_KEY=your-weather-key
WEATHERAPI_KEY=your-weather-api-key
NEXT_PUBLIC_NOAA_API_KEY=your-noaa-key
```

## Step 1: Azure Infrastructure Setup

### 1.1 Create Resource Group
```bash
az group create \
  --name rocket-cursor-rg \
  --location eastus
```

### 1.2 Create Azure Container Registry
```bash
az acr create \
  --resource-group rocket-cursor-rg \
  --name rocketcursoracr \
  --sku Standard \
  --admin-enabled true
```

### 1.3 Create Azure Container Apps Environment
```bash
# Create Log Analytics workspace
az monitor log-analytics workspace create \
  --resource-group rocket-cursor-rg \
  --workspace-name rocket-cursor-logs \
  --location eastus

# Get workspace ID and key
WORKSPACE_ID=$(az monitor log-analytics workspace show \
  --resource-group rocket-cursor-rg \
  --workspace-name rocket-cursor-logs \
  --query customerId -o tsv)

WORKSPACE_KEY=$(az monitor log-analytics workspace get-shared-keys \
  --resource-group rocket-cursor-rg \
  --workspace-name rocket-cursor-logs \
  --query primarySharedKey -o tsv)

# Create Container Apps environment
az containerapp env create \
  --name rocket-cursor-env \
  --resource-group rocket-cursor-rg \
  --location eastus \
  --logs-workspace-id $WORKSPACE_ID \
  --logs-workspace-key $WORKSPACE_KEY
```

### 1.4 Create Azure Redis Cache
```bash
az redis create \
  --location eastus \
  --name rocket-cursor-redis \
  --resource-group rocket-cursor-rg \
  --sku Standard \
  --vm-size c1
```

### 1.5 Create Azure Key Vault
```bash
az keyvault create \
  --name rocket-cursor-kv \
  --resource-group rocket-cursor-rg \
  --location eastus
```

## Step 2: Store Secrets in Key Vault

```bash
# Store all secrets
az keyvault secret set --vault-name rocket-cursor-kv --name "OPENAI-API-KEY" --value "your-openai-key"
az keyvault secret set --vault-name rocket-cursor-kv --name "SUPABASE-URL" --value "your-supabase-url"
az keyvault secret set --vault-name rocket-cursor-kv --name "SUPABASE-ANON-KEY" --value "your-supabase-anon-key"
az keyvault secret set --vault-name rocket-cursor-kv --name "SUPABASE-SERVICE-KEY" --value "your-supabase-service-key"
az keyvault secret set --vault-name rocket-cursor-kv --name "OPENWEATHER-API-KEY" --value "your-weather-key"
az keyvault secret set --vault-name rocket-cursor-kv --name "WEATHERAPI-KEY" --value "your-weather-api-key"
az keyvault secret set --vault-name rocket-cursor-kv --name "NOAA-API-KEY" --value "your-noaa-key"

# Get Redis connection string
REDIS_KEY=$(az redis list-keys --name rocket-cursor-redis --resource-group rocket-cursor-rg --query primaryKey -o tsv)
REDIS_URL="rocket-cursor-redis.redis.cache.windows.net:6380"
az keyvault secret set --vault-name rocket-cursor-kv --name "REDIS-URL" --value "$REDIS_URL"
az keyvault secret set --vault-name rocket-cursor-kv --name "REDIS-TOKEN" --value "$REDIS_KEY"
```

## Step 3: Build and Push Docker Images

### 3.1 Login to ACR
```bash
az acr login --name rocketcursoracr
```

### 3.2 Build and Push Images
```bash
# Get ACR login server
ACR_LOGIN_SERVER=$(az acr show --name rocketcursoracr --resource-group rocket-cursor-rg --query loginServer -o tsv)

# Build and push frontend
docker build -t $ACR_LOGIN_SERVER/rocket-web:latest .
docker push $ACR_LOGIN_SERVER/rocket-web:latest

# Build and push agentpy service
docker build -t $ACR_LOGIN_SERVER/rocket-agentpy:latest ./services/agentpy
docker push $ACR_LOGIN_SERVER/rocket-agentpy:latest

# Build and push rocketpy service
docker build -t $ACR_LOGIN_SERVER/rocket-rocketpy:latest ./services/rocketpy
docker push $ACR_LOGIN_SERVER/rocket-rocketpy:latest
```

## Step 4: Deploy Container Apps

### 4.1 Create Container App YAML Configurations

Create `azure-deploy/rocketpy-app.yaml`:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: rocketpy-config
data:
  app.yaml: |
    location: eastus
    resourceGroup: rocket-cursor-rg
    name: rocket-rocketpy
    type: Microsoft.App/containerApps
    properties:
      environmentId: /subscriptions/{subscription-id}/resourceGroups/rocket-cursor-rg/providers/Microsoft.App/managedEnvironments/rocket-cursor-env
      configuration:
        activeRevisionsMode: single
        ingress:
          external: false
          targetPort: 8000
          transport: http
        registries:
          - server: rocketcursoracr.azurecr.io
            username: rocketcursoracr
        secrets:
          - name: registry-password
            value: {acr-password}
      template:
        containers:
          - image: rocketcursoracr.azurecr.io/rocket-rocketpy:latest
            name: rocketpy
            resources:
              cpu: 1.0
              memory: 2Gi
            env:
              - name: PYTHONPATH
                value: /app
              - name: PYTHONUNBUFFERED
                value: "1"
        scale:
          minReplicas: 1
          maxReplicas: 3
```

### 4.2 Deploy RocketPy Service
```bash
az containerapp create \
  --name rocket-rocketpy \
  --resource-group rocket-cursor-rg \
  --environment rocket-cursor-env \
  --image rocketcursoracr.azurecr.io/rocket-rocketpy:latest \
  --target-port 8000 \
  --ingress internal \
  --registry-server rocketcursoracr.azurecr.io \
  --cpu 1.0 \
  --memory 2Gi \
  --min-replicas 1 \
  --max-replicas 3 \
  --env-vars PYTHONPATH=/app PYTHONUNBUFFERED=1
```

### 4.3 Deploy AgentPy Service
```bash
az containerapp create \
  --name rocket-agentpy \
  --resource-group rocket-cursor-rg \
  --environment rocket-cursor-env \
  --image rocketcursoracr.azurecr.io/rocket-agentpy:latest \
  --target-port 8002 \
  --ingress internal \
  --registry-server rocketcursoracr.azurecr.io \
  --cpu 0.5 \
  --memory 1Gi \
  --min-replicas 1 \
  --max-replicas 5 \
  --env-vars PYTHONPATH=/app PYTHONUNBUFFERED=1 \
  --secrets openai-api-key=keyvaultref:https://rocket-cursor-kv.vault.azure.net/secrets/OPENAI-API-KEY \
  --env-vars OPENAI_API_KEY=secretref:openai-api-key
```

### 4.4 Deploy Web Frontend
```bash
# Get internal URLs for backend services
AGENTPY_URL=$(az containerapp show --name rocket-agentpy --resource-group rocket-cursor-rg --query properties.configuration.ingress.fqdn -o tsv)
ROCKETPY_URL=$(az containerapp show --name rocket-rocketpy --resource-group rocket-cursor-rg --query properties.configuration.ingress.fqdn -o tsv)

az containerapp create \
  --name rocket-web \
  --resource-group rocket-cursor-rg \
  --environment rocket-cursor-env \
  --image rocketcursoracr.azurecr.io/rocket-web:latest \
  --target-port 3000 \
  --ingress external \
  --registry-server rocketcursoracr.azurecr.io \
  --cpu 0.5 \
  --memory 1Gi \
  --min-replicas 1 \
  --max-replicas 10 \
  --env-vars NODE_ENV=production \
    AGENT_URL=https://$AGENTPY_URL \
    ROCKETPY_URL=https://$ROCKETPY_URL \
  --secrets \
    supabase-url=keyvaultref:https://rocket-cursor-kv.vault.azure.net/secrets/SUPABASE-URL \
    supabase-anon-key=keyvaultref:https://rocket-cursor-kv.vault.azure.net/secrets/SUPABASE-ANON-KEY \
    supabase-service-key=keyvaultref:https://rocket-cursor-kv.vault.azure.net/secrets/SUPABASE-SERVICE-KEY \
    openweather-key=keyvaultref:https://rocket-cursor-kv.vault.azure.net/secrets/OPENWEATHER-API-KEY \
    weather-api-key=keyvaultref:https://rocket-cursor-kv.vault.azure.net/secrets/WEATHERAPI-KEY \
    noaa-key=keyvaultref:https://rocket-cursor-kv.vault.azure.net/secrets/NOAA-API-KEY \
    redis-url=keyvaultref:https://rocket-cursor-kv.vault.azure.net/secrets/REDIS-URL \
    redis-token=keyvaultref:https://rocket-cursor-kv.vault.azure.net/secrets/REDIS-TOKEN \
  --env-vars \
    NEXT_PUBLIC_SUPABASE_URL=secretref:supabase-url \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=secretref:supabase-anon-key \
    SUPABASE_SERVICE_ROLE_KEY=secretref:supabase-service-key \
    NEXT_PUBLIC_OPENWEATHER_API_KEY=secretref:openweather-key \
    WEATHERAPI_KEY=secretref:weather-api-key \
    NEXT_PUBLIC_NOAA_API_KEY=secretref:noaa-key \
    UPSTASH_REDIS_REST_URL=secretref:redis-url \
    UPSTASH_REDIS_REST_TOKEN=secretref:redis-token
```

## Step 5: Setup Custom Domain and SSL (Optional)

### 5.1 Add Custom Domain
```bash
# Add custom domain to container app
az containerapp hostname add \
  --hostname yourdomain.com \
  --name rocket-web \
  --resource-group rocket-cursor-rg
```

### 5.2 Configure SSL Certificate
```bash
# Create managed certificate
az containerapp ssl upload \
  --name rocket-web \
  --resource-group rocket-cursor-rg \
  --hostname yourdomain.com \
  --certificate-file /path/to/certificate.pfx \
  --password "certificate-password"
```

## Step 6: GitHub Actions CI/CD Pipeline

Create `.github/workflows/azure-deploy.yml`:
```yaml
name: Deploy to Azure Container Apps

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  AZURE_CONTAINER_REGISTRY: rocketcursoracr
  RESOURCE_GROUP: rocket-cursor-rg

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Log in to Azure
      uses: azure/login@v1
      with:
        creds: ${{ secrets.AZURE_CREDENTIALS }}

    - name: Log in to Container Registry
      run: az acr login --name ${{ env.AZURE_CONTAINER_REGISTRY }}

    - name: Build and push images
      run: |
        # Get ACR login server
        ACR_LOGIN_SERVER=$(az acr show --name ${{ env.AZURE_CONTAINER_REGISTRY }} --resource-group ${{ env.RESOURCE_GROUP }} --query loginServer -o tsv)
        
        # Build and push frontend
        docker build -t $ACR_LOGIN_SERVER/rocket-web:${{ github.sha }} .
        docker push $ACR_LOGIN_SERVER/rocket-web:${{ github.sha }}
        
        # Build and push agentpy
        docker build -t $ACR_LOGIN_SERVER/rocket-agentpy:${{ github.sha }} ./services/agentpy
        docker push $ACR_LOGIN_SERVER/rocket-agentpy:${{ github.sha }}
        
        # Build and push rocketpy
        docker build -t $ACR_LOGIN_SERVER/rocket-rocketpy:${{ github.sha }} ./services/rocketpy
        docker push $ACR_LOGIN_SERVER/rocket-rocketpy:${{ github.sha }}

    - name: Deploy to Container Apps
      run: |
        ACR_LOGIN_SERVER=$(az acr show --name ${{ env.AZURE_CONTAINER_REGISTRY }} --resource-group ${{ env.RESOURCE_GROUP }} --query loginServer -o tsv)
        
        # Update container apps
        az containerapp update \
          --name rocket-rocketpy \
          --resource-group ${{ env.RESOURCE_GROUP }} \
          --image $ACR_LOGIN_SERVER/rocket-rocketpy:${{ github.sha }}
          
        az containerapp update \
          --name rocket-agentpy \
          --resource-group ${{ env.RESOURCE_GROUP }} \
          --image $ACR_LOGIN_SERVER/rocket-agentpy:${{ github.sha }}
          
        az containerapp update \
          --name rocket-web \
          --resource-group ${{ env.RESOURCE_GROUP }} \
          --image $ACR_LOGIN_SERVER/rocket-web:${{ github.sha }}
```

## Step 7: Monitoring and Scaling

### 7.1 Enable Application Insights
```bash
# Create Application Insights
az monitor app-insights component create \
  --app rocket-cursor-insights \
  --location eastus \
  --resource-group rocket-cursor-rg \
  --application-type web

# Get instrumentation key
INSIGHTS_KEY=$(az monitor app-insights component show \
  --app rocket-cursor-insights \
  --resource-group rocket-cursor-rg \
  --query instrumentationKey -o tsv)

# Update container apps with insights
az containerapp update \
  --name rocket-web \
  --resource-group rocket-cursor-rg \
  --set-env-vars APPLICATIONINSIGHTS_INSTRUMENTATION_KEY=$INSIGHTS_KEY
```

### 7.2 Configure Auto-scaling
```bash
# Set up scaling rules for web app
az containerapp update \
  --name rocket-web \
  --resource-group rocket-cursor-rg \
  --min-replicas 1 \
  --max-replicas 20 \
  --scale-rule-name "http-rule" \
  --scale-rule-type "http" \
  --scale-rule-http-concurrency 50
```

## Step 8: Backup and Disaster Recovery

### 8.1 Setup Container Registry Geo-replication
```bash
az acr replication create \
  --registry rocketcursoracr \
  --location westus2
```

### 8.2 Export ARM Templates
```bash
# Export resource group template
az group export \
  --name rocket-cursor-rg \
  --output-format template > azure-infrastructure.json
```

## Step 9: Security Best Practices

### 9.1 Network Security
```bash
# Create virtual network (if needed for additional security)
az network vnet create \
  --resource-group rocket-cursor-rg \
  --name rocket-vnet \
  --address-prefix 10.0.0.0/16 \
  --subnet-name rocket-subnet \
  --subnet-prefix 10.0.1.0/24
```

### 9.2 Container App Security
```bash
# Enable system-assigned managed identity
az containerapp identity assign \
  --name rocket-web \
  --resource-group rocket-cursor-rg \
  --system-assigned

az containerapp identity assign \
  --name rocket-agentpy \
  --resource-group rocket-cursor-rg \
  --system-assigned

az containerapp identity assign \
  --name rocket-rocketpy \
  --resource-group rocket-cursor-rg \
  --system-assigned
```

## Step 10: Cost Optimization

### 10.1 Set up Budget Alerts
```bash
az consumption budget create \
  --budget-name rocket-cursor-budget \
  --resource-group rocket-cursor-rg \
  --amount 100 \
  --category Cost \
  --time-grain Monthly \
  --start-date 2024-01-01 \
  --end-date 2025-01-01
```

### 10.2 Configure Scale-to-Zero
```bash
# Allow scaling to zero for development
az containerapp update \
  --name rocket-agentpy \
  --resource-group rocket-cursor-rg \
  --min-replicas 0 \
  --max-replicas 5

az containerapp update \
  --name rocket-rocketpy \
  --resource-group rocket-cursor-rg \
  --min-replicas 0 \
  --max-replicas 3
```

## Testing Your Deployment

### 1. Get Application URL
```bash
az containerapp show \
  --name rocket-web \
  --resource-group rocket-cursor-rg \
  --query properties.configuration.ingress.fqdn \
  -o tsv
```

### 2. Test Health Endpoints
```bash
# Test each service
curl https://your-web-app-url.azurecontainerapps.io
curl https://your-agentpy-url.azurecontainerapps.io/health
curl https://your-rocketpy-url.azurecontainerapps.io/health
```

## Maintenance and Updates

### Rolling Updates
Container Apps automatically perform rolling updates when you push new images. Monitor the deployment:

```bash
az containerapp revision list \
  --name rocket-web \
  --resource-group rocket-cursor-rg \
  --output table
```

### Logs and Debugging
```bash
# View application logs
az containerapp logs show \
  --name rocket-web \
  --resource-group rocket-cursor-rg \
  --follow

# View specific container logs
az containerapp logs show \
  --name rocket-agentpy \
  --resource-group rocket-cursor-rg \
  --container agentpy \
  --follow
```

## Estimated Monthly Costs

- **Container Apps**: ~$30-100/month (depending on usage)
- **Container Registry**: ~$5/month
- **Redis Cache**: ~$15/month (Standard tier)
- **Key Vault**: ~$3/month
- **Application Insights**: ~$5/month
- **Total**: ~$60-130/month

## Troubleshooting

### Common Issues

1. **Container startup failures**: Check logs and resource limits
2. **Service communication**: Verify internal ingress settings
3. **Secret access**: Ensure Key Vault permissions are correct
4. **Performance issues**: Monitor Application Insights and adjust scaling

### Support Commands
```bash
# Check container app status
az containerapp show --name rocket-web --resource-group rocket-cursor-rg

# View scaling metrics
az monitor metrics list \
  --resource-group rocket-cursor-rg \
  --resource rocket-web \
  --resource-type Microsoft.App/containerApps \
  --metric-names Requests
```

This comprehensive guide should get your Rocket-Cursor AI application running smoothly on Azure with production-ready infrastructure, security, monitoring, and CI/CD automation. 