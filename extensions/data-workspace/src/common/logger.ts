/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class Log {
	error(msg: string): void {
		console.error(msg);
	}
}
const Logger = new Log();
export default Logger;
