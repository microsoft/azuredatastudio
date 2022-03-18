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
		assert.strictEqual(mockRefreshAction.object.id, JobsRefreshAction.ID);
		assert.strictEqual(mockRefreshAction.object.label, JobsRefreshAction.LABEL);

		// Job Refresh Action from Jobs View should refresh the component
		await mockRefreshAction.object.run(null);
		mockJobsViewComponent.verify(c => c.refreshJobs(), TypeMoq.Times.once());
	});

	test('New Job Action', async () => {
		mockNewJobAction = TypeMoq.Mock.ofType(NewJobAction, TypeMoq.MockBehavior.Strict, NewJobAction.ID, NewJobAction.LABEL);
		mockNewJobAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => mockJobsViewComponent.object.openCreateJobDialog());
		mockNewJobAction.setup(s => s.id).returns(() => NewJobAction.ID);
		mockNewJobAction.setup(s => s.label).returns(() => NewJobAction.LABEL);
		assert.strictEqual(mockNewJobAction.object.id, NewJobAction.ID);
		assert.strictEqual(mockNewJobAction.object.label, NewJobAction.LABEL);

		// New Job Action from Jobs View should open a dialog
		await mockNewJobAction.object.run(null);
		mockJobsViewComponent.verify(c => c.openCreateJobDialog(), TypeMoq.Times.once());
	});

	test('Edit Job Action', async () => {
		mockEditJobAction = TypeMoq.Mock.ofType(EditJobAction, TypeMoq.MockBehavior.Strict, EditJobAction.ID, EditJobAction.LABEL);
		mockEditJobAction.setup(s => s.run(TypeMoq.It.isAny()));
		mockEditJobAction.setup(s => s.id).returns(() => EditJobAction.ID);
		mockEditJobAction.setup(s => s.label).returns(() => EditJobAction.LABEL);
		assert.strictEqual(mockEditJobAction.object.id, EditJobAction.ID);
		assert.strictEqual(mockEditJobAction.object.label, EditJobAction.LABEL);

		// Edit Job Action from Jobs View should open a dialog
		await mockEditJobAction.object.run(null);
		mockEditJobAction.verify(s => s.run(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	test('Run Job Action', async () => {
		mockRunJobAction = TypeMoq.Mock.ofType(RunJobAction, TypeMoq.MockBehavior.Strict, RunJobAction.ID, RunJobAction.LABEL, null, null, mockJobManagementService);
		mockRunJobAction.setup(s => s.run(TypeMoq.It.isAny())).returns(async () => {
			await mockJobManagementService.object.jobAction(null, null, null);
		});

		mockRunJobAction.setup(s => s.id).returns(() => RunJobAction.ID);
		mockRunJobAction.setup(s => s.label).returns(() => RunJobAction.LABEL);
		assert.strictEqual(mockRunJobAction.object.id, RunJobAction.ID);
		assert.strictEqual(mockRunJobAction.object.label, RunJobAction.LABEL);

		// Run Job Action should make the Job Management service call job action
		await mockRunJobAction.object.run(null);
		mockJobManagementService.verify(s => s.jobAction(null, null, null), TypeMoq.Times.once());
	});

	test('Stop Job Action', async () => {
		mockStopJobAction = TypeMoq.Mock.ofType(StopJobAction, TypeMoq.MockBehavior.Strict, StopJobAction.ID, StopJobAction.LABEL, null, null, mockJobManagementService);
		mockStopJobAction.setup(s => s.run(TypeMoq.It.isAny())).returns(async () => {
			await mockJobManagementService.object.jobAction(null, null, null);
		});

		mockStopJobAction.setup(s => s.id).returns(() => RunJobAction.ID);
		mockStopJobAction.setup(s => s.label).returns(() => RunJobAction.LABEL);
		assert.strictEqual(mockStopJobAction.object.id, RunJobAction.ID);
		assert.strictEqual(mockStopJobAction.object.label, RunJobAction.LABEL);

		// Run Job Action should make the Job Management service call job action
		await mockStopJobAction.object.run(null);
		mockJobManagementService.verify(s => s.jobAction(null, null, null), TypeMoq.Times.once());
	});

	test('Delete Job Action', async () => {
		mockDeleteJobAction = TypeMoq.Mock.ofType(DeleteJobAction, TypeMoq.MockBehavior.Strict, DeleteJobAction.ID, DeleteJobAction.LABEL, null, null, mockJobManagementService);
		mockDeleteJobAction.setup(s => s.run(TypeMoq.It.isAny())).returns(async () => {
			await mockJobManagementService.object.jobAction(null, null, null);
		});

		mockDeleteJobAction.setup(s => s.id).returns(() => DeleteJobAction.ID);
		mockDeleteJobAction.setup(s => s.label).returns(() => DeleteJobAction.LABEL);
		assert.strictEqual(mockDeleteJobAction.object.id, DeleteJobAction.ID);
		assert.strictEqual(mockDeleteJobAction.object.label, DeleteJobAction.LABEL);

		// Run Job Action should make the Job Management service call job action
		await mockDeleteJobAction.object.run(null);
		mockJobManagementService.verify(s => s.jobAction(null, null, null), TypeMoq.Times.once());
	});

	// Step Actions
	test('New Step Action', async () => {
		mockNewStepAction = TypeMoq.Mock.ofType(NewStepAction, TypeMoq.MockBehavior.Strict, NewJobAction.ID, NewJobAction.LABEL);
		mockNewStepAction.setup(s => s.run(TypeMoq.It.isAny()));
		mockNewStepAction.setup(s => s.id).returns(() => NewJobAction.ID);
		mockNewStepAction.setup(s => s.label).returns(() => NewJobAction.LABEL);
		assert.strictEqual(mockNewStepAction.object.id, NewJobAction.ID);
		assert.strictEqual(mockNewStepAction.object.label, NewJobAction.LABEL);

		// New Step Action should called command service
		await mockNewStepAction.object.run(null);
		mockNewStepAction.verify(s => s.run(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	test('Delete Step Action', async () => {
		mockDeleteStepAction = TypeMoq.Mock.ofType(DeleteStepAction, TypeMoq.MockBehavior.Strict, DeleteStepAction.ID, DeleteStepAction.LABEL);
		mockDeleteStepAction.setup(s => s.run(TypeMoq.It.isAny())).returns(async () => {
			await mockJobManagementService.object.deleteJobStep(null, null);
		});
		mockDeleteStepAction.setup(s => s.id).returns(() => DeleteStepAction.ID);
		mockDeleteStepAction.setup(s => s.label).returns(() => DeleteStepAction.LABEL);
		assert.strictEqual(mockDeleteStepAction.object.id, DeleteStepAction.ID);
		assert.strictEqual(mockDeleteStepAction.object.label, DeleteStepAction.LABEL);

		// Delete Step Action should called command service
		await mockDeleteStepAction.object.run(null);
		mockJobManagementService.verify(s => s.deleteJobStep(null, null), TypeMoq.Times.once());
	});

	// Alert Actions
	test('New Alert Action', async () => {
		mockNewAlertAction = TypeMoq.Mock.ofType(NewJobAction, TypeMoq.MockBehavior.Strict, NewJobAction.ID, NewJobAction.LABEL);
		mockNewAlertAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => mockAlertsViewComponent.object.openCreateAlertDialog());
		mockNewAlertAction.setup(s => s.id).returns(() => NewJobAction.ID);
		mockNewAlertAction.setup(s => s.label).returns(() => NewJobAction.LABEL);
		assert.strictEqual(mockNewAlertAction.object.id, NewJobAction.ID);
		assert.strictEqual(mockNewAlertAction.object.label, NewJobAction.LABEL);

		// New Alert Action from Alerts View should open a dialog
		await mockNewAlertAction.object.run(null);
		mockAlertsViewComponent.verify(c => c.openCreateAlertDialog(), TypeMoq.Times.once());
	});

	test('Edit Alert Action', async () => {
		mockEditAlertAction = TypeMoq.Mock.ofType(EditAlertAction, TypeMoq.MockBehavior.Strict, EditAlertAction.ID, EditAlertAction.LABEL);
		mockEditAlertAction.setup(s => s.run(TypeMoq.It.isAny()));
		mockEditAlertAction.setup(s => s.id).returns(() => EditAlertAction.ID);
		mockEditAlertAction.setup(s => s.label).returns(() => EditAlertAction.LABEL);
		assert.strictEqual(mockEditAlertAction.object.id, EditAlertAction.ID);
		assert.strictEqual(mockEditAlertAction.object.label, EditAlertAction.LABEL);

		// Edit Alert Action from Jobs View should open a dialog
		await mockEditAlertAction.object.run(null);
		mockEditAlertAction.verify(s => s.run(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	test('Delete Alert Action', async () => {
		mockDeleteAlertAction = TypeMoq.Mock.ofType(DeleteAlertAction, TypeMoq.MockBehavior.Strict, DeleteAlertAction.ID, DeleteAlertAction.LABEL, null, null, mockJobManagementService);
		mockDeleteAlertAction.setup(s => s.run(TypeMoq.It.isAny())).returns(async () => {
			await mockJobManagementService.object.deleteAlert(null, null);
		});
		mockDeleteAlertAction.setup(s => s.id).returns(() => DeleteAlertAction.ID);
		mockDeleteAlertAction.setup(s => s.label).returns(() => DeleteAlertAction.LABEL);
		assert.strictEqual(mockDeleteAlertAction.object.id, DeleteAlertAction.ID);
		assert.strictEqual(mockDeleteAlertAction.object.label, DeleteAlertAction.LABEL);

		// Delete Alert Action should call job management service
		await mockDeleteAlertAction.object.run(null);
		mockJobManagementService.verify(s => s.deleteAlert(null, null), TypeMoq.Times.once());
	});

	// Operator Tests
	test('New Operator Action', async () => {
		mockNewOperatorAction = TypeMoq.Mock.ofType(NewOperatorAction, TypeMoq.MockBehavior.Strict, NewOperatorAction.ID, NewOperatorAction.LABEL);
		mockNewOperatorAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => mockOperatorsViewComponent.object.openCreateOperatorDialog());
		mockNewOperatorAction.setup(s => s.id).returns(() => NewOperatorAction.ID);
		mockNewOperatorAction.setup(s => s.label).returns(() => NewOperatorAction.LABEL);
		assert.strictEqual(mockNewOperatorAction.object.id, NewOperatorAction.ID);
		assert.strictEqual(mockNewOperatorAction.object.label, NewOperatorAction.LABEL);

		// New Operator Action from Operators View should open a dialog
		await mockNewOperatorAction.object.run(null);
		mockOperatorsViewComponent.verify(c => c.openCreateOperatorDialog(), TypeMoq.Times.once());
	});

	test('Edit Operator Action', async () => {
		mockEditOperatorAction = TypeMoq.Mock.ofType(EditOperatorAction, TypeMoq.MockBehavior.Strict, EditOperatorAction.ID, EditOperatorAction.LABEL);
		mockEditOperatorAction.setup(s => s.run(TypeMoq.It.isAny()));
		mockEditOperatorAction.setup(s => s.id).returns(() => EditOperatorAction.ID);
		mockEditOperatorAction.setup(s => s.label).returns(() => EditOperatorAction.LABEL);
		assert.strictEqual(mockEditOperatorAction.object.id, EditOperatorAction.ID);
		assert.strictEqual(mockEditOperatorAction.object.label, EditOperatorAction.LABEL);

		// Edit Operator Action from Jobs View should open a dialog
		await mockEditOperatorAction.object.run(null);
		mockEditOperatorAction.verify(s => s.run(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	test('Delete Operator Action', async () => {
		mockDeleteOperatorAction = TypeMoq.Mock.ofType(DeleteOperatorAction, TypeMoq.MockBehavior.Strict, null, null, mockJobManagementService);
		mockDeleteOperatorAction.setup(s => s.run(TypeMoq.It.isAny())).returns(async () => {
			await mockJobManagementService.object.deleteOperator(null, null);
		});
		mockDeleteOperatorAction.setup(s => s.id).returns(() => DeleteOperatorAction.ID);
		mockDeleteOperatorAction.setup(s => s.label).returns(() => DeleteOperatorAction.LABEL);
		assert.strictEqual(mockDeleteOperatorAction.object.id, DeleteOperatorAction.ID);
		assert.strictEqual(mockDeleteOperatorAction.object.label, DeleteOperatorAction.LABEL);

		// Delete Operator Action should call job management service
		await mockDeleteOperatorAction.object.run(null);
		mockJobManagementService.verify(s => s.deleteOperator(null, null), TypeMoq.Times.once());
	});

	// Proxy Actions
	test('New Proxy Action', async () => {
		mockNewProxyAction = TypeMoq.Mock.ofType(NewProxyAction, TypeMoq.MockBehavior.Strict, NewProxyAction.ID, NewProxyAction.LABEL);
		mockNewProxyAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => mockProxiesViewComponent.object.openCreateProxyDialog());
		mockNewProxyAction.setup(s => s.id).returns(() => NewProxyAction.ID);
		mockNewProxyAction.setup(s => s.label).returns(() => NewProxyAction.LABEL);
		assert.strictEqual(mockNewProxyAction.object.id, NewProxyAction.ID);
		assert.strictEqual(mockNewProxyAction.object.label, NewProxyAction.LABEL);

		// New Proxy Action from Alerts View should open a dialog
		await mockNewProxyAction.object.run(null);
		mockProxiesViewComponent.verify(c => c.openCreateProxyDialog(), TypeMoq.Times.once());
	});

	test('Edit Proxy Action', async () => {
		mockEditProxyAction = TypeMoq.Mock.ofType(EditProxyAction, TypeMoq.MockBehavior.Strict, EditProxyAction.ID, EditProxyAction.LABEL);
		mockEditProxyAction.setup(s => s.run(TypeMoq.It.isAny()));
		mockEditProxyAction.setup(s => s.id).returns(() => EditProxyAction.ID);
		mockEditProxyAction.setup(s => s.label).returns(() => EditProxyAction.LABEL);
		assert.strictEqual(mockEditProxyAction.object.id, EditProxyAction.ID);
		assert.strictEqual(mockEditProxyAction.object.label, EditProxyAction.LABEL);

		// Edit Proxy Action from Proxies View should open a dialog
		await mockEditProxyAction.object.run(null);
		mockEditProxyAction.verify(s => s.run(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	test('Delete Proxy Action', async () => {
		mockDeleteProxyAction = TypeMoq.Mock.ofType(DeleteProxyAction, TypeMoq.MockBehavior.Strict, DeleteProxyAction.ID, DeleteProxyAction.LABEL, null, null, mockJobManagementService);
		mockDeleteProxyAction.setup(s => s.run(TypeMoq.It.isAny())).returns(async () => {
			await mockJobManagementService.object.deleteProxy(null, null);
		});
		mockDeleteProxyAction.setup(s => s.id).returns(() => DeleteProxyAction.ID);
		mockDeleteProxyAction.setup(s => s.label).returns(() => DeleteProxyAction.LABEL);
		assert.strictEqual(mockDeleteProxyAction.object.id, DeleteProxyAction.ID);
		assert.strictEqual(mockDeleteProxyAction.object.label, DeleteProxyAction.LABEL);

		// Delete Proxy Action should call job management service
		await mockDeleteProxyAction.object.run(null);
		mockJobManagementService.verify(s => s.deleteProxy(null, null), TypeMoq.Times.once());
	});
});
