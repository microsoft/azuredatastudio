/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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
		const reverseKey = this.forward.get(key);
		if (key && reverseKey) {
			return this.forward.delete(key) && this.reverse.delete(reverseKey);
		} else {
			return false;
		}
	}

	public forEach(callbackfn: (value: V, index: K, map: Map<K, V>) => void, thisArg?: any): void {
		this.forward.forEach(callbackfn, thisArg);
	}

	public get(key: K): V | undefined {
		return this.forward.get(key);
	}

	public reverseGet(key: V): K | undefined {
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

/**
 * ASSUMES THAT THE VALUES ARE ALREADY SERIALIZABLE
 */
export function mapToSerializable<T>(map: Map<string, T>): [string, T][] {
	const serializable: [string, T][] = [];

	map.forEach((value, key) => {
		serializable.push([key, value]);
	});

	return serializable;
}

export function serializableToMap<T>(serializable: [string, T][]): Map<string, T> {
	const items = new Map<string, T>();

	for (const [key, value] of serializable) {
		items.set(key, value);
	}

	return items;
}
