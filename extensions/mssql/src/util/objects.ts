/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function equals(one: any, other: any, strictArrayCompare: boolean = true): boolean {
	if (one === other) {
		return true;
	}
	if (one === null || one === undefined || other === null || other === undefined) {
		return false;
	}
	if (typeof one !== typeof other) {
		return false;
	}
	if (typeof one !== 'object') {
		return false;
	}
	if ((Array.isArray(one)) !== (Array.isArray(other))) {
		return false;
	}

	let i: number;
	let key: string;

	if (Array.isArray(one)) {
		if (one.length !== other.length) {
			return false;
		}
		for (i = 0; i < one.length; i++) {
			if (strictArrayCompare) {
				if (!equals(one[i], other[i], strictArrayCompare)) {
					return false;
				}
			} else {
				let match = false;
				for (let j = 0; j < other.length; j++) {
					if (equals(one[i], other[j], strictArrayCompare)) {
						match = true;
						break;
					}
				}
				if (!match) {
					return false;
				}
			}
		}
	} else {
		const oneKeys: string[] = [];

		for (key in one) {
			oneKeys.push(key);
		}
		oneKeys.sort();
		const otherKeys: string[] = [];
		for (key in other) {
			otherKeys.push(key);
		}
		otherKeys.sort();
		if (!equals(oneKeys, otherKeys, strictArrayCompare)) {
			return false;
		}
		for (i = 0; i < oneKeys.length; i++) {
			if (!equals(one[oneKeys[i]], other[oneKeys[i]], strictArrayCompare)) {
				return false;
			}
		}
	}
	return true;
}

export function deepClone<T>(obj: T): T {
	if (!obj || typeof obj !== 'object') {
		return obj;
	}
	if (obj instanceof RegExp) {
		// See https://github.com/Microsoft/TypeScript/issues/10990
		return obj as any;
	}
	const result: any = Array.isArray(obj) ? [] : {};
	Object.keys(<any>obj).forEach((key: string) => {
		if ((<any>obj)[key] && typeof (<any>obj)[key] === 'object') {
			result[key] = deepClone((<any>obj)[key]) as unknown;
		} else {
			result[key] = (<any>obj)[key] as unknown;
		}
	});
	return result;
}
