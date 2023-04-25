/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILogger } from '../logging';

export const nulLogger = new class implements ILogger {
	verbose(): void {
		// noop
	}
};
