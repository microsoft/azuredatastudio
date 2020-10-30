/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert = require('assert');
import { apiService } from '../../services/apiService';

describe('API Service Tests', function (): void {
	it('get azurecoreApi returns azure api', () => {
		const api = apiService.azurecoreApi;
		assert(api !== undefined);
	});
	it.skip('get azdataApi returns azdata api', () => {
		const api = apiService.azdataApi;
		assert(api !== undefined);
	});
});
