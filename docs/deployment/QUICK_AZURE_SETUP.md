# Quick Azure Deployment Guide for Your Rocket-Cursor AI Project

## 🚀 Ready to Deploy!

I can see you have all the necessary environment variables. Let's get your application deployed to Azure step by step.

## Step 1: Prerequisites Setup

### Install Azure CLI (if not already installed)
```bash
# On macOS
brew install azure-cli

# Or using curl
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

### Login to Azure
```bash
az login
```

## Step 2: Create Your Environment File

Create a `.env` file in your project root with your environment variables:

```bash
# Create the .env file with your actual values
cat > .env << 'EOF'
OPENAI_API_KEY=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
AGENT_URL=http://agentpy:8002
ROCKETPY_URL=http://rocketpy:8000
NEXT_PUBLIC_OPENWEATHER_API_KEY=908588d7f8b034ea06bf47292bc02a71
WEATHERAPI_KEY=cca965ee14a84185aa954315252605
NEXT_PUBLIC_TIMEZONE_API_KEY=4ES41L32N4CE
NEXT_PUBLIC_NOAA_API_KEY=MefsECNkWVRvTgnbOKqidjYkCcSUuNcc
NEXT_PUBLIC_SUPABASE_URL=https://rqoxlcpbrdcbgrkrvzug.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxb3hsY3BicmRjYmdya3J2enVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3OTAzMjYsImV4cCI6MjA2NDM2NjMyNn0.MbA7QwYQrLC-BSoC83P83jdM1v0NN5_NZLG3R-pMoHM
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxb3hsY3BicmRjYmdya3J2enVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODc5MDMyNiwiZXhwIjoyMDY0MzY2MzI2fQ.Focb33i6RvHqxnp1I3T168E95ZI1SVOBdHCwTnYLVVM
NEXT_PUBLIC_GOOGLE_CLIENT_ID=711116926140-k865sukndun1tl29bkkuosg84hlr2hq1.apps.googleusercontent.com
EOF
```

## Step 3: Run the Automated Deployment

I've created an automated deployment script for you. Simply run:

```bash
# Make the script executable
chmod +x scripts/deploy-azure.sh

# Run the deployment
./scripts/deploy-azure.sh
```

This script will:
1. ✅ Create all Azure resources (Container Apps, Redis, Key Vault, etc.)
2. ✅ Store your secrets securely in Azure Key Vault
3. ✅ Build and push your Docker images
4. ✅ Deploy all three services (web, agentpy, rocketpy)
5. ✅ Set up monitoring with Application Insights
6. ✅ Provide you with the application URL

## Step 4: Expected Timeline and Costs

### Deployment Timeline:
- Infrastructure setup: ~10-15 minutes
- Docker image building: ~15-20 minutes
- Service deployment: ~5-10 minutes
- **Total: ~30-45 minutes**

### Estimated Monthly Costs:
- **Container Apps**: $30-80/month
- **Container Registry**: $5/month
- **Redis Cache**: $15/month
- **Key Vault**: $3/month
- **Application Insights**: $5/month
- **Total: ~$60-110/month**

## Step 5: What Happens During Deployment

The script will create these Azure resources:
- **Resource Group**: `rocket-cursor-rg`
- **Container Registry**: `rocketcursoracr`
- **Container Apps Environment**: `rocket-cursor-env`
- **Three Container Apps**:
  - `rocket-web` (your Next.js frontend)
  - `rocket-agentpy` (OpenAI Agents service)
  - `rocket-rocketpy` (Physics simulation service)
- **Redis Cache**: `rocket-cursor-redis`
- **Key Vault**: `rocket-cursor-kv`
- **Application Insights**: `rocket-cursor-insights`

## Step 6: After Deployment

Once deployment completes, you'll get:
1. **Application URL** - Your live Rocket-Cursor AI application
2. **Monitoring dashboards** in Azure Portal
3. **Logs and metrics** for troubleshooting
4. **Auto-scaling** based on traffic

## Alternative: Manual Step-by-Step Deployment

If you prefer to run commands manually, follow the `AZURE_DEPLOYMENT_GUIDE.md` for detailed steps.

## Step 7: Set Up CI/CD (Optional)

To automatically deploy when you push to GitHub:

1. **Create Azure Service Principal**:
```bash
az ad sp create-for-rbac --name "rocket-cursor-github" --role contributor --scopes /subscriptions/$(az account show --query id --output tsv) --sdk-auth
```

2. **Add the output as a GitHub secret**:
   - Go to your GitHub repository
   - Settings → Secrets and variables → Actions
   - Add new secret named `AZURE_CREDENTIALS`
   - Paste the JSON output from step 1

3. **Push to main branch** and watch automatic deployment!

## Troubleshooting

If you encounter issues:

1. **Check Azure CLI login**: `az account show`
2. **Verify Docker is running**: `docker --version`
3. **Check resource limits**: Some Azure regions might have capacity constraints
4. **View deployment logs**: 
   ```bash
   az containerapp logs show --name rocket-web --resource-group rocket-cursor-rg --follow
   ```

## Next Steps After Deployment

1. **Test your application** at the provided URL
2. **Set up custom domain** (optional)
3. **Configure scaling rules** based on usage
4. **Set up monitoring alerts**
5. **Create backup strategies**

---

## 🎯 Ready to Launch?

Your environment is perfectly configured! Run the deployment script and your Rocket-Cursor AI will be live on Azure in about 30-45 minutes.

```bash
./scripts/deploy-azure.sh
```

**Questions or issues?** Check the troubleshooting section or refer to the comprehensive `AZURE_DEPLOYMENT_GUIDE.md`. 