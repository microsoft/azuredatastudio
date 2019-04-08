/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { JobData } from '../data/jobData';
import { AgentUtils } from '../agentUtils';

const testOwnerUri = 'agent://testuri';
let mockAgentService: TypeMoq.Mock<azdata.AgentServicesProvider>;
let mockAgentUtils: TypeMoq.IMock.ofInstance<AgentUtils>;

describe('Agent extension', function (): void {
	beforeEach(() => {
		mockAgentService = TypeMoq.Mock.ofType<azdata.AgentServicesProvider>(TypeMoq.It.isAny());
		mockAgentUtils = TypeMoq.Mock.ofType<AgentUtils>(TypeMoq.It.isAny());
		mockAgentUtils.setup((o) => o.getAgentService().returns(() => mockAgentService));
	});

	it('Create Job Data', async () => {
		let data = new JobData(testOwnerUri, undefined, null);
		data.save();
	});
});
