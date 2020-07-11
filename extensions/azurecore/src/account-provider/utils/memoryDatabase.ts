/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class MemoryDatabase<T> {
	db: { [key: string]: T } = {};

	constructor() {
	}

	public set(key: string, value: T): void {
		this.db[key] = value;
	}

	public delete(key: string): void {
		delete this.db[key];
	}

	public get(key: string): T {
		return this.db[key];
	}
}
