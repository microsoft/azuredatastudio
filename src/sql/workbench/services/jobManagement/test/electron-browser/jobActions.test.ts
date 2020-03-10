/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { JobsRefreshAction, NewJobAction, EditJobAction, RunJobAction, StopJobAction, DeleteJobAction, NewStepAction, DeleteStepAction, NewAlertAction, EditAlertAction, DeleteAlertAction, NewOperatorAction, EditOperatorAction, DeleteOperatorAction, NewProxyAction, EditProxyAction, DeleteProxyAction } from 'sql/workbench/contrib/jobManagement/browser/jobActions';
import { JobManagementService } from 'sql/workbench/services/jobManagement/common/jobManagementService';

// Mock View Components
let mockJobsViewComponent: TypeMoq.Mock<TestJobManagementView>;
let mockAlertsViewComponent: TypeMoq.Mock<TestJobManagementView>;
let mockOperatorsViewComponent: TypeMoq.Mock<TestJobManagementView>;
let mockProxiesViewComponent: TypeMoq.Mock<TestJobManagementView>;
let mockJobManagementService: TypeMoq.Mock<JobManagementService>;

// Mock Job Actions
let mockRefreshAction: TypeMoq.Mock<JobsRefreshAction>;
let mockNewJobAction: TypeMoq.Mock<NewJobAction>;
let mockEditJobAction: TypeMoq.Mock<EditJobAction>;
let mockRunJobAction: TypeMoq.Mock<RunJobAction>;
let mockStopJobAction: TypeMoq.Mock<StopJobAction>;
let mockDeleteJobAction: TypeMoq.Mock<DeleteJobAction>;

// Mock Step Actions
let mockNewStepAction: TypeMoq.Mock<NewStepAction>;
let mockDeleteStepAction: TypeMoq.Mock<DeleteStepAction>;

// Mock Alert Actions
let mockNewAlertAction: TypeMoq.Mock<NewAlertAction>;
let mockEditAlertAction: TypeMoq.Mock<EditAlertAction>;
let mockDeleteAlertAction: TypeMoq.Mock<DeleteAlertAction>;

// Mock Operator Actions
let mockNewOperatorAction: TypeMoq.Mock<NewOperatorAction>;
let mockEditOperatorAction: TypeMoq.Mock<EditOperatorAction>;
let mockDeleteOperatorAction: TypeMoq.Mock<DeleteOperatorAction>;

// Mock Proxy Actions
let mockNewProxyAction: TypeMoq.Mock<NewProxyAction>;
let mockEditProxyAction: TypeMoq.Mock<EditProxyAction>;
let mockDeleteProxyAction: TypeMoq.Mock<DeleteProxyAction>;

/**
 * Class to test Job Management Views
 */
class TestJobManagementView {

	refreshJobs() { return undefined; }

	openCreateJobDialog() { return undefined; }

	openCreateAlertDialog() { return undefined; }

	openCreateOperatorDialog() { return undefined; }

	openCreateProxyDialog() { return undefined; }
}

