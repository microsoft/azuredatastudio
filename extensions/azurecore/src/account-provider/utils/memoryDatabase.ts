/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class MemoryDatabase {
	db: { [key: string]: string } = {};

	constructor() {
	}

	public set(key: string, value: string): void {
		this.db[key] = value;
	}

	public delete(key: string): void {
		delete this.db[key];
	}

	public get(key: string): string {
		return this.db[key];
	}
}
