/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


declare module 'sqlbindings' {

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
		 * Gets the names of the Azure functions in the file
		 * @param filePath Path of the file to get the Azure functions
		 * @returns array of names of Azure functions in the file
		 */
		 getAzureFunctions(filePath: string): Thenable<GetAzureFunctionsResult>;
	}

	/**
	 * Parameters for adding a SQL binding to an Azure function
	 */
	export interface AddSqlBindingParams {
		/**
		 * Aboslute file path of file to add SQL binding
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
	 * Azure functions binding type
	 */
	export const enum BindingType {
		input,
		output
	}

	/**
	 * ResultStatus from d.ts
	 */
	export interface ResultStatus {
		success: boolean;
		errorMessage: string;
	}

	/**
	 * Parameters for getting the names of the Azure functions in a file
	 */
	 export interface GetAzureFunctionsParams {
		/**
		 * Absolute file path of file to get Azure functions
		 */
		filePath: string;
	}

	/**
	 * Result from a get Azure functions request
	 */
	 export interface GetAzureFunctionsResult extends ResultStatus {
		/**
		 * Array of names of Azure functions in the file
		 */
		azureFunctions: string[];
	}

}
