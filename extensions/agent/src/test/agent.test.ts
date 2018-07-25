/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import { JobData } from '../data/jobData';
import { TestAgentService } from './testAgentService';

const testOwnerUri = 'agent://testuri';

suite('Agent extension', () => {
	test('Create Job Data', async () => {
		let testAgentService = new TestAgentService();
		let data = new JobData(testOwnerUri, undefined, testAgentService);
		data.save();
	});
});
