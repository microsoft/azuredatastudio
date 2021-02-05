/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { TestInstantiationService as VsTestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';

/**
 * An extension of the VS TestInstantiationService which allows for stubbing out createInstance calls
 * as well as services.
 */
export class TestInstantiationService extends VsTestInstantiationService {

	private _createInstanceStubsMap: Map<any | SyncDescriptor<any>, any> = new Map<any | SyncDescriptor<any>, any>();

	/**
	 * Adds a stub for a ctor or descriptor which is then returned when createInstance is called
	 * for that ctor or descriptor.
	 * @param ctorOrDescriptor The ctor or descriptor to stub out
	 * @param obj The object to return instead when createInstance is invoked
	 */
	public stubCreateInstance(ctorOrDescriptor: any | SyncDescriptor<any>, obj: any): void {
		this._createInstanceStubsMap.set(ctorOrDescriptor, obj);
	}

	createInstance(ctorOrDescriptor: any | SyncDescriptor<any>, ...rest: any[]): any {
		if (this._createInstanceStubsMap.has(ctorOrDescriptor)) {
			return this._createInstanceStubsMap.get(ctorOrDescriptor);
		}
		return super.createInstance(ctorOrDescriptor, ...rest);
	}
}
