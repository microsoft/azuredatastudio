/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MainContext, MainThreadLabelServiceShape } from 'vs/workbench/api/common/extHost.protocol';
import { extHostNamedCustomer, IExtHostContext } from 'vs/workbench/services/extensions/common/extHostCustomers';
import { ResourceLabelFormatter, ILabelService } from 'vs/platform/label/common/label';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';

@extHostNamedCustomer(MainContext.MainThreadLabelService)
export class MainThreadLabelService implements MainThreadLabelServiceShape {

	private readonly _resourceLabelFormatters = new Map<number, IDisposable>();

	constructor(
		_: IExtHostContext,
		@ILabelService private readonly _labelService: ILabelService
	) { }

	$registerResourceLabelFormatter(handle: number, formatter: ResourceLabelFormatter): void {
		// Dynamicily registered formatters should have priority over those contributed via package.json
		formatter.priority = true;
		const disposable = this._labelService.registerFormatter(formatter);
		this._resourceLabelFormatters.set(handle, disposable);
	}

	$unregisterResourceLabelFormatter(handle: number): void {
		dispose(this._resourceLabelFormatters.get(handle));
		this._resourceLabelFormatters.delete(handle);
	}

	dispose(): void {
		// noop
	}
}
