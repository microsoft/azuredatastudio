

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as constants from '../constants';

export abstract class ProviderBase {
	public readonly providerId: string = constants.mssqlClusterProviderName;
	public handle: number;
}
