/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

export function toObject<V>(map: Map<string, V>): { [key: string]: V } {
	if (map) {
		let rt: { [key: string]: V } = Object.create(null);
		map.forEach((v, k) => {
			rt[k] = v;
		});
		return rt;
	}
	return {};
}
