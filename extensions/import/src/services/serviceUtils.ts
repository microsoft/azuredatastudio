/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function ensure(target: { [key: string]: any }, key: string): any {
	if (target[key] === void 0) {
		target[key] = {} as any;
	}
	return target[key];
}
