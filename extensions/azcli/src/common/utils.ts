/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azExt from 'az-ext';
import * as which from 'which';
import * as loc from '../localizedConstants';

export class NoAzureCLIError extends Error implements azExt.ErrorWithLink {
	constructor() {
		super(loc.noAzureCLI);
	}

	public get messageWithLink(): string {
		return loc.noAzureCLI;
	}
}

export class AzureCLIArcExtError extends Error implements azExt.ErrorWithLink {
	constructor() {
		super(loc.arcdataExtensionNotInstalled);
	}

	public get messageWithLink(): string {
		return loc.arcdataExtensionNotInstalled;
	}
}

/**
 * Searches for the first instance of the specified executable in the PATH environment variable
 * @param exe The executable to search for
 */
export function searchForCmd(exe: string): Promise<string> {
	// Note : This is separated out to allow for easy test stubbing
	return new Promise<string>((resolve, reject) => which(exe, (err, path) => err ? reject(err) : resolve(<any>path)));
}

/**
 * Gets the message to display for a given error object that may be a variety of types.
 * @param error The error object
 */
export function getErrorMessage(error: any): string {
	return error.message ?? error;
}
