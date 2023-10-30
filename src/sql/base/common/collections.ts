/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function entries<K>(o: Record<string, K>): [string, K][] {
	return Object.keys(o).map(k => [k, o[k]]);
}
