/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';

export class StorageTestService implements IStorageService {
	_serviceBrand: any;

	/**
	 * Store a string value under the given key to local storage.
	 *
	 * The optional scope argument allows to define the scope of the operation.
	 */
	store(key: string, value: any, scope?: StorageScope): void {

	}

	/**
	 * Swap the value of a stored element to one of the two provided
	 * values and use the defaultValue if no element with the given key
	 * exists.
	 *
	 * The optional scope argument allows to define the scope of the operation.
	 */
	swap(key: string, valueA: any, valueB: any, scope?: StorageScope, defaultValue?: any): void {

	}

	/**
	 * Delete an element stored under the provided key from local storage.
	 *
	 * The optional scope argument allows to define the scope of the operation.
	 */
	remove(key: string, scope?: StorageScope): void {

	}

	/**
	 * Retrieve an element stored with the given key from local storage. Use
	 * the provided defaultValue if the element is null or undefined.
	 *
	 * The optional scope argument allows to define the scope of the operation.
	 */
	get(key: string, scope?: StorageScope, defaultValue?: string): string {
		return undefined;
	}

	/**
	 * Retrieve an element stored with the given key from local storage. Use
	 * the provided defaultValue if the element is null or undefined. The element
	 * will be converted to a number using parseInt with a base of 10.
	 *
	 * The optional scope argument allows to define the scope of the operation.
	 */
	getInteger(key: string, scope?: StorageScope, defaultValue?: number): number {
		return 0;
	}

	/**
	 * Retrieve an element stored with the given key from local storage. Use
	 * the provided defaultValue if the element is null or undefined. The element
	 * will be converted to a boolean.
	 *
	 * The optional scope argument allows to define the scope of the operation.
	 */
	getBoolean(key: string, scope?: StorageScope, defaultValue?: boolean): boolean {
		return true;
	}
}