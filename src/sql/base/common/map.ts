/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

// --- trie'ish datastructure

class Node<E> {
	element?: E;
	readonly children = new Map<string, Node<E>>();
}

/**
 * A trie map that allows for fast look up when keys are substrings
 * to the actual search keys (dir/subdir-problem).
 */
export class TrieMap<E> {

	static PathSplitter = (s: string) => s.split(/[\\/]/).filter(s => !!s);

	private readonly _splitter: (s: string) => string[];
	private _root = new Node<E>();

	constructor(splitter: (s: string) => string[] = TrieMap.PathSplitter) {
		this._splitter = s => splitter(s).filter(s => Boolean(s));
	}

	insert(path: string, element: E): void {
		const parts = this._splitter(path);
		let i = 0;

		// find insertion node
		let node = this._root;
		for (; i < parts.length; i++) {
			let child = node.children.get(parts[i]);
			if (child) {
				node = child;
				continue;
			}
			break;
		}

		// create new nodes
		let newNode: Node<E>;
		for (; i < parts.length; i++) {
			newNode = new Node<E>();
			node.children.set(parts[i], newNode);
			node = newNode;
		}

		node.element = element;
	}

	lookUp(path: string): E {
		const parts = this._splitter(path);

		let { children } = this._root;
		let node: Node<E>;
		for (const part of parts) {
			node = children.get(part);
			if (!node) {
				return undefined;
			}
			children = node.children;
		}

		return node.element;
	}

	findSubstr(path: string): E {
		const parts = this._splitter(path);

		let lastNode: Node<E>;
		let { children } = this._root;
		for (const part of parts) {
			const node = children.get(part);
			if (!node) {
				break;
			}
			if (node.element) {
				lastNode = node;
			}
			children = node.children;
		}

		// return the last matching node
		// that had an element
		if (lastNode) {
			return lastNode.element;
		}
		return undefined;
	}

	findSuperstr(path: string): TrieMap<E> {
		const parts = this._splitter(path);

		let { children } = this._root;
		let node: Node<E>;
		for (const part of parts) {
			node = children.get(part);
			if (!node) {
				return undefined;
			}
			children = node.children;
		}

		const result = new TrieMap<E>(this._splitter);
		result._root = node;
		return result;
	}
}

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
