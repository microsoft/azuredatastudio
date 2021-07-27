/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import { AzTool } from '../../az';
import { AzToolService } from '../../services/azToolService';

describe('azToolService', function (): void {
	it('Tool should be set correctly', async function (): Promise<void> {
		const service = new AzToolService();
		should(service.localAz).be.undefined();
		service.localAz = new AzTool('my path', '1.0.0');
		should(service).not.be.undefined();
	});
});
