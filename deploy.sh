#!/bin/bash

# Read .env.json file
ENV_FILE=".env.json"

# Extract JwtSecret value
JWT_SECRET=$(grep -o '"JwtSecret"\s*:\s*"[^"]*"' "$ENV_FILE" | sed 's/.*: "//;s/"$//')

# Extract EmailDomains JSON string (keep brackets and quotes)
EMAIL_DOMAINS=$(grep -o '"EmailDomains"\s*:\s*\[[^]]*\]' "$ENV_FILE" | sed 's/.*: //')

# Sanity checks
if [ -z "$JWT_SECRET" ] || [ -z "$EMAIL_DOMAINS" ]; then
  echo "Error: Could not extract required parameters from $ENV_FILE"
  exit 1
fi

# Deploy
sam deploy \
  --template-file template.yaml \
  --stack-name spam-guard \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    JwtSecret="$JWT_SECRET" \
    EmailDomains="$EMAIL_DOMAINS"
