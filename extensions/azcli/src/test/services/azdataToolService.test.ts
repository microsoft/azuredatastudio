/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import { AzdataTool } from '../../azdata';
import { AzdataToolService } from '../../services/azdataToolService';

describe('azdataToolService', function (): void {
	it('Tool should be set correctly', async function (): Promise<void> {
		const service = new AzdataToolService();
		should(service.localAzdata).be.undefined();
		service.localAzdata = new AzdataTool('my path', '1.0.0');
		should(service).not.be.undefined();
	});
});
