/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RequestType } from 'vscode-languageclient';

export namespace TestOperation {
	export const type = new RequestType<Request, number, void, void>('Add');

	export interface Request {
		a: number
		b: number
	}
}
