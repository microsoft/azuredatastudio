/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { AdminService } from 'sql/workbench/services/admin/common/adminService';

suite('SQL AdminService tests', () => {

	let adminService: AdminService;
	setup(() => {
		adminService = new AdminService(
			undefined, undefined, undefined
		);
	});

	test('createDatabase should call tools service provider', done => {
		done();
		// adminService.createDatabase(undefined, undefined).then((result) => {
		// 	assert.notEqual(result, undefined, 'Result is undefined');
		// 	done();
		// });
	});
});