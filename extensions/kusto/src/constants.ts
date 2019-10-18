/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

export const serviceName = 'SQL Tools Service';
export const providerId = 'KUSTO';
export const serviceCrashLink = 'https://github.com/Microsoft/vscode-kusto/wiki/SqlToolsService-Known-Issues';
export const extensionConfigSectionName = 'kusto';

// DATA PROTOCOL VALUES ///////////////////////////////////////////////////////////
export const kustoClusterProviderName = 'kustoCluster';
export const hadoopEndpointNameGateway = 'gateway';
export const protocolVersion = '1.0';
export const authenticationTypePropName = 'authenticationType';
export const integratedAuth = 'integrated';
export const hostPropName = 'host';
export const userPropName = 'user';
export const knoxPortPropName = 'knoxport';
export const passwordPropName = 'password';
export const groupIdPropName = 'groupId';
export const defaultKnoxPort = 30443;
export const groupIdName = 'groupId';
export const sqlProviderName = 'KUSTO';

export const UNTITLED_SCHEMA = 'untitled';

export const hadoopConnectionTimeoutSeconds = 15;
export const hdfsRootPath = '/';

export const clusterEndpointsProperty = 'clusterEndpoints';
export const isBigDataClusterProperty = 'isBigDataCluster';

// SERVICE NAMES //////////////////////////////////////////////////////////
export const ObjectExplorerService = 'objectexplorer';
export const CmsService = 'cmsService';
export const DacFxService = 'dacfxService';
export const SchemaCompareService = 'schemaCompareService';
export const objectExplorerPrefix: string = 'objectexplorer://';
export const ViewType = 'view';

export enum BuiltInCommands {
	SetContext = 'setContext'
}

export enum CommandContext {
	WizardServiceEnabled = 'wizardservice:enabled'
}

export enum MssqlClusterItems {
	Connection = 'kustoCluster:connection',
	Folder = 'kustoCluster:folder',
	File = 'kustoCluster:file',
	Error = 'kustoCluster:error'
}

export enum MssqlClusterItemsSubType {
	Spark = 'kustoCluster:spark'
}

// SPARK JOB SUBMISSION //////////////////////////////////////////////////////////
export const kustoClusterNewNotebookTask = 'kustoCluster.task.newNotebook';
export const kustoClusterOpenNotebookTask = 'kustoCluster.task.openNotebook';
export const kustoopenClusterStatusNotebook = 'kustoCluster.task.openClusterStatusNotebook';
export const kustoClusterLivySubmitSparkJobCommand = 'kustoCluster.livy.cmd.submitSparkJob';
export const kustoClusterLivySubmitSparkJobFromFileCommand = 'kustoCluster.livy.cmd.submitFileToSparkJob';
export const kustoClusterLivySubmitSparkJobTask = 'kustoCluster.livy.task.submitSparkJob';
export const kustoClusterLivyOpenSparkHistory = 'kustoCluster.livy.task.openSparkHistory';
export const kustoClusterLivyOpenYarnHistory = 'kustoCluster.livy.task.openYarnHistory';
export const kustoClusterLivySubmitPath = '/gateway/default/livy/v1/batches';
export const kustoClusterLivyTimeInMSForCheckYarnApp = 1000;
export const kustoClusterLivyRetryTimesForCheckYarnApp = 20;
export const kustoClusterSparkJobFileSelectorButtonWidth = '30px';
export const kustoClusterSparkJobFileSelectorButtonHeight = '30px';
