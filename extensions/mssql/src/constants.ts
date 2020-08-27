/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const serviceName = 'SQL Tools Service';
export const providerId = 'MSSQL';
export const serviceCrashLink = 'https://github.com/Microsoft/vscode-mssql/wiki/SqlToolsService-Known-Issues';
export const extensionConfigSectionName = 'mssql';

// DATA PROTOCOL VALUES ///////////////////////////////////////////////////////////
export const mssqlClusterProviderName = 'mssqlCluster';
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
export const sqlProviderName = 'MSSQL';

export const UNTITLED_SCHEMA = 'untitled';

export const hadoopConnectionTimeoutSeconds = 15;
export const hdfsRootPath = '/';

export const clusterEndpointsProperty = 'clusterEndpoints';
export const isBigDataClusterProperty = 'isBigDataCluster';

export const ViewType = 'view';

// SERVICE NAMES //////////////////////////////////////////////////////////
export const ObjectExplorerService = 'objectexplorer';
export const CmsService = 'cmsService';
export const DacFxService = 'dacfxService';
export const SchemaCompareService = 'schemaCompareService';
export const LanguageExtensionService = 'languageExtensionService';
export const objectExplorerPrefix: string = 'objectexplorer://';
export const SqlAssessmentService = 'sqlAssessmentService';
export const NotebookConvertService = 'notebookConvertService';

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
	Mount = ':mount:',
	MountChild = ':mountChild:',
	Spark = ':spark:'
}

// SPARK JOB SUBMISSION //////////////////////////////////////////////////////////
export const mssqlClusterNewNotebookTask = 'mssqlCluster.task.newNotebook';
export const mssqlClusterOpenNotebookTask = 'mssqlCluster.task.openNotebook';
export const mssqlOpenClusterDashboard = 'mssqlCluster.task.openClusterDashboard';
export const mssqlClusterLivySubmitSparkJobCommand = 'mssqlCluster.livy.cmd.submitSparkJob';
export const mssqlClusterLivySubmitSparkJobFromFileCommand = 'mssqlCluster.livy.cmd.submitFileToSparkJob';
export const mssqlClusterLivySubmitSparkJobTask = 'mssqlCluster.livy.task.submitSparkJob';
export const mssqlClusterLivyOpenSparkHistory = 'mssqlCluster.livy.task.openSparkHistory';
export const mssqlClusterLivyOpenYarnHistory = 'mssqlCluster.livy.task.openYarnHistory';
export const mssqlClusterLivySubmitPath = '/gateway/default/livy/v1/batches';
export const mssqlClusterLivyTimeInMSForCheckYarnApp = 1000;
export const mssqlClusterLivyRetryTimesForCheckYarnApp = 20;
export const mssqlClusterSparkJobFileSelectorButtonWidth = '30px';
export const mssqlClusterSparkJobFileSelectorButtonHeight = '30px';