// Tests
suite('Job Management Actions', () => {

	// Job Actions
	setup(() => {
		mockJobsViewComponent = TypeMoq.Mock.ofType<TestJobManagementView>(TestJobManagementView);
		mockAlertsViewComponent = TypeMoq.Mock.ofType<TestJobManagementView>(TestJobManagementView);
		mockOperatorsViewComponent = TypeMoq.Mock.ofType<TestJobManagementView>(TestJobManagementView);
		mockProxiesViewComponent = TypeMoq.Mock.ofType<TestJobManagementView>(TestJobManagementView);
		mockJobManagementService = TypeMoq.Mock.ofType<JobManagementService>(JobManagementService);
		let resultStatus: azdata.ResultStatus = {
			success: true,
			errorMessage: null
		};
		mockJobManagementService.setup(s => s.jobAction(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(resultStatus));
		mockJobManagementService.setup(s => s.deleteJobStep(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(resultStatus));
		mockJobManagementService.setup(s => s.deleteProxy(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(resultStatus));
		mockJobManagementService.setup(s => s.deleteOperator(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(resultStatus));
		mockJobManagementService.setup(s => s.deleteAlert(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(resultStatus));
	});

	test('Jobs Refresh Action', async () => {
		mockRefreshAction = TypeMoq.Mock.ofType(JobsRefreshAction, TypeMoq.MockBehavior.Strict, JobsRefreshAction.ID, JobsRefreshAction.LABEL);
		mockRefreshAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => mockJobsViewComponent.object.refreshJobs());
		mockRefreshAction.setup(s => s.id).returns(() => JobsRefreshAction.ID);
		mockRefreshAction.setup(s => s.label).returns(() => JobsRefreshAction.LABEL);
		assert.equal(mockRefreshAction.object.id, JobsRefreshAction.ID);
		assert.equal(mockRefreshAction.object.label, JobsRefreshAction.LABEL);

		// Job Refresh Action from Jobs View should refresh the component
		await mockRefreshAction.object.run(null);
		mockJobsViewComponent.verify(c => c.refreshJobs(), TypeMoq.Times.once());
	});

	test('New Job Action', async () => {
		mockNewJobAction = TypeMoq.Mock.ofType(NewJobAction, TypeMoq.MockBehavior.Strict, NewJobAction.ID, NewJobAction.LABEL);
		mockNewJobAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => mockJobsViewComponent.object.openCreateJobDialog());
		mockNewJobAction.setup(s => s.id).returns(() => NewJobAction.ID);
		mockNewJobAction.setup(s => s.label).returns(() => NewJobAction.LABEL);
		assert.equal(mockNewJobAction.object.id, NewJobAction.ID);
		assert.equal(mockNewJobAction.object.label, NewJobAction.LABEL);

		// New Job Action from Jobs View should open a dialog
		await mockNewJobAction.object.run(null);
		mockJobsViewComponent.verify(c => c.openCreateJobDialog(), TypeMoq.Times.once());
	});

	test('Edit Job Action', async () => {
		mockEditJobAction = TypeMoq.Mock.ofType(EditJobAction, TypeMoq.MockBehavior.Strict, EditJobAction.ID, EditJobAction.LABEL);
		let commandServiceCalled: boolean = false;
		mockEditJobAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => {
			commandServiceCalled = true;
			return Promise.resolve(commandServiceCalled);
		});
		mockEditJobAction.setup(s => s.id).returns(() => EditJobAction.ID);
		mockEditJobAction.setup(s => s.label).returns(() => EditJobAction.LABEL);
		assert.equal(mockEditJobAction.object.id, EditJobAction.ID);
		assert.equal(mockEditJobAction.object.label, EditJobAction.LABEL);

		// Edit Job Action from Jobs View should open a dialog
		await mockEditJobAction.object.run(null);
		assert(commandServiceCalled);
	});

	test('Run Job Action', async () => {
		mockRunJobAction = TypeMoq.Mock.ofType(RunJobAction, TypeMoq.MockBehavior.Strict, RunJobAction.ID, RunJobAction.LABEL, null, null, mockJobManagementService);
		mockRunJobAction.setup(s => s.run(TypeMoq.It.isAny())).returns(async () => {
			let result = await mockJobManagementService.object.jobAction(null, null, null).then((result) => result.success);
			return result;
		});

		mockRunJobAction.setup(s => s.id).returns(() => RunJobAction.ID);
		mockRunJobAction.setup(s => s.label).returns(() => RunJobAction.LABEL);
		assert.equal(mockRunJobAction.object.id, RunJobAction.ID);
		assert.equal(mockRunJobAction.object.label, RunJobAction.LABEL);

		// Run Job Action should make the Job Management service call job action
		await mockRunJobAction.object.run(null);
		mockJobManagementService.verify(s => s.jobAction(null, null, null), TypeMoq.Times.once());
	});

	test('Stop Job Action', async () => {
		mockStopJobAction = TypeMoq.Mock.ofType(StopJobAction, TypeMoq.MockBehavior.Strict, StopJobAction.ID, StopJobAction.LABEL, null, null, mockJobManagementService);
		mockStopJobAction.setup(s => s.run(TypeMoq.It.isAny())).returns(async () => {
			let result = await mockJobManagementService.object.jobAction(null, null, null).then((result) => result.success);
			return result;
		});

		mockStopJobAction.setup(s => s.id).returns(() => RunJobAction.ID);
		mockStopJobAction.setup(s => s.label).returns(() => RunJobAction.LABEL);
		assert.equal(mockStopJobAction.object.id, RunJobAction.ID);
		assert.equal(mockStopJobAction.object.label, RunJobAction.LABEL);

		// Run Job Action should make the Job Management service call job action
		await mockStopJobAction.object.run(null);
		mockJobManagementService.verify(s => s.jobAction(null, null, null), TypeMoq.Times.once());
	});

	test('Delete Job Action', async () => {
		mockDeleteJobAction = TypeMoq.Mock.ofType(DeleteJobAction, TypeMoq.MockBehavior.Strict, DeleteJobAction.ID, DeleteJobAction.LABEL, null, null, mockJobManagementService);
		mockDeleteJobAction.setup(s => s.run(TypeMoq.It.isAny())).returns(async () => {
			let result = await mockJobManagementService.object.jobAction(null, null, null).then((result) => result.success);
			return result;
		});

		mockDeleteJobAction.setup(s => s.id).returns(() => DeleteJobAction.ID);
		mockDeleteJobAction.setup(s => s.label).returns(() => DeleteJobAction.LABEL);
		assert.equal(mockDeleteJobAction.object.id, DeleteJobAction.ID);
		assert.equal(mockDeleteJobAction.object.label, DeleteJobAction.LABEL);

		// Run Job Action should make the Job Management service call job action
		await mockDeleteJobAction.object.run(null);
		mockJobManagementService.verify(s => s.jobAction(null, null, null), TypeMoq.Times.once());
	});

	// Step Actions
	test('New Step Action', async () => {
		mockNewStepAction = TypeMoq.Mock.ofType(NewStepAction, TypeMoq.MockBehavior.Strict, NewJobAction.ID, NewJobAction.LABEL);
		let commandServiceCalled = false;
		mockNewStepAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => {
			commandServiceCalled = true;
			return Promise.resolve(commandServiceCalled);
		});
		mockNewStepAction.setup(s => s.id).returns(() => NewJobAction.ID);
		mockNewStepAction.setup(s => s.label).returns(() => NewJobAction.LABEL);
		assert.equal(mockNewStepAction.object.id, NewJobAction.ID);
		assert.equal(mockNewStepAction.object.label, NewJobAction.LABEL);

		// New Step Action should called command service
		await mockNewStepAction.object.run(null);
		assert(commandServiceCalled);
	});

	test('Delete Step Action', async () => {
		mockDeleteStepAction = TypeMoq.Mock.ofType(DeleteStepAction, TypeMoq.MockBehavior.Strict, DeleteStepAction.ID, DeleteStepAction.LABEL);
		let commandServiceCalled = false;
		mockDeleteStepAction.setup(s => s.run(TypeMoq.It.isAny())).returns(async () => {
			commandServiceCalled = true;
			await mockJobManagementService.object.deleteJobStep(null, null).then((result) => result.success);
			return commandServiceCalled;
		});
		mockDeleteStepAction.setup(s => s.id).returns(() => DeleteStepAction.ID);
		mockDeleteStepAction.setup(s => s.label).returns(() => DeleteStepAction.LABEL);
		assert.equal(mockDeleteStepAction.object.id, DeleteStepAction.ID);
		assert.equal(mockDeleteStepAction.object.label, DeleteStepAction.LABEL);

		// Delete Step Action should called command service
		await mockDeleteStepAction.object.run(null);
		assert(commandServiceCalled);
		mockJobManagementService.verify(s => s.deleteJobStep(null, null), TypeMoq.Times.once());
	});

	// Alert Actions
	test('New Alert Action', async () => {
		mockNewAlertAction = TypeMoq.Mock.ofType(NewJobAction, TypeMoq.MockBehavior.Strict, NewJobAction.ID, NewJobAction.LABEL);
		mockNewAlertAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => mockAlertsViewComponent.object.openCreateAlertDialog());
		mockNewAlertAction.setup(s => s.id).returns(() => NewJobAction.ID);
		mockNewAlertAction.setup(s => s.label).returns(() => NewJobAction.LABEL);
		assert.equal(mockNewAlertAction.object.id, NewJobAction.ID);
		assert.equal(mockNewAlertAction.object.label, NewJobAction.LABEL);

		// New Alert Action from Alerts View should open a dialog
		await mockNewAlertAction.object.run(null);
		mockAlertsViewComponent.verify(c => c.openCreateAlertDialog(), TypeMoq.Times.once());
	});

	test('Edit Alert Action', async () => {
		mockEditAlertAction = TypeMoq.Mock.ofType(EditAlertAction, TypeMoq.MockBehavior.Strict, EditAlertAction.ID, EditAlertAction.LABEL);
		let commandServiceCalled: boolean = false;
		mockEditAlertAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => {
			commandServiceCalled = true;
			return Promise.resolve(commandServiceCalled);
		});
		mockEditAlertAction.setup(s => s.id).returns(() => EditAlertAction.ID);
		mockEditAlertAction.setup(s => s.label).returns(() => EditAlertAction.LABEL);
		assert.equal(mockEditAlertAction.object.id, EditAlertAction.ID);
		assert.equal(mockEditAlertAction.object.label, EditAlertAction.LABEL);

		// Edit Alert Action from Jobs View should open a dialog
		await mockEditAlertAction.object.run(null);
		assert(commandServiceCalled);
	});

	test('Delete Alert Action', async () => {
		mockDeleteAlertAction = TypeMoq.Mock.ofType(DeleteAlertAction, TypeMoq.MockBehavior.Strict, DeleteAlertAction.ID, DeleteAlertAction.LABEL, null, null, mockJobManagementService);
		let commandServiceCalled = false;
		mockDeleteAlertAction.setup(s => s.run(TypeMoq.It.isAny())).returns(async () => {
			commandServiceCalled = true;
			await mockJobManagementService.object.deleteAlert(null, null).then((result) => result.success);
			return commandServiceCalled;
		});
		mockDeleteAlertAction.setup(s => s.id).returns(() => DeleteAlertAction.ID);
		mockDeleteAlertAction.setup(s => s.label).returns(() => DeleteAlertAction.LABEL);
		assert.equal(mockDeleteAlertAction.object.id, DeleteAlertAction.ID);
		assert.equal(mockDeleteAlertAction.object.label, DeleteAlertAction.LABEL);

		// Delete Alert Action should call job management service
		await mockDeleteAlertAction.object.run(null);
		assert(commandServiceCalled);
		mockJobManagementService.verify(s => s.deleteAlert(null, null), TypeMoq.Times.once());
	});

	// Operator Tests
	test('New Operator Action', async () => {
		mockNewOperatorAction = TypeMoq.Mock.ofType(NewOperatorAction, TypeMoq.MockBehavior.Strict, NewOperatorAction.ID, NewOperatorAction.LABEL);
		mockNewOperatorAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => mockOperatorsViewComponent.object.openCreateOperatorDialog());
		mockNewOperatorAction.setup(s => s.id).returns(() => NewOperatorAction.ID);
		mockNewOperatorAction.setup(s => s.label).returns(() => NewOperatorAction.LABEL);
		assert.equal(mockNewOperatorAction.object.id, NewOperatorAction.ID);
		assert.equal(mockNewOperatorAction.object.label, NewOperatorAction.LABEL);

		// New Operator Action from Operators View should open a dialog
		await mockNewOperatorAction.object.run(null);
		mockOperatorsViewComponent.verify(c => c.openCreateOperatorDialog(), TypeMoq.Times.once());
	});

	test('Edit Operator Action', async () => {
		mockEditOperatorAction = TypeMoq.Mock.ofType(EditOperatorAction, TypeMoq.MockBehavior.Strict, EditOperatorAction.ID, EditOperatorAction.LABEL);
		let commandServiceCalled: boolean = false;
		mockEditOperatorAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => {
			commandServiceCalled = true;
			return Promise.resolve(commandServiceCalled);
		});
		mockEditOperatorAction.setup(s => s.id).returns(() => EditOperatorAction.ID);
		mockEditOperatorAction.setup(s => s.label).returns(() => EditOperatorAction.LABEL);
		assert.equal(mockEditOperatorAction.object.id, EditOperatorAction.ID);
		assert.equal(mockEditOperatorAction.object.label, EditOperatorAction.LABEL);

		// Edit Operator Action from Jobs View should open a dialog
		await mockEditOperatorAction.object.run(null);
		assert(commandServiceCalled);
	});

	test('Delete Operator Action', async () => {
		mockDeleteOperatorAction = TypeMoq.Mock.ofType(DeleteOperatorAction, TypeMoq.MockBehavior.Strict, DeleteOperatorAction.ID, DeleteOperatorAction.LABEL, null, null, mockJobManagementService);
		let commandServiceCalled = false;
		mockDeleteOperatorAction.setup(s => s.run(TypeMoq.It.isAny())).returns(async () => {
			commandServiceCalled = true;
			await mockJobManagementService.object.deleteOperator(null, null).then((result) => result.success);
			return commandServiceCalled;
		});
		mockDeleteOperatorAction.setup(s => s.id).returns(() => DeleteOperatorAction.ID);
		mockDeleteOperatorAction.setup(s => s.label).returns(() => DeleteOperatorAction.LABEL);
		assert.equal(mockDeleteOperatorAction.object.id, DeleteOperatorAction.ID);
		assert.equal(mockDeleteOperatorAction.object.label, DeleteOperatorAction.LABEL);

		// Delete Operator Action should call job management service
		await mockDeleteOperatorAction.object.run(null);
		assert(commandServiceCalled);
		mockJobManagementService.verify(s => s.deleteOperator(null, null), TypeMoq.Times.once());
	});

	// Proxy Actions
	test('New Proxy Action', async () => {
		mockNewProxyAction = TypeMoq.Mock.ofType(NewProxyAction, TypeMoq.MockBehavior.Strict, NewProxyAction.ID, NewProxyAction.LABEL);
		mockNewProxyAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => mockProxiesViewComponent.object.openCreateProxyDialog());
		mockNewProxyAction.setup(s => s.id).returns(() => NewProxyAction.ID);
		mockNewProxyAction.setup(s => s.label).returns(() => NewProxyAction.LABEL);
		assert.equal(mockNewProxyAction.object.id, NewProxyAction.ID);
		assert.equal(mockNewProxyAction.object.label, NewProxyAction.LABEL);

		// New Proxy Action from Alerts View should open a dialog
		await mockNewProxyAction.object.run(null);
		mockProxiesViewComponent.verify(c => c.openCreateProxyDialog(), TypeMoq.Times.once());
	});

	test('Edit Proxy Action', async () => {
		mockEditProxyAction = TypeMoq.Mock.ofType(EditProxyAction, TypeMoq.MockBehavior.Strict, EditProxyAction.ID, EditProxyAction.LABEL);
		let commandServiceCalled: boolean = false;
		mockEditProxyAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => {
			commandServiceCalled = true;
			return Promise.resolve(commandServiceCalled);
		});
		mockEditProxyAction.setup(s => s.id).returns(() => EditProxyAction.ID);
		mockEditProxyAction.setup(s => s.label).returns(() => EditProxyAction.LABEL);
		assert.equal(mockEditProxyAction.object.id, EditProxyAction.ID);
		assert.equal(mockEditProxyAction.object.label, EditProxyAction.LABEL);

		// Edit Proxy Action from Proxies View should open a dialog
		await mockEditProxyAction.object.run(null);
		assert(commandServiceCalled);
	});

	test('Delete Proxy Action', async () => {
		mockDeleteProxyAction = TypeMoq.Mock.ofType(DeleteProxyAction, TypeMoq.MockBehavior.Strict, DeleteProxyAction.ID, DeleteProxyAction.LABEL, null, null, mockJobManagementService);
		let commandServiceCalled = false;
		mockDeleteProxyAction.setup(s => s.run(TypeMoq.It.isAny())).returns(async () => {
			commandServiceCalled = true;
			await mockJobManagementService.object.deleteProxy(null, null).then((result) => result.success);
			return commandServiceCalled;
		});
		mockDeleteProxyAction.setup(s => s.id).returns(() => DeleteProxyAction.ID);
		mockDeleteProxyAction.setup(s => s.label).returns(() => DeleteProxyAction.LABEL);
		assert.equal(mockDeleteProxyAction.object.id, DeleteProxyAction.ID);
		assert.equal(mockDeleteProxyAction.object.label, DeleteProxyAction.LABEL);

		// Delete Proxy Action should call job management service
		await mockDeleteProxyAction.object.run(null);
		assert(commandServiceCalled);
		mockJobManagementService.verify(s => s.deleteProxy(null, null), TypeMoq.Times.once());
	});
});
