#!/bin/bash

set -e

# Check dependencies
for cmd in aws sam npm; do
  if ! command -v $cmd &> /dev/null; then
    echo "$cmd is not installed. Please install it first."
    exit 1
  fi
done

# Prompt for secrets
read -s -p "Enter the JWT secret: " JWT_SECRET
echo
read -p "Enter the email domain: " EMAIL_DOMAIN

# Validate input
if [[ -z "$JWT_SECRET" ]]; then
  echo "JWT secret cannot be empty."
  exit 1
fi

if [[ -z "$EMAIL_DOMAIN" ]]; then
  echo "Email domain cannot be empty."
  exit 1
fi

# Install Lambda dependencies
echo "Installing Lambda dependencies..."
for dir in src/lambdas/*/; do
  if [ -f "$dir/package.json" ]; then
    echo "  npm install in $dir"
    (cd "$dir" && npm install)
  fi
done

# Build frontend React app
echo "Building frontend..."
(cd src/frontend-app && npm install && npm run build)

# SAM build & deploy
sam build

sam deploy \
  --template-file template.yml \
  --stack-name spam-guard \
  --parameter-overrides \
    JwtSecret="$JWT_SECRET" \
    EmailDomain="$EMAIL_DOMAIN"

# Get AWS info
AWSAccountId=$(aws sts get-caller-identity --query Account --output text)
AWSRegion=$(aws configure get region)

if [[ -z "$AWSRegion" ]]; then
  AWSRegion="us-east-1"
  echo "No default AWS region configured. Falling back to $AWSRegion."
fi

# Upload frontend to S3
S3_BUCKET="spam-guard-static-assets-${AWSAccountId}-${AWSRegion}"
aws s3 sync ./src/frontend/ "s3://${S3_BUCKET}/" --delete

aws ses set-active-receipt-rule-set --rule-set-name SpamGuardRuleSet

echo "Deployment complete."
