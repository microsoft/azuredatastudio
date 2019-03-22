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

export class ReverseLookUpMap<K, V> {
	private forward = new Map<K, V>();
	private reverse = new Map<V, K>();

	public clear(): void {
		this.forward.clear();
		this.reverse.clear();
	}

	public delete(key: K): boolean {
		let reverseKey = this.forward.get(key);
		return this.forward.delete(key) && this.reverse.delete(reverseKey);
	}

    public forEach(callbackfn: (value: V, index: K, map: Map<K, V>) => void, thisArg?: any): void {
		this.forward.forEach(callbackfn, thisArg);
	}

	public get(key: K): V {
		return this.forward.get(key);
	}

	public reverseGet(key: V): K {
		return this.reverse.get(key);
	}

	public has(key: K): boolean {
		return this.forward.has(key);
	}

	public reverseHas(key: V): boolean {
		return this.reverse.has(key);
	}

	public set(key: K, value: V): ReverseLookUpMap<K, V> {
		this.forward.set(key, value);
		this.reverse.set(value, key);
		return this;
	}

	public get size(): number {
		return this.forward.size;
	}
}
