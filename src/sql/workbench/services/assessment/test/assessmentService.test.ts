/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AssessmentService } from 'sql/workbench/services/assessment/common/assessmentService';
import * as assert from 'assert';

// TESTS ///////////////////////////////////////////////////////////////////
suite('Assessment service tests', () => {
	setup(() => {
	});

	test('Construction - Assessment service Initialization', () => {
		let service = new AssessmentService(undefined);
		assert(service);
	});

});
