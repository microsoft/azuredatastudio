/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ClientCapabilities as VSClientCapabilities, RequestType, NotificationType } from 'vscode-languageclient';
import * as types from 'dataprotocol-client/lib/types';
import * as azdata from 'azdata';

/**
 * @interface IMessage
 */
export interface IMessage {
	jsonrpc: string;
}

// ------------------------------- < Telemetry Sent Event > ------------------------------------

/**
 * Event sent when the language service send a telemetry event
 */
export namespace TelemetryNotification {
	export const type = new NotificationType<TelemetryParams, void>('telemetry/sqlevent');
}

/**
 * Update event parameters
 */
export class TelemetryParams {
	public params: {
		eventName: string;
		properties: ITelemetryEventProperties;
		measures: ITelemetryEventMeasures;
	};
}

export interface ITelemetryEventProperties {
	[key: string]: string;
}

export interface ITelemetryEventMeasures {
	[key: string]: number;
}


// ------------------------------- </ Telemetry Sent Event > ----------------------------------

/*
* DataSourceWizardCreateSessionRequest
*/
export namespace DataSourceWizardCreateSessionRequest {
	export const type = new RequestType<azdata.connection.ConnectionProfile, DataSourceWizardConfigInfoResponse, void, void>('datasourcewizard/createsession');
}

export interface DataSourceWizardConfigInfoResponse {
	sessionId: string;
	supportedSourceTypes: DataSourceType[];
	databaseList: DatabaseOverview[];
	serverMajorVersion: number;
	productLevel: string;
}

export interface DatabaseOverview {
	name: string;
	hasMasterKey: boolean;
}

// Defines the important information about a type of data source - its name, configuration properties, etc.
export interface DataSourceType {
	typeName: string;
	authenticationTypes: string[];
}


/*
* DisposeWizardSessionRequest
*/
export namespace DisposeWizardSessionRequest {
	export const type = new RequestType<string, boolean, void, void>('datasourcewizard/disposewizardsession');
}


/*
* ValidateVirtualizeDataInputRequest
*/
export namespace ValidateVirtualizeDataInputRequest {
	export const type = new RequestType<VirtualizeDataInput, ValidateVirtualizeDataInputResponse, void, void>('datasourcewizard/validatevirtualizedatainput');
}

export interface ValidateVirtualizeDataInputResponse {
	isValid: boolean;
	errorMessages: string[];
}

export interface VirtualizeDataInput {
	sessionId: string;
	destDatabaseName: string;
	sourceServerType: string;
	destDbMasterKeyPwd: string;
	existingDataSourceName: string;
	newDataSourceName: string;
	sourceServerName: string;
	sourceDatabaseName: string;
	sourceAuthenticationType: string;
	existingCredentialName: string;
	newCredentialName: string;
	sourceUsername: string;
	sourcePassword: string;
	externalTableInfoList: ExternalTableInfo[];
	newSchemas: string[];
}

export interface FileFormat {
	formatName: string;
	formatType: string;
	fieldTerminator: string; // string token that separates columns on each line of the file
	stringDelimiter: string; // string token that marks beginning/end of strings in the file
	firstRow: number;
}

export interface ExternalTableInfo {
	externalTableName: string[];
	columnDefinitionList: ColumnDefinition[];
	sourceTableLocation: string[];
	fileFormat?: FileFormat;
}

export interface ColumnDefinition {
	columnName: string;
	dataType: string;
	collationName: string;
	isNullable: boolean;
	isSupported?: boolean;
}

// TODO: All response objects for data-source-browsing request have this format, and can be formed with this generic class.
//       Replace response objects with this class.
export interface ExecutionResult<T> {
	isSuccess: boolean;
	returnValue: T;
	errorMessages: string[];
}

// TODO: All parameter objects for querying list of database, list of tables, and list of column definitions have this format,
//       and can be formed with this generic class. Replace parameter objects with this class for those query requests.
export interface DataSourceBrowsingParams<T> {
	virtualizeDataInput: VirtualizeDataInput;
	querySubject: T;
}

export namespace GetSourceViewListRequest {
	export const type = new RequestType<DataSourceBrowsingParams<string>, ExecutionResult<SchemaViews[]>, void, void>('datasourcewizard/getsourceviewlist');
}

/*
* GetDatabaseInfoRequest
*/
export namespace GetDatabaseInfoRequest {
	export const type = new RequestType<GetDatabaseInfoRequestParams, GetDatabaseInfoResponse, void, void>('datasourcewizard/getdatabaseinfo');
}

export interface GetDatabaseInfoResponse {
	isSuccess: boolean;
	errorMessages: string[];
	databaseInfo: DatabaseInfo;
}

export interface DatabaseInfo {
	hasMasterKey: boolean;
	defaultSchema: string;
	schemaList: string[];
	existingCredentials: CredentialInfo[];
	externalDataSources: DataSourceInstance[];
	externalTables: TableInfo[];
	externalFileFormats: string[];
}

export interface CredentialInfo {
	credentialName: string;
	username: string;
}

