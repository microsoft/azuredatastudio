/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { localize } from 'vs/nls';

export interface FutureInternal extends nb.IFuture {
	inProgress: boolean;
}

export namespace notebookConstants {
	export const SQL = 'SQL';
	export const SQL_CONNECTION_PROVIDER = mssqlProviderName;
	export const sqlKernel: string = localize('sqlKernel', "SQL");
	export const sqlKernelSpec: nb.IKernelSpec = ({
		name: sqlKernel,
		language: 'sql',
		display_name: sqlKernel
	});
}
