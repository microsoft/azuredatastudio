/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const serviceName = 'SQL Tools Service';
export const providerId = 'MSSQL';
export const serviceCrashLink = 'https://github.com/Microsoft/vscode-mssql/wiki/SqlToolsService-Known-Issues';
export const extensionConfigSectionName = 'mssql';
export const telemetryConfigSectionName = 'telemetry';
export const queryEditorConfigSectionName = 'queryEditor';
export const packageName = 'Microsoft.mssql';

// DATA PROTOCOL VALUES ///////////////////////////////////////////////////////////
export const sqlProviderName = 'MSSQL';

// SERVICE NAMES //////////////////////////////////////////////////////////
export const ObjectExplorerService = 'objectexplorer';
export const CmsService = 'cmsService';
export const DacFxService = 'dacfxService';
export const SqlProjectsService = 'sqlProjectsService';
export const SchemaCompareService = 'schemaCompareService';
export const LanguageExtensionService = 'languageExtensionService';
export const objectExplorerPrefix: string = 'objectexplorer://';
export const SqlAssessmentService = 'sqlAssessmentService';
export const NotebookConvertService = 'notebookConvertService';
export const AzureBlobService = 'azureBlobService';
export const ObjectManagementService = 'objectManagementService';
export const QueryStoreService = 'queryStoreService';

// CONFIGURATION VALUES //////////////////////////////////////////////////////////
export const configObjectExplorerGroupBySchemaFlagName = 'mssql.objectExplorer.groupBySchema';
export const configParallelMessageProcessingName = 'mssql.parallelMessageProcessing';
export const configParallelMessageProcessingLimitName = 'mssql.parallelMessageProcessingLimit';
export const configEnableSqlAuthenticationProviderName = 'mssql.enableSqlAuthenticationProvider';
export const configEnableConnectionPoolingName = 'mssql.enableConnectionPooling';
export const configHttpProxy = 'http.proxy';
export const configHttpProxyStrictSSL = 'http.proxyStrictSSL';

// COMMANDNAMES //////////////////////////////////////////////////////////
export const cmdObjectExplorerEnableGroupBySchemaCommand = 'mssql.enableGroupBySchema';
export const cmdObjectExplorerDisableGroupBySchemaCommand = 'mssql.disableGroupBySchema';
export const cmdObjectExplorerEnabbleGroupBySchemaTitleCommand = 'mssql.enableGroupBySchemaTitle';
export const cmdObjectExplorerDisableGroupBySchemaTitleCommand = 'mssql.disableGroupBySchemaTitle';
