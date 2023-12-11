/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class IdGenerator {

	private _prefix: string;
	private _lastId: number;

	constructor(prefix: string) {
		this._prefix = prefix;
		this._lastId = 0;
	}

	public nextId(): string {
		/**
		 * {{SQL CARBON EDIT}}
		 * Adding suffix at the end of id to avoid the id getting picked up by faulty
		 * string matching logic that only checks for id prefixes to find the match.
		 */
		return this._prefix + (++this._lastId) + '-id';
	}
}

export const defaultGenerator = new IdGenerator('id#');
