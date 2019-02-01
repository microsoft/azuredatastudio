/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

export const serviceName = 'SqlToolsService';
export const providerId = 'MSSQL';
export const serviceCrashMessage = 'SQL Tools Service component exited unexpectedly. Please restart Azure Data Studio.';
export const serviceCrashButton = 'View Known Issues';
export const serviceCrashLink = 'https://github.com/Microsoft/vscode-mssql/wiki/SqlToolsService-Known-Issues';
export const extensionConfigSectionName = 'mssql';

// DATA PROTOCOL VALUES ///////////////////////////////////////////////////////////
export const mssqlClusterProviderName = 'mssqlCluster';
export const hadoopKnoxEndpointName = 'Knox';
export const protocolVersion = '1.0';
export const hostPropName = 'host';
export const SERVER = 'server';
export const userPropName = 'user';
export const knoxPortPropName = 'knoxport';
export const passwordPropName = 'password';
export const groupIdPropName = 'groupId';
export const defaultKnoxPort = '30443';
export const groupIdName = 'groupId';
export const sqlProviderName = 'MSSQL';
export const dataService = 'Data Services';

export const hdfsHost = 'host';
export const hdfsUser = 'user';
export const UNTITLED_SCHEMA = 'untitled';

export const hadoopConnectionTimeoutSeconds = 15;
export const hdfsRootPath = '/';

export const clusterEndpointsProperty = 'clusterEndpoints';
export const isBigDataClusterProperty = 'isBigDataCluster';

// SERVICE NAMES //////////////////////////////////////////////////////////
export const ObjectExplorerService = 'objectexplorer';
export const objectExplorerPrefix: string = 'objectexplorer://';
export const ViewType = 'view';

export enum BuiltInCommands {
	SetContext = 'setContext'
}

export enum CommandContext {
	WizardServiceEnabled = 'wizardservice:enabled'
}

export enum MssqlClusterItems {
	Connection = 'mssqlCluster:connection',
	Folder = 'mssqlCluster:folder',
	File = 'mssqlCluster:file',
	Error = 'mssqlCluster:error'
}

export enum MssqlClusterItemsSubType {
	Spark = 'mssqlCluster:spark'
}

export enum HdfsItemsSubType {
    Spark = 'hdfs:spark'
}

// CONFIG VALUES ///////////////////////////////////////////////////////////
export const extensionOutputChannel = 'SQL Server 2019 Preview';
export const configLogDebugInfo = 'logDebugInfo';

// DATA PROTOCOL VALUES ///////////////////////////////////////////////////////////
export const hadoopKnoxProviderName = 'HADOOP_KNOX';
export const clusterPropName = 'clustername';
export const outputChannelName = 'dataManagement';

// SPARK JOB SUBMISSION //////////////////////////////////////////////////////////
export const livySubmitSparkJobCommand = 'livy.cmd.submitSparkJob';
export const livySubmitSparkJobFromFileCommand = 'livy.cmd.submitFileToSparkJob';
export const livySubmitSparkJobTask = 'livy.task.submitSparkJob';
export const livyOpenSparkHistory = 'livy.task.openSparkHistory';
export const livyOpenYarnHistory = 'livy.task.openYarnHistory';
export const livySubmitPath = '/gateway/default/livy/v1/batches';
export const livyTimeInMSForCheckYarnApp = 1000;
export const livyRetryTimesForCheckYarnApp = 20;
export const sparkJobFileSelectorButtonWidth = '30px';
export const sparkJobFileSelectorButtonHeight = '30px';
