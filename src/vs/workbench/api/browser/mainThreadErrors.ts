/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SerializedError, onUnexpectedError, ErrorNoTelemetry } from 'vs/base/common/errors';
import { extHostNamedCustomer } from 'vs/workbench/services/extensions/common/extHostCustomers';
import { MainContext, MainThreadErrorsShape } from 'vs/workbench/api/common/extHost.protocol';

@extHostNamedCustomer(MainContext.MainThreadErrors)
export class MainThreadErrors implements MainThreadErrorsShape {

	dispose(): void {
		//
	}

	$onUnexpectedError(err: any | SerializedError): void {
		if (err && err.$isError) {
			const { name, message, stack } = err;
			err = err.noTelemetry ? new ErrorNoTelemetry() : new Error();
			err.message = message;
			err.name = name;
			err.stack = stack;
		}
		onUnexpectedError(err);
	}
}
