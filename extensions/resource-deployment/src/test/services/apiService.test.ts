/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import { apiService } from '../../services/apiService';
import * as assert from 'assert';

describe('API Service Tests', function (): void {
	// {{SQL CARBON TODO}} - investigate why this fails intermittently
	it.skip('get azurecoreApi returns azure api', () => {
		const api = apiService.azurecoreApi;
		assert(api !== undefined);
	});
});
