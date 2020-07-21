/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as which from 'which';

/**
 * Searches for the first instance of the specified executable in the PATH environment variable
 * @param exe The executable to search for
 */
export function searchForCmd(exe: string): Promise<string> {
	// Note : This is separated out to allow for easy test stubbing
	return new Promise<string>((resolve, reject) => which(exe, (err, path) => err ? reject(err) : resolve(path)));
}
