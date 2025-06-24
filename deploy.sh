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

sam build

# Deploy SAM app
sam deploy \
  --template-file template.yml \
  --stack-name spam-guard \
  --parameter-overrides \
    JwtSecret="$JWT_SECRET" \
    EmailDomain="$EMAIL_DOMAIN"

# Get AWS info
AWSAccountId=$(aws sts get-caller-identity --query Account --output text)
AWSRegion=$(aws configure get region)

# Fallback to default region if empty
if [[ -z "$AWSRegion" ]]; then
  AWSRegion="us-east-1"
  echo "No default AWS region configured. Falling back to $AWSRegion."
fi

# Define S3 bucket name
S3_BUCKET="spam-guard-static-assets-${AWSAccountId}-${AWSRegion}"

# Upload frontend assets
aws s3 cp --recursive ./src/frontend/ "s3://${S3_BUCKET}/"

aws ses set-active-receipt-rule-set --rule-set-name SpamGuardRuleSet

echo "Deployment complete."
