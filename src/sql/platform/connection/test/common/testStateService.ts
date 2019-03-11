/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IStateService } from 'vs/platform/state/common/state';

export class TestStateService implements IStateService {
	_serviceBrand: any;

	private storage = {};

	constructor() {}

	getItem<T>(key: string, defaultValue: T): T;
	getItem<T>(key: string, defaultValue: T | undefined): T | undefined;
	getItem<T>(key: string, defaultValue?: T): T | undefined {
		return this.storage[key] || defaultValue;
	}

	setItem(key: string, data: any): void {
		this.storage[key] = data;
	}

	removeItem(key: string): void {
		delete this.storage[key];
	}
}
