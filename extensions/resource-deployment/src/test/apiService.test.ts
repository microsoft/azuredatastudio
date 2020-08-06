/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert = require('assert');
import { apiService } from '../services/apiService';

suite('API Service Tests', function (): void {

	test('getAzurecoreApi returns azure api', async () => {
		const api = await apiService.getAzurecoreApi();
		assert(api !== undefined);
	});
});
