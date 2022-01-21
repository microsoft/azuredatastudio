/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SinonStub, stub } from 'sinon';

export interface Ctor<T> {
	new(): T;
}

export function mock<T>(): Ctor<T> {
	return function () { } as any;
}

export type MockObject<T, TP = {}> = { [K in keyof T]: K extends keyof TP ? TP[K] : SinonStub };

// Creates an object object that returns sinon mocks for every property. Optionally
// takes base properties.
export function mockObject<T extends object, TP extends Partial<T>>(properties?: TP): MockObject<T, TP> {
	return new Proxy({ ...properties } as any, {
		get(target, key) {
			if (!target.hasOwnProperty(key)) {
				target[key] = stub();
			}

			return target[key];
		},
		set(target, key, value) {
			target[key] = value;
			return true;
		},
	});
}
