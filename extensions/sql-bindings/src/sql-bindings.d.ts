/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'sql-bindings' {

	import * as vscode from 'vscode';
	import { IConnectionInfo } from 'vscode-mssql';

	export const enum extension {
		name = 'Microsoft.sql-bindings',
		vsCodeName = 'ms-mssql.sql-bindings-vscode'
	}

	export const enum ObjectType {
		Table = 'Table',
		View = 'View'
	}

	/**
	 * sql bindings extension
	 */
	export interface IExtension {
		/**
		 * Adds a SQL Binding to a specified Azure function in a file
		 * @param bindingType Type of SQL Binding
		 * @param filePath Path of the file where the Azure Functions are
		 * @param functionName Name of the function where the SQL Binding is to be added
		 * @param objectName Name of Object for the SQL Query
		 * @param connectionStringSetting Setting for the connection string
		 */
		addSqlBinding(bindingType: BindingType, filePath: string, functionName: string, objectName: string, connectionStringSetting: string): Promise<ResultStatus>;

		/**
		 * Prompts the user for information to create an Azure Function with SQL Binding
		 */
		createAzureFunction(): Promise<void>;

		/**
		 * Prompts the user to select type of binding and returns result
		 * @param objectType (Optional) The type of object user choose to insert/upsert into
		 * if left undefined we prompt user to choose between input or output binding types
		 * @param funcName (Optional) Name of the function to which we are adding the SQL Binding
		 * @returns binding type or undefined if the user cancelled out of the prompt
		 */
		promptForBindingType(objectType?: ObjectType, funcName?: string): Promise<BindingType | undefined>;

		/**
		 * Prompts the user to enter object name for the SQL query
		 * @param bindingType Type of SQL Binding
		 * @param connectionInfo (optional) connection info from the selected connection profile
		 * if left undefined we prompt to manually enter the object name
		 * @param objectType (optional) type of object to query/upsert into
		 * if left undefined we prompt user to select table to use or manually enter object name
		 * @returns the object name from user's input or menu choice
		 */
		promptForObjectName(bindingType: BindingType, connectionInfo?: IConnectionInfo, objectType?: ObjectType): Promise<string | undefined>;

		/**
		 * Prompts the user to enter connection setting and updates it from AF project
		 * @param projectUri Azure Function project uri
		 * @param connectionInfo (optional) connection info from the user to update the connection string,
		 * if left undefined we prompt the user for the connection info
		 * @returns connection string setting name to be used for the createFunction API
		 */
		promptAndUpdateConnectionStringSetting(projectUri: vscode.Uri | undefined, connectionInfo?: IConnectionInfo): Promise<IConnectionStringInfo | undefined>;

		/**
		 * Gets the names of the Azure Functions in the file
		 * @param filePath Path of the file to get the Azure Functions
		 * @returns array of names of Azure Functions in the file
		 */
		getAzureFunctions(filePath: string): Promise<GetAzureFunctionsResult>;

		/**
		 * Adds the required nuget package to the project
		 * @param selectedProjectFile is the users selected project file path
		 */
		addSqlNugetReferenceToProjectFile(selectedProjectFile: string): Promise<void>
	}

	/**
	 * Parameters for adding a SQL binding to an Azure function
	 */
	export interface AddSqlBindingParams {
		/**
		 * Absolute file path of file to add SQL binding
		 */
		filePath: string;

		/**
		 * Name of function to add SQL binding
		 */
		functionName: string;

		/**
		 * Name of object to use in SQL binding
		 */
		objectName: string;

		/**
		 * Type of Azure function binding
		 */
		bindingType: BindingType;

		/**
		 * Name of SQL connection string setting specified in local.settings.json
		 */
		connectionStringSetting: string;
	}

	/**
	 * Azure Functions binding type
	 */
	export const enum BindingType {
		input = 'input',
		output = 'output'
	}

	/**
	 * Base result object from a request to the SQL Tools Service
	 */
	export interface ResultStatus {
		success: boolean;
		errorMessage: string;
	}

	/**
	 * Parameters for getting the names of the Azure Functions in a file
	 */
	export interface GetAzureFunctionsParams {
		/**
		 * Absolute file path of file to get Azure Functions
		 */
		filePath: string;
	}

	export interface AzureFunction {
		/**
		 * The name of the function
		 */
		name: string;
		/**
		 * The HttpTrigger binding if one is specified
		 */
		httpTriggerBinding?: HttpTriggerBinding | undefined;

	}

	export interface HttpTriggerBinding {
		/**
		 * The route if specified
		 */
		route?: string | undefined;
		/**
		 * The operations (methods) if any are specified
		 */
		operations?: string[] | undefined;
	}

	/**
	 * Result from a get Azure Functions request
	 */
	export interface GetAzureFunctionsResult {
		/**
		 * Array of Azure Functions in the file
		 * Note : The string list response will eventually be deprecated and replaced completely with the AzureFunction list
		 */
		azureFunctions: string[] | AzureFunction[];
	}

	/**
	 * Result from promptAndUpdateConnectionStringSetting
	 */
	export interface IConnectionStringInfo {
		connectionStringSettingName: string;
		connectionInfo: IConnectionInfo | undefined;
	}
}
