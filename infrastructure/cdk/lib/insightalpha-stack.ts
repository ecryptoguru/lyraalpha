// AWS CDK Infrastructure Stack for InsightAlpha
// Usage: npx cdk deploy after configuring AWS credentials

import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secrets from 'aws-cdk-lib/aws-secretsmanager';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export class InsightAlphaStack extends cdk.Stack {
  public readonly dbEndpoint: string;
  public readonly cacheEndpoint: string;
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC for all resources
    this.vpc = new ec2.Vpc(this, 'InsightAlphaVPC', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    // Security Group for RDS
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DBSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for RDS PostgreSQL',
      allowAllOutbound: true,
    });

    // Allow inbound PostgreSQL from VPC
    dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from within VPC'
    );

    // Database credentials secret
    const dbSecret = new secrets.Secret(this, 'DBSecret', {
      secretName: 'insightalpha-db-credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 32,
      },
    });

    // RDS PostgreSQL Instance
    const db = new rds.DatabaseInstance(this, 'PostgreSQL', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_4,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSecurityGroup],
      credentials: rds.Credentials.fromSecret(dbSecret),
      databaseName: 'insightalpha',
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      storageType: rds.StorageType.GP2,
      backupRetention: cdk.Duration.days(7),
      deletionProtection: false, // Set to true for production
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      enablePerformanceInsights: true,
      performanceInsightsRetention: rds.PerformanceInsightsRetention.DEFAULT,
    });

    this.dbEndpoint = db.dbInstanceEndpointAddress;

    // ElastiCache Security Group
    const cacheSecurityGroup = new ec2.SecurityGroup(this, 'CacheSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for ElastiCache Redis',
      allowAllOutbound: true,
    });

    cacheSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(6379),
      'Allow Redis from within VPC'
    );

    // ElastiCache Subnet Group
    const cacheSubnetGroup = new elasticache.CfnSubnetGroup(this, 'CacheSubnetGroup', {
      description: 'Subnet group for ElastiCache',
      subnetIds: this.vpc.privateSubnets.map(subnet => subnet.subnetId),
      cacheSubnetGroupName: 'insightalpha-cache-subnets',
    });

    // ElastiCache Serverless Redis
    const cache = new elasticache.CfnServerlessCache(this, 'RedisCache', {
      engine: 'redis',
      serverlessCacheName: 'insightalpha-cache',
      majorEngineVersion: '7',
      securityGroupIds: [cacheSecurityGroup.securityGroupId],
      subnetIds: cacheSubnetGroup.subnetIds,
      dailySnapshotTime: '03:00',
      snapshotRetentionLimit: 7,
    });

    this.cacheEndpoint = cache.attrEndpointAddress;

    // Output the endpoints
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: db.dbInstanceEndpointAddress,
      description: 'RDS PostgreSQL endpoint',
    });

    new cdk.CfnOutput(this, 'DatabasePort', {
      value: db.dbInstanceEndpointPort,
      description: 'RDS PostgreSQL port',
    });

    new cdk.CfnOutput(this, 'CacheEndpoint', {
      value: cache.attrEndpointAddress,
      description: 'ElastiCache Redis endpoint',
    });

    new cdk.CfnOutput(this, 'CachePort', {
      value: cache.attrEndpointPort || '6379',
      description: 'ElastiCache Redis port',
    });

    new cdk.CfnOutput(this, 'DBSecretArn', {
      value: dbSecret.secretArn,
      description: 'Database credentials secret ARN',
    });
  }
}
