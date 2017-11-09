/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ISqlOAuthService } from 'sql/common/sqlOAuthService';

export class SqlOAuthTestService implements ISqlOAuthService {
	_serviceBrand: any;

	performOAuthAuthorization(eventId: string, url: string, silent: boolean): void {
	}

	registerOAuthCallback(handler: (event, args) => void): void {
	}
}
