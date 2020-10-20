/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Asserts that the specified promise was rejected
 * @param promise The promise to verify was rejected
 * @param message The message to include in the error if the promise isn't rejected
 */
export async function assertRejected(promise: Promise<any>, message: string): Promise<void> {
	try {
		await promise;
	} catch {
		return;
	}
	throw new Error(message);
}

