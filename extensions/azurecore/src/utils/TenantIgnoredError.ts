/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class TenantIgnoredError implements Error {
	name: string = 'TENANT_IGNORED_ERROR';
	message: string;
	stack?: string | undefined;

	public constructor(errorMessage: string, stacktrace?: string | undefined) {
		this.message = errorMessage;
		this.stack = stacktrace;
	}
}
