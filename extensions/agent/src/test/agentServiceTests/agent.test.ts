/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import 'mocha';
import * as azdata from 'azdata';

const testOwnerUri = 'agent://testuri';
let mockAgentService: TypeMoq.IMock<azdata.AgentServicesProvider>;

describe('Agent extension create job objects', function (): void {
	beforeEach(() => {
		mockAgentService = TypeMoq.Mock.ofType<azdata.AgentServicesProvider>();
		mockAgentService.setup(s => s.createJob(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns(() => TypeMoq.It.isAny());
		mockAgentService.setup(s => s.createJob(undefined, TypeMoq.It.isAny())).returns(() => undefined);
		mockAgentService.setup(s => s.createAlert(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns(() => TypeMoq.It.isAny());
		mockAgentService.setup(s => s.createAlert(undefined, TypeMoq.It.isAny())).returns(() => undefined);
		mockAgentService.setup(s => s.createJobSchedule(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns(() => TypeMoq.It.isAny());
		mockAgentService.setup(s => s.createJobSchedule(undefined, TypeMoq.It.isAny())).returns(() => undefined);
		mockAgentService.setup(s => s.createJobStep(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns(() => TypeMoq.It.isAny());
		mockAgentService.setup(s => s.createJobStep(undefined, TypeMoq.It.isAny())).returns(() => undefined);
		mockAgentService.setup(s => s.createOperator(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns(() => TypeMoq.It.isAny());
		mockAgentService.setup(s => s.createOperator(undefined, TypeMoq.It.isAny())).returns(() => undefined);
		mockAgentService.setup(s => s.createProxy(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns(() => TypeMoq.It.isAny());
		mockAgentService.setup(s => s.createProxy(undefined, TypeMoq.It.isAny())).returns(() => undefined);
	});

	it('Create Job Data', async () => {
		// should fail when ownerUri is null
		let createJobResult = mockAgentService.object.createJob(null, TypeMoq.It.isAny());
		should.strictEqual(createJobResult, undefined);
		createJobResult = mockAgentService.object.createJob(testOwnerUri, TypeMoq.It.isAny());
		should.notEqual(createJobResult, undefined);
	});

	it('Create Alert Data', async () => {
		// should fail when ownerUri is null
		let createAlertResult = mockAgentService.object.createAlert(null, TypeMoq.It.isAny());
		should.strictEqual(createAlertResult, undefined);
		createAlertResult = mockAgentService.object.createAlert(testOwnerUri, TypeMoq.It.isAny());
		should.notEqual(createAlertResult, undefined);
	});

	it('Create Job Schedule Data', async () => {
		// should fail when ownerUri is null
		let createJobScheduleResult = mockAgentService.object.createJobSchedule(null, TypeMoq.It.isAny());
		should.strictEqual(createJobScheduleResult, undefined);
		createJobScheduleResult = mockAgentService.object.createJobSchedule(testOwnerUri, TypeMoq.It.isAny());
		should.notEqual(createJobScheduleResult, undefined);
	});

	it('Create Job Step Data', async () => {
		// should fail when ownerUri is null
		let createJobStepResult = mockAgentService.object.createJobStep(null, TypeMoq.It.isAny());
		should.strictEqual(createJobStepResult, undefined);
		createJobStepResult = mockAgentService.object.createJobStep(testOwnerUri, TypeMoq.It.isAny());
		should.notEqual(createJobStepResult, undefined);
	});

	it('Create Operator Data', async () => {
		// should fail when ownerUri is null
		let createOperatorResult = mockAgentService.object.createOperator(null, TypeMoq.It.isAny());
		should.strictEqual(createOperatorResult, undefined);
		createOperatorResult = mockAgentService.object.createOperator(testOwnerUri, TypeMoq.It.isAny());
		should.notEqual(createOperatorResult, undefined);
	});

	it('Create Proxy Data', async () => {
		// should fail when ownerUri is null
		let createProxyResult = mockAgentService.object.createProxy(null, TypeMoq.It.isAny());
		should.strictEqual(createProxyResult, undefined);
		createProxyResult = mockAgentService.object.createProxy(testOwnerUri, TypeMoq.It.isAny());
		should.notEqual(createProxyResult, undefined);
	});
});
