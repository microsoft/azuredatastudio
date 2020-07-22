/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

export async function sha256(s: string | Uint8Array): Promise<string> {
	return (require('crypto')).createHash('sha256').update(s).digest('base64');
}
