/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceType } from 'arc';
import * as azdata from 'azdata';
import * as azurecore from 'azurecore';
import * as vscode from 'vscode';
import { ConnectionMode, IconPath, IconPathHelper } from '../constants';
import * as loc from '../localizedConstants';

/**
 * Converts the resource type name into the localized Display Name for that type.
 * @param resourceType The resource type name to convert
 */
export function resourceTypeToDisplayName(resourceType: string | undefined): string {
	resourceType = resourceType || 'undefined';
	switch (resourceType) {
		case ResourceType.dataControllers:
			return loc.dataControllersType;
		case ResourceType.postgresInstances:
			return loc.pgSqlType;
		case ResourceType.sqlManagedInstances:
			return loc.miaaType;
	}
	return resourceType;
}

export function parseEndpoint(endpoint?: string): { ip: string, port: string } {
	endpoint = endpoint || '';
	const separatorIndex = endpoint.indexOf(':');
	return {
		ip: endpoint.substr(0, separatorIndex),
		port: endpoint.substr(separatorIndex + 1)
	};
}

let azurecoreApi: azurecore.IExtension;

export async function getAzurecoreApi(): Promise<azurecore.IExtension> {
	if (!azurecoreApi) {
		azurecoreApi = await vscode.extensions.getExtension(azurecore.extension.name)?.activate();
		if (!azurecoreApi) {
			throw new Error('Unable to retrieve azurecore API');
		}
	}
	return azurecoreApi;
}

/**
 * Gets the IconPath for the specified resource type, or undefined if the type is unknown.
 * @param resourceType The resource type
 */
export function getResourceTypeIcon(resourceType: string | undefined): IconPath | undefined {
	switch (resourceType) {
		case ResourceType.sqlManagedInstances:
			return IconPathHelper.miaa;
		case ResourceType.postgresInstances:
			return IconPathHelper.postgres;
		case ResourceType.dataControllers:
			return IconPathHelper.controller;
	}
	return undefined;
}

/**
 * Returns the text to display for known connection modes
 * @param connectionMode The string representing the connection mode
 */
export function getConnectionModeDisplayText(connectionMode: string | undefined): string {
	connectionMode = connectionMode ?? '';
	switch (connectionMode) {
		case ConnectionMode.direct:
			return loc.direct;
		case ConnectionMode.indirect:
			return loc.indirect;
	}
	return connectionMode;
}

/**
 * Gets the display text for the database state returned from querying the database.
 * @param state The state value returned from the database
 */
export function getDatabaseStateDisplayText(state: string): string {
	switch (state.toUpperCase()) {
		case 'ONLINE':
			return loc.online;
		case 'OFFLINE':
			return loc.offline;
		case 'RESTORING':
			return loc.restoring;
		case 'RECOVERING':
			return loc.recovering;
		case 'RECOVERY PENDING':
			return loc.recoveryPending;
		case 'SUSPECT':
			return loc.suspect;
		case 'EMERGENCY':
			return loc.emergency;
	}
	return state;
}

/**
 * Opens an input box prompting and validating the user's input.
 * @param options Options for the input box
 * @param title An optional title for the input box
 * @returns Promise resolving to the user's input if it passed validation,
 * or undefined if the input box was closed for any other reason
 */
async function promptInputBox(title: string, options: vscode.InputBoxOptions): Promise<string | undefined> {
	const inputBox = vscode.window.createInputBox();
	inputBox.title = title;
	inputBox.prompt = options.prompt;
	inputBox.placeholder = options.placeHolder;
	inputBox.password = options.password ?? false;
	inputBox.value = options.value ?? '';
	inputBox.ignoreFocusOut = options.ignoreFocusOut ?? false;

	return new Promise(resolve => {
		let valueAccepted = false;
		inputBox.onDidAccept(async () => {
			if (options.validateInput) {
				const errorMessage = await options.validateInput(inputBox.value);
				if (errorMessage) {
					inputBox.validationMessage = errorMessage;
					return;
				}
			}
			valueAccepted = true;
			inputBox.hide();
			resolve(inputBox.value);
		});
		inputBox.onDidHide(() => {
			if (!valueAccepted) {
				resolve(undefined);
			}
			inputBox.dispose();
		});
		inputBox.onDidChangeValue(() => {
			inputBox.validationMessage = '';
		});
		inputBox.show();
	});
}

