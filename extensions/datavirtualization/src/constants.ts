/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as loc from './localizedConstants';

// CONFIG VALUES ///////////////////////////////////////////////////////////
export const extensionConfigSectionName = 'dataManagement';
export const sqlConfigSectionName = 'sql';
export const configLogDebugInfo = 'logDebugInfo';
export const configProseParsingMaxLines = 'proseParsingMaxLines';

// SERVICE NAMES //////////////////////////////////////////////////////////
export const ObjectExplorerService = 'objectexplorer';
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

export enum HdfsItems {
	Connection = 'hdfs:connection',
	Folder = 'hdfs:folder',
	File = 'hdfs:file',
	Message = 'hdfs:message'
}

export enum HdfsItemsSubType {
	Spark = 'hdfs:spark'
}

export enum AuthenticationType {
	IntegratedAuthentication = 'Integrated',
	UsernamePasswordAuthentication = 'Username Password',
	SqlAuthentication = 'SqlLogin'
}

export const serviceCrashLink = 'https://github.com/Microsoft/vscode-mssql/wiki/SqlToolsService-Known-Issues';
export const serviceName = 'Data Virtualization Service';
export const providerId = 'dataManagement';
export const sqlFileExtension = 'sql';
export const virtualizeDataCommand = 'virtualizedatawizard.cmd.open';
export const virtualizeDataTask = 'virtualizedatawizard.task.open';
export const mssqlHdfsTableFromFileCommand = 'mssqlHdfsTableWizard.cmd.open';

export const ctp24Version = 'CTP2.4';
export const ctp25Version = 'CTP2.5';
export const ctp3Version = 'CTP3.0';
export const sql2019MajorVersion = 15;

export const delimitedTextFileType = 'DELIMITEDTEXT';

export enum DataSourceType {
	SqlServer = 'SQL Server',
	Oracle = 'Oracle',
	SqlHDFS = 'SqlHDFS',
	MongoDb = 'MongoDB',
	Teradata = 'Teradata'
}

export const dataSourcePrefixMapping: Map<string, string> = new Map([
	[DataSourceType.SqlServer, 'sqlserver://'],
	[DataSourceType.Oracle, 'oracle://'],
	[DataSourceType.MongoDb, 'mongodb://'],
	[DataSourceType.Teradata, 'teradata://']
]);

export type ConnectionPageInfo = {
	serverNameTitle: string,
	databaseNameTitle: string,
	isDbRequired: boolean
};

export const connectionPageInfoMapping: Map<string, ConnectionPageInfo> = new Map([
	[DataSourceType.SqlServer, { serverNameTitle: loc.serverNameTitle, databaseNameTitle: loc.databaseNameTitle, isDbRequired: false }],
	[DataSourceType.Oracle, { serverNameTitle: loc.hostnameTitle, databaseNameTitle: loc.serviceNameTitle, isDbRequired: true }],
	[DataSourceType.MongoDb, { serverNameTitle: loc.serverNameTitle, databaseNameTitle: loc.databaseNameTitle, isDbRequired: false }],
	[DataSourceType.Teradata, { serverNameTitle: loc.serverNameTitle, databaseNameTitle: loc.databaseNameTitle, isDbRequired: false }]
]);

export const proseMaxLinesDefault = 10000;
