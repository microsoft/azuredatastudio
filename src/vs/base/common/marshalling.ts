/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import { regExpFlags } from 'vs/base/common/strings';

export function stringify(obj: any): string {
	return JSON.stringify(obj, replacer);
}

export function parse(text: string): any {
	let data = JSON.parse(text);
	data = revive(data);
	return data;
}

export interface MarshalledObject {
	$mid: number;
}

function replacer(key: string, value: any): any {
	// URI is done via toJSON-member
	if (value instanceof RegExp) {
		return {
			$mid: 2,
			source: value.source,
			flags: regExpFlags(value),
		};
	}
	return value;
}

export function revive(obj: any, depth = 0): any {
	if (!obj || depth > 200) {
		return obj;
	}

	if (typeof obj === 'object') {

		switch ((<MarshalledObject>obj).$mid) {
			case 1: return URI.revive(obj);
			case 2: return new RegExp(obj.source, obj.flags);
		}

		// walk object (or array)
		for (let key in obj) {
			if (Object.hasOwnProperty.call(obj, key)) {
				obj[key] = revive(obj[key], depth + 1);
			}
		}
	}

	return obj;
}