export interface TableInfo {
	schemaName: string;
	tableName: string;
}

export interface GetDatabaseInfoRequestParams {
	sessionId: string;
	databaseName: string;
}


// Defines the important information about an external data source that has already been created.
export interface DataSourceInstance {
	name: string;
	location: string;
	authenticationType: string;
	username?: string;
	credentialName?: string;
}


/*
* ProcessVirtualizeDataInputRequest
*/
export namespace ProcessVirtualizeDataInputRequest {
	export const type = new RequestType<VirtualizeDataInput, ProcessVirtualizeDataInputResponse, void, void>('datasourcewizard/processvirtualizedatainput');
}

export interface ProcessVirtualizeDataInputResponse {
	isSuccess: boolean;
	errorMessages: string[];
}

export namespace GenerateScriptRequest {
	export const type = new RequestType<VirtualizeDataInput, GenerateScriptResponse, void, void>('datasourcewizard/generatescript');
}

export interface GenerateScriptResponse {
	isSuccess: boolean;
	errorMessages: string[];
	script: string;
}


/*
* GetSourceDatabasesRequest
*/
export namespace GetSourceDatabasesRequest {
	export const type = new RequestType<VirtualizeDataInput, GetSourceDatabasesResponse, void, void>('datasourcewizard/getsourcedatabaselist');
}

export interface GetSourceDatabasesResponse {
	isSuccess: boolean;
	errorMessages: string[];
	databaseNames: string[];
}


/*
* GetSourceTablesRequest
*/
export namespace GetSourceTablesRequest {
	export const type = new RequestType<GetSourceTablesRequestParams, GetSourceTablesResponse, void, void>('datasourcewizard/getsourcetablelist');
}

export interface GetSourceTablesRequestParams {
	sessionId: string;
	virtualizeDataInput: VirtualizeDataInput;
	sourceDatabaseName: string;
}

export interface GetSourceTablesResponse {
	isSuccess: boolean;
	errorMessages: string[];
	schemaTablesList: SchemaTables[];
}

export interface SchemaTables {
	schemaName: string;
	tableNames: string[];
}

export interface SchemaViews {
	schemaName: string;
	viewNames: string[];
}

/*
* GetSourceColumnDefinitionsRequest
*/
export namespace GetSourceColumnDefinitionsRequest {
	export const type = new RequestType<GetSourceColumnDefinitionsRequestParams, GetSourceColumnDefinitionsResponse, void, void>('datasourcewizard/getsourcecolumndefinitionlist');
}

export interface GetSourceColumnDefinitionsRequestParams {
	sessionId: string;
	virtualizeDataInput: VirtualizeDataInput;
	location: string[];
}

export interface GetSourceColumnDefinitionsResponse {
	isSuccess: boolean;
	errorMessages: string[];
	columnDefinitions: ColumnDefinition[];
}

/*
* Prose
*/
export interface ColumnInfo {
	name: string;
	sqlType: string;
	isNullable: boolean;
}

export interface ProseDiscoveryParams {
	filePath: string;
	tableName: string;
	schemaName?: string;
	fileType?: string;
	fileContents?: string;
}

export interface ProseDiscoveryResponse {
	dataPreview: string[][];
	columnInfo: ColumnInfo[];
	columnDelimiter: string;
	firstRow: number;
	quoteCharacter: string;
}

export namespace ProseDiscoveryRequest {
	export const type = new RequestType<ProseDiscoveryParams, ProseDiscoveryResponse, void, void>('flatfile/proseDiscovery');
}

// ------------------------------- < Data Source Wizard API definition > ------------------------------------
export interface DataSourceWizardService {
	providerId?: string;
	createDataSourceWizardSession(requestParams: azdata.connection.ConnectionProfile): Thenable<DataSourceWizardConfigInfoResponse>;
	disposeWizardSession(sessionId: string): Thenable<boolean>;
	validateVirtualizeDataInput(requestParams: VirtualizeDataInput): Thenable<ValidateVirtualizeDataInputResponse>;
	getDatabaseInfo(requestParams: GetDatabaseInfoRequestParams): Thenable<GetDatabaseInfoResponse>;
	processVirtualizeDataInput(requestParams: VirtualizeDataInput): Thenable<ProcessVirtualizeDataInputResponse>;
	generateScript(requestParams: VirtualizeDataInput): Thenable<GenerateScriptResponse>;
	getSourceDatabases(requestParams: VirtualizeDataInput): Thenable<GetSourceDatabasesResponse>;
	getSourceTables(requestParams: GetSourceTablesRequestParams): Thenable<GetSourceTablesResponse>;
	getSourceViewList(requestParams: DataSourceBrowsingParams<string>): Thenable<ExecutionResult<SchemaViews[]>>;
	getSourceColumnDefinitions(requestParams: GetSourceColumnDefinitionsRequestParams): Thenable<GetSourceColumnDefinitionsResponse>;
	sendProseDiscoveryRequest(requestParams: ProseDiscoveryParams): Thenable<ProseDiscoveryResponse>;
}