/**
 * Opens an input box prompting the user to enter in the name of an instance to delete
 * @param name The name of the instance to delete
 * @returns Promise resolving to true if the user confirmed the name, false if the input box was closed for any other reason
 */
export async function promptForInstanceDeletion(name: string): Promise<boolean> {
	const title = loc.instanceDeletionWarning(name);
	const options: vscode.InputBoxOptions = {
		placeHolder: name,
		validateInput: input => input !== name ? loc.invalidInstanceDeletionName(name) : ''
	};

	return await promptInputBox(title, options) !== undefined;
}

/**
 * Opens an input box prompting the user to enter and confirm a password
 * @param validate A function that accepts the password and returns an error message if it's invalid
 * @returns Promise resolving to the password if it passed validation,
 * or undefined if the input box was closed for any other reason
 */
export async function promptAndConfirmPassword(validate: (input: string) => string): Promise<string | undefined> {
	const title = loc.resetPassword;
	const options: vscode.InputBoxOptions = {
		prompt: loc.enterNewPassword,
		password: true,
		validateInput: input => validate(input)
	};

	const password = await promptInputBox(title, options);
	if (password) {
		options.prompt = loc.confirmNewPassword;
		options.validateInput = input => input !== password ? loc.thePasswordsDoNotMatch : '';
		return promptInputBox(title, options);
	}

	return undefined;
}

export function generateGuid(): string {
	let hexValues: string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
	// c.f. rfc4122 (UUID version 4 = xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
	let oct: string = '';
	let tmp: number;
	/* tslint:disable:no-bitwise */
	for (let a: number = 0; a < 4; a++) {
		tmp = (4294967296 * Math.random()) | 0;
		oct += hexValues[tmp & 0xF] +
			hexValues[tmp >> 4 & 0xF] +
			hexValues[tmp >> 8 & 0xF] +
			hexValues[tmp >> 12 & 0xF] +
			hexValues[tmp >> 16 & 0xF] +
			hexValues[tmp >> 20 & 0xF] +
			hexValues[tmp >> 24 & 0xF] +
			hexValues[tmp >> 28 & 0xF];
	}

	// 'Set the two most significant bits (bits 6 and 7) of the clock_seq_hi_and_reserved to zero and one, respectively'
	let clockSequenceHi: string = hexValues[8 + (Math.random() * 4) | 0];
	return oct.substr(0, 8) + '-' + oct.substr(9, 4) + '-4' + oct.substr(13, 3) + '-' + clockSequenceHi + oct.substr(16, 3) + '-' + oct.substr(19, 12);
	/* tslint:enable:no-bitwise */
}

/**
 * Gets the message to display for a given error object that may be a variety of types.
 * @param error The error object
 * @param useMessageWithLink Whether to use the messageWithLink - if available
 */
export function getErrorMessage(error: any, useMessageWithLink: boolean = false): string {
	if (useMessageWithLink && error.messageWithLink) {
		return error.messageWithLink;
	}
	return error.message ?? error;
}

/**
 * Parses an address into its separate ip and port values. Address must be in the form <ip>:<port>
 * or <ip>,<port>
 * @param address The address to parse
 */
export function parseIpAndPort(address: string): { ip: string, port: string } {
	let sections = address.split(':');
	if (sections.length !== 2) {
		sections = address.split(',');
		if (sections.length !== 2) {
			throw new Error(`Invalid address format for ${address}. Address must be in the form <ip>:<port> or <ip>,<port>`);
		}
	}
	return {
		ip: sections[0],
		port: sections[1]
	};
}

export function createCredentialId(controllerId: string, resourceType: string, instanceName: string): string {
	return `${controllerId}::${resourceType}::${instanceName}`;
}

/**
 * Calculates the gibibyte (GiB) conversion of a quantity that could currently be represented by a range
 * of SI suffixes (E, P, T, G, M, K, m) or their power-of-two equivalents (Ei, Pi, Ti, Gi, Mi, Ki)
 * @param value The string of a quantity to be converted
 * @returns String of GiB conversion
 */
