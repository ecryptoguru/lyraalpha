#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { InsightAlphaStack } from './lib/insightalpha-stack';

const app = new cdk.App();
new InsightAlphaStack(app, 'InsightAlphaStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  tags: {
    Project: 'InsightAlpha',
    Environment: 'production',
  },
});
