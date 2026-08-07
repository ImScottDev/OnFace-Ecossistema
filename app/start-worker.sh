#!/bin/bash
cd "c:/Users/uScot/Documents/Scott Studio/scott-studio-crm/app"
export REDIS_URL="redis://localhost:6379"
export DATABASE_URL="postgresql://scottstudio:scott2026dev@localhost:5432/scottstudio_crm"
export GROQ_API_KEY="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"
npx tsx src/worker/index.ts