export function convertToGibibyteString(value: string): string {
	if (!value) {
		throw new Error(`Value provided is not a valid Kubernetes resource quantity`);
	}

	let base10ToBase2Multiplier;
	let floatValue = parseFloat(value);
	let splitValue = value.split(String(floatValue));
	let unit = splitValue[1];

	if (unit === 'K') {
		base10ToBase2Multiplier = 1000 / 1024;
		floatValue = (floatValue * base10ToBase2Multiplier) / Math.pow(1024, 2);
	} else if (unit === 'M') {
		base10ToBase2Multiplier = Math.pow(1000, 2) / Math.pow(1024, 2);
		floatValue = (floatValue * base10ToBase2Multiplier) / 1024;
	} else if (unit === 'G') {
		base10ToBase2Multiplier = Math.pow(1000, 3) / Math.pow(1024, 3);
		floatValue = floatValue * base10ToBase2Multiplier;
	} else if (unit === 'T') {
		base10ToBase2Multiplier = Math.pow(1000, 4) / Math.pow(1024, 4);
		floatValue = (floatValue * base10ToBase2Multiplier) * 1024;
	} else if (unit === 'P') {
		base10ToBase2Multiplier = Math.pow(1000, 5) / Math.pow(1024, 5);
		floatValue = (floatValue * base10ToBase2Multiplier) * Math.pow(1024, 2);
	} else if (unit === 'E') {
		base10ToBase2Multiplier = Math.pow(1000, 6) / Math.pow(1024, 6);
		floatValue = (floatValue * base10ToBase2Multiplier) * Math.pow(1024, 3);
	} else if (unit === 'm') {
		floatValue = (floatValue / 1000) / Math.pow(1024, 3);
	} else if (unit === '') {
		floatValue = floatValue / Math.pow(1024, 3);
	} else if (unit === 'Ki') {
		floatValue = floatValue / Math.pow(1024, 2);
	} else if (unit === 'Mi') {
		floatValue = floatValue / 1024;
	} else if (unit === 'Gi') {
		floatValue = floatValue;
	} else if (unit === 'Ti') {
		floatValue = floatValue * 1024;
	} else if (unit === 'Pi') {
		floatValue = floatValue * Math.pow(1024, 2);
	} else if (unit === 'Ei') {
		floatValue = floatValue * Math.pow(1024, 3);
	} else {
		throw new Error(`${value} is not a valid Kubernetes resource quantity`);
	}

	return String(floatValue);
}

/**
 * Used to confirm if object is an azdata CheckBoxComponent
 */
export function instanceOfCheckBox(object: any): object is azdata.CheckBoxComponent {
	return 'checked' in object;
}

/*
 * Throws an Error with given {@link message} unless {@link condition} is true.
 * This also tells the typescript compiler that the condition is 'truthy' in the remainder of the scope
 * where this function was called.
 *
 * @param condition
 * @param message
 */
export function throwUnless(condition: any, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message);
	}
}

export async function tryExecuteAction<T>(action: () => T | PromiseLike<T>): Promise<{ result: T | undefined, error: any }> {
	let error: any, result: T | undefined;
	try {
		result = await action();
	} catch (e) {
		error = e;
	}
	return { result, error };
}

function decorate(decorator: (fn: Function, key: string) => Function): Function {
	return (_target: any, key: string, descriptor: any) => {
		let fnKey: string | null = null;
		let fn: Function | null = null;

		if (typeof descriptor.value === 'function') {
			fnKey = 'value';
			fn = descriptor.value;
		} else if (typeof descriptor.get === 'function') {
			fnKey = 'get';
			fn = descriptor.get;
		}

		if (!fn || !fnKey) {
			throw new Error('not supported');
		}

		descriptor[fnKey] = decorator(fn, key);
	};
}

export function debounce(delay: number): Function {
	return decorate((fn, key) => {
		const timerKey = `$debounce$${key}`;

		return function (this: any, ...args: any[]) {
			clearTimeout(this[timerKey]);
			this[timerKey] = setTimeout(() => fn.apply(this, args), delay);
		};
	});
}

export function getTimeStamp(dateTime: string | undefined): number {
	return dateTime ? (new Date(dateTime)).getTime() : 0;
}

export function checkISOTimeString(dateTime: string): boolean {
	return /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d.*Z/.test(dateTime);
}
