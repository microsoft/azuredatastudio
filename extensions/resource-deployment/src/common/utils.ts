/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'path';
import { ErrorType, ErrorWithType } from 'resource-deployment';
import { ToolsInstallPath } from '../constants';
import { ITool, NoteBookEnvironmentVariablePrefix } from '../interfaces';

export function getErrorMessage(error: any): string {
	return (error instanceof Error)
		? (typeof error.message === 'string' ? error.message : '')
		: typeof error === 'string' ? error : `${JSON.stringify(error, undefined, '\t')}`;
}

export function isUserCancelledError(err: any): boolean {
	return err instanceof Error && 'type' in err && (<ErrorWithType>err).type === ErrorType.userCancelled;
}

export function getDateTimeString(): string {
	return new Date().toISOString().slice(0, 19).replace(/[^0-9]/g, ''); // Take the date time information and only leaving the numbers
}


export function getRuntimeBinaryPathEnvironmentVariableName(toolName: string): string {
	return `${NoteBookEnvironmentVariablePrefix}${toolName.toUpperCase().replace(/ |-/g, '_')}`;
}

export function setEnvironmentVariablesForInstallPaths(tools: ITool[], env: NodeJS.ProcessEnv = process.env): void {
	// Use Set class to make sure the collection only contains unique values.
	let installationPaths: Set<string> = new Set<string>();
	tools.forEach(t => {
		if (t.installationPathOrAdditionalInformation) {

			// construct an env variable name with NoteBookEnvironmentVariablePrefix prefix
			// and tool.name as suffix, making sure of using all uppercase characters and only _ as separator
			const envVarName = getRuntimeBinaryPathEnvironmentVariableName(t.name);
			env[envVarName] = t.installationPathOrAdditionalInformation;
			installationPaths.add(path.dirname(t.installationPathOrAdditionalInformation));
		}
	});
	if (installationPaths.size > 0) {
		const envVarToolsInstallationPath: string = [...installationPaths.values()].join(path.delimiter);
		env[ToolsInstallPath] = envVarToolsInstallationPath;
	}
}

/**
 * returns true if input is undefined or empty
 *
 * @param input - input value to test
 */
export function isUndefinedOrEmpty(input: any): boolean {
	return input === undefined || (typeof input === 'string' && input.length === 0);
}

/**
 * Throws an Error with given {@link message} unless {@link condition} is true.
 * This also tells the typescript compiler that the condition is 'truthy' in the remainder of the scope
 * where this function was called.
 *
 * @param condition
 * @param message
 */
export function throwUnless(condition: boolean, message?: string): asserts condition {
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

export function deepClone<T>(obj: T): T {
	if (!obj || typeof obj !== 'object') {
		return obj;
	}
	if (obj instanceof RegExp) {
		// See https://github.com/Microsoft/TypeScript/issues/10990
		return obj as any;
	}
	const result: any = Array.isArray(obj) ? [] : {};
	Object.keys(<any>obj).forEach((key: string) => {
		if ((<any>obj)[key] && typeof (<any>obj)[key] === 'object') {
			result[key] = deepClone((<any>obj)[key]);
		} else {
			result[key] = (<any>obj)[key];
		}
	});
	return result;
}
