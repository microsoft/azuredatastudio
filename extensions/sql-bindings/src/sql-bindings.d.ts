/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


declare module 'sql-bindings' {

	export const enum extension {
		name = 'Microsoft.sql-bindings',
		vsCodeName = 'ms-mssql.sql-bindings-vscode'
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
		 * Gets the names of the Azure Functions in the file
		 * @param filePath Path of the file to get the Azure Functions
		 * @returns array of names of Azure Functions in the file
		 */
		 getAzureFunctions(filePath: string): Promise<GetAzureFunctionsResult>;
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
		input,
		output
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

	/**
	 * Result from a get Azure Functions request
	 */
	 export interface GetAzureFunctionsResult extends ResultStatus {
		/**
		 * Array of names of Azure Functions in the file
		 */
		azureFunctions: string[];
	}

}
