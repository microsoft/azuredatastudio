/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
declare module 'resource-deployment' {
	import * as azdata from 'azdata';
	import * as vscode from 'vscode';

	export const enum ErrorType {
		userCancelled,
	}

	export interface ErrorWithType extends Error {
		readonly type: ErrorType;
	}

	export const enum extension {
		name = 'Microsoft.resource-deployment'
	}
	export interface IOptionsSourceProvider {
		readonly id: string,
		getOptions(): Promise<string[] | azdata.CategoryValue[]> | string[] | azdata.CategoryValue[];
		getVariableValue?: (variableName: string, input: string) => Promise<string> | string;
		getIsPassword?: (variableName: string) => boolean | Promise<boolean>;
	}

	export type InputValueType = string | number | boolean | azdata.CategoryValue | undefined;

	export interface IValueProvider {
		/**
		 * The ID associated with this value provider. Fields use this ID in the package.json to indicate which provider to use to get the value for that field.
		 * Each ID must be globally unique - an error will be thrown if the same ID is already registered.
		 */
		readonly id: string,
		/**
		 * Gets a calculated value based on the given input values.
		 * @param triggerValues A map of the trigger field names and their current values specified in the valueProvider field info
		*/
		getValue(triggerValues: {[key: string]: InputValueType}): Promise<InputValueType>;
	}

	/**
	 * Covers defining what the resource-deployment extension exports to other extensions
	 *
	 * IMPORTANT: THIS IS NOT A HARD DEFINITION unlike vscode; therefore no enums or classes should be defined here
	 * (const enums get evaluated when typescript -> javascript so those are fine)
	 */

	export interface IExtension {
		registerOptionsSourceProvider(provider: IOptionsSourceProvider): vscode.Disposable,
		/**
		 * Registers a value provider that resource deployment definitions can use to dynamically fetch the value for specified fields.
		 * @param provider The provider to register
		 * @returns A disposable is returned that will unregister the provider when is disposed - this should be used to ensure
		 * that the provider is unregistered when the extension is uninstalled/deactivated.
		 */
		registerValueProvider(provider: IValueProvider): vscode.Disposable
	}
}
