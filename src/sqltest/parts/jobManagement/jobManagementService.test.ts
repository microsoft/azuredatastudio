/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { JobManagementService } from 'sql/platform/jobManagement/common/jobManagementService';

// TESTS ///////////////////////////////////////////////////////////////////
suite('Job Management service tests', () => {
	setup(() => {
	});

	test('Construction - Job Service Initialization', () => {
		// ... Create instance of the service and reder account picker
		let service = new JobManagementService(undefined);
	});
});
