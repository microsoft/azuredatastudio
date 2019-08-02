/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as TypeMoq from 'typemoq';
import { JobsRefreshAction, NewJobAction, EditJobAction, RunJobAction, StopJobAction, DeleteJobAction, NewStepAction, DeleteStepAction, NewAlertAction, EditAlertAction, DeleteAlertAction, NewOperatorAction, EditOperatorAction, DeleteOperatorAction, NewProxyAction, EditProxyAction, DeleteProxyAction } from 'sql/platform/jobManagement/browser/jobActions';
import { JobManagementService } from 'sql/platform/jobManagement/common/jobManagementService';

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
	});

	test('Jobs Refresh Action', (done) => {
		mockRefreshAction = TypeMoq.Mock.ofType(JobsRefreshAction, TypeMoq.MockBehavior.Strict, JobsRefreshAction.ID, JobsRefreshAction.LABEL);
		mockRefreshAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => mockJobsViewComponent.object.refreshJobs());
		mockRefreshAction.setup(s => s.id).returns(() => JobsRefreshAction.ID);
		mockRefreshAction.setup(s => s.label).returns(() => JobsRefreshAction.LABEL);
		should(mockRefreshAction.object.id).equal(JobsRefreshAction.ID);
		should(mockRefreshAction.object.label).equal(JobsRefreshAction.LABEL);

		// Job Refresh Action from Jobs View should refresh the component
		mockRefreshAction.object.run(null);
		mockJobsViewComponent.verify(c => c.refreshJobs(), TypeMoq.Times.once());
		done();
	});

	test('New Job Action', (done) => {
		mockNewJobAction = TypeMoq.Mock.ofType(NewJobAction, TypeMoq.MockBehavior.Strict, NewJobAction.ID, NewJobAction.LABEL);
		mockNewJobAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => mockJobsViewComponent.object.openCreateJobDialog());
		mockNewJobAction.setup(s => s.id).returns(() => NewJobAction.ID);
		mockNewJobAction.setup(s => s.label).returns(() => NewJobAction.LABEL);
		should(mockNewJobAction.object.id).equal(NewJobAction.ID);
		should(mockNewJobAction.object.label).equal(NewJobAction.LABEL);

		// New Job Action from Jobs View should open a dialog
		mockNewJobAction.object.run(null);
		mockJobsViewComponent.verify(c => c.openCreateJobDialog(), TypeMoq.Times.once());
		done();
	});

	test('Edit Job Action', (done) => {
		mockEditJobAction = TypeMoq.Mock.ofType(EditJobAction, TypeMoq.MockBehavior.Strict, EditJobAction.ID, EditJobAction.LABEL);
		let commandServiceCalled: boolean = false;
		mockEditJobAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => {
			commandServiceCalled = true;
			return Promise.resolve(commandServiceCalled);
		});
		mockEditJobAction.setup(s => s.id).returns(() => EditJobAction.ID);
		mockEditJobAction.setup(s => s.label).returns(() => EditJobAction.LABEL);
		should(mockEditJobAction.object.id).equal(EditJobAction.ID);
		should(mockEditJobAction.object.label).equal(EditJobAction.LABEL);

		// Edit Job Action from Jobs View should open a dialog
		mockEditJobAction.object.run(null);
		should(commandServiceCalled).equal(true);
		done();
	});

	test('Run Job Action', (done) => {
		mockRunJobAction = TypeMoq.Mock.ofType(RunJobAction, TypeMoq.MockBehavior.Strict, RunJobAction.ID, RunJobAction.LABEL, null, null, mockJobManagementService);
		mockRunJobAction.setup(s => s.run(TypeMoq.It.isAny())).returns(async () => {
			let result = await mockJobManagementService.object.jobAction(null, null, null).then((result) => result.success);
			return result;
		});

		mockRunJobAction.setup(s => s.id).returns(() => RunJobAction.ID);
		mockRunJobAction.setup(s => s.label).returns(() => RunJobAction.LABEL);
		should(mockRunJobAction.object.id).equal(RunJobAction.ID);
		should(mockRunJobAction.object.label).equal(RunJobAction.LABEL);

		// Run Job Action should make the Job Management service call job action
		mockRunJobAction.object.run(null);
		mockJobManagementService.verify(s => s.jobAction(null, null, null), TypeMoq.Times.once());
		done();
	});

	test('Stop Job Action', (done) => {
		mockStopJobAction = TypeMoq.Mock.ofType(StopJobAction, TypeMoq.MockBehavior.Strict, StopJobAction.ID, StopJobAction.LABEL, null, null, mockJobManagementService);
		mockStopJobAction.setup(s => s.run(TypeMoq.It.isAny())).returns(async () => {
			let result = await mockJobManagementService.object.jobAction(null, null, null).then((result) => result.success);
			return result;
		});

		mockStopJobAction.setup(s => s.id).returns(() => RunJobAction.ID);
		mockStopJobAction.setup(s => s.label).returns(() => RunJobAction.LABEL);
		should(mockStopJobAction.object.id).equal(RunJobAction.ID);
		should(mockStopJobAction.object.label).equal(RunJobAction.LABEL);

		// Run Job Action should make the Job Management service call job action
		mockStopJobAction.object.run(null);
		mockJobManagementService.verify(s => s.jobAction(null, null, null), TypeMoq.Times.once());
		done();
	});

	test('Delete Job Action', (done) => {
		mockDeleteJobAction = TypeMoq.Mock.ofType(DeleteJobAction, TypeMoq.MockBehavior.Strict, DeleteJobAction.ID, DeleteJobAction.LABEL, null, null, mockJobManagementService);
		mockDeleteJobAction.setup(s => s.run(TypeMoq.It.isAny())).returns(async () => {
			let result = await mockJobManagementService.object.jobAction(null, null, null).then((result) => result.success);
			return result;
		});

		mockDeleteJobAction.setup(s => s.id).returns(() => DeleteJobAction.ID);
		mockDeleteJobAction.setup(s => s.label).returns(() => DeleteJobAction.LABEL);
		should(mockDeleteJobAction.object.id).equal(DeleteJobAction.ID);
		should(mockDeleteJobAction.object.label).equal(DeleteJobAction.LABEL);

		// Run Job Action should make the Job Management service call job action
		mockDeleteJobAction.object.run(null);
		mockJobManagementService.verify(s => s.jobAction(null, null, null), TypeMoq.Times.once());
		done();
	});

	// Step Actions
	test('New Step Action', (done) => {
		mockNewStepAction = TypeMoq.Mock.ofType(NewStepAction, TypeMoq.MockBehavior.Strict, NewJobAction.ID, NewJobAction.LABEL);
		let commandServiceCalled = false;
		mockNewStepAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => {
			commandServiceCalled = true;
			return Promise.resolve(commandServiceCalled);
		});
		mockNewStepAction.setup(s => s.id).returns(() => NewJobAction.ID);
		mockNewStepAction.setup(s => s.label).returns(() => NewJobAction.LABEL);
		should(mockNewStepAction.object.id).equal(NewJobAction.ID);
		should(mockNewStepAction.object.label).equal(NewJobAction.LABEL);

		// New Step Action should called command service
		mockNewStepAction.object.run(null);
		should(commandServiceCalled).equal(true);
		done();
	});

	test('Delete Step Action', (done) => {
		mockDeleteStepAction = TypeMoq.Mock.ofType(DeleteStepAction, TypeMoq.MockBehavior.Strict, DeleteStepAction.ID, DeleteStepAction.LABEL);
		let commandServiceCalled = false;
		mockDeleteStepAction.setup(s => s.run(TypeMoq.It.isAny())).returns(async () => {
			commandServiceCalled = true;
			await mockJobManagementService.object.deleteJobStep(null, null).then((result) => result.success);
			return Promise.resolve(commandServiceCalled);
		});
		mockDeleteStepAction.setup(s => s.id).returns(() => DeleteStepAction.ID);
		mockDeleteStepAction.setup(s => s.label).returns(() => DeleteStepAction.LABEL);
		should(mockDeleteStepAction.object.id).equal(DeleteStepAction.ID);
		should(mockDeleteStepAction.object.label).equal(DeleteStepAction.LABEL);

		// Delete Step Action should called command service
		mockDeleteStepAction.object.run(null);
		should(commandServiceCalled).equal(true);
		mockJobManagementService.verify(s => s.deleteJobStep(null, null), TypeMoq.Times.once());
		done();
	});

	// Alert Actions
	test('New Alert Action', (done) => {
		mockNewAlertAction = TypeMoq.Mock.ofType(NewJobAction, TypeMoq.MockBehavior.Strict, NewJobAction.ID, NewJobAction.LABEL);
		mockNewAlertAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => mockAlertsViewComponent.object.openCreateAlertDialog());
		mockNewAlertAction.setup(s => s.id).returns(() => NewJobAction.ID);
		mockNewAlertAction.setup(s => s.label).returns(() => NewJobAction.LABEL);
		should(mockNewAlertAction.object.id).equal(NewJobAction.ID);
		should(mockNewAlertAction.object.label).equal(NewJobAction.LABEL);

		// New Alert Action from Alerts View should open a dialog
		mockNewAlertAction.object.run(null);
		mockAlertsViewComponent.verify(c => c.openCreateAlertDialog(), TypeMoq.Times.once());
		done();
	});

	test('Edit Alert Action', (done) => {
		mockEditAlertAction = TypeMoq.Mock.ofType(EditAlertAction, TypeMoq.MockBehavior.Strict, EditAlertAction.ID, EditAlertAction.LABEL);
		let commandServiceCalled: boolean = false;
		mockEditAlertAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => {
			commandServiceCalled = true;
			return Promise.resolve(commandServiceCalled);
		});
		mockEditAlertAction.setup(s => s.id).returns(() => EditAlertAction.ID);
		mockEditAlertAction.setup(s => s.label).returns(() => EditAlertAction.LABEL);
		should(mockEditAlertAction.object.id).equal(EditAlertAction.ID);
		should(mockEditAlertAction.object.label).equal(EditAlertAction.LABEL);

		// Edit Alert Action from Jobs View should open a dialog
		mockEditAlertAction.object.run(null);
		should(commandServiceCalled).equal(true);
		done();
	});

	test('Delete Alert Action', (done) => {
		mockDeleteAlertAction = TypeMoq.Mock.ofType(DeleteAlertAction, TypeMoq.MockBehavior.Strict, DeleteAlertAction.ID, DeleteAlertAction.LABEL, null, null, mockJobManagementService);
		let commandServiceCalled = false;
		mockDeleteAlertAction.setup(s => s.run(TypeMoq.It.isAny())).returns(async () => {
			commandServiceCalled = true;
			await mockJobManagementService.object.deleteAlert(null, null).then((result) => result.success);
			return commandServiceCalled;
		});
		mockDeleteAlertAction.setup(s => s.id).returns(() => DeleteAlertAction.ID);
		mockDeleteAlertAction.setup(s => s.label).returns(() => DeleteAlertAction.LABEL);
		should(mockDeleteAlertAction.object.id).equal(DeleteAlertAction.ID);
		should(mockDeleteAlertAction.object.label).equal(DeleteAlertAction.LABEL);

		// Delete Alert Action should call job management service
		mockDeleteAlertAction.object.run(null);
		should(commandServiceCalled).equal(true);
		mockJobManagementService.verify(s => s.deleteAlert(null, null), TypeMoq.Times.once());
		done();
	});

	// Operator Tests
	test('New Operator Action', (done) => {
		mockNewOperatorAction = TypeMoq.Mock.ofType(NewOperatorAction, TypeMoq.MockBehavior.Strict, NewOperatorAction.ID, NewOperatorAction.LABEL);
		mockNewOperatorAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => mockOperatorsViewComponent.object.openCreateOperatorDialog());
		mockNewOperatorAction.setup(s => s.id).returns(() => NewOperatorAction.ID);
		mockNewOperatorAction.setup(s => s.label).returns(() => NewOperatorAction.LABEL);
		should(mockNewOperatorAction.object.id).equal(NewOperatorAction.ID);
		should(mockNewOperatorAction.object.label).equal(NewOperatorAction.LABEL);

		// New Operator Action from Operators View should open a dialog
		mockNewOperatorAction.object.run(null);
		mockOperatorsViewComponent.verify(c => c.openCreateOperatorDialog(), TypeMoq.Times.once());
		done();
	});

	test('Edit Operator Action', (done) => {
		mockEditOperatorAction = TypeMoq.Mock.ofType(EditOperatorAction, TypeMoq.MockBehavior.Strict, EditOperatorAction.ID, EditOperatorAction.LABEL);
		let commandServiceCalled: boolean = false;
		mockEditOperatorAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => {
			commandServiceCalled = true;
			return Promise.resolve(commandServiceCalled);
		});
		mockEditOperatorAction.setup(s => s.id).returns(() => EditOperatorAction.ID);
		mockEditOperatorAction.setup(s => s.label).returns(() => EditOperatorAction.LABEL);
		should(mockEditOperatorAction.object.id).equal(EditOperatorAction.ID);
		should(mockEditOperatorAction.object.label).equal(EditOperatorAction.LABEL);

		// Edit Operator Action from Jobs View should open a dialog
		mockEditOperatorAction.object.run(null);
		should(commandServiceCalled).equal(true);
		done();
	});

	test('Delete Operator Action', (done) => {
		mockDeleteOperatorAction = TypeMoq.Mock.ofType(DeleteOperatorAction, TypeMoq.MockBehavior.Strict, DeleteOperatorAction.ID, DeleteOperatorAction.LABEL, null, null, mockJobManagementService);
		let commandServiceCalled = false;
		mockDeleteOperatorAction.setup(s => s.run(TypeMoq.It.isAny())).returns(async () => {
			commandServiceCalled = true;
			await mockJobManagementService.object.deleteOperator(null, null).then((result) => result.success);
			return commandServiceCalled;
		});
		mockDeleteOperatorAction.setup(s => s.id).returns(() => DeleteOperatorAction.ID);
		mockDeleteOperatorAction.setup(s => s.label).returns(() => DeleteOperatorAction.LABEL);
		should(mockDeleteOperatorAction.object.id).equal(DeleteOperatorAction.ID);
		should(mockDeleteOperatorAction.object.label).equal(DeleteOperatorAction.LABEL);

		// Delete Operator Action should call job management service
		mockDeleteOperatorAction.object.run(null);
		should(commandServiceCalled).equal(true);
		mockJobManagementService.verify(s => s.deleteOperator(null, null), TypeMoq.Times.once());
		done();
	});

	// Proxy Actions
	test('New Proxy Action', (done) => {
		mockNewProxyAction = TypeMoq.Mock.ofType(NewProxyAction, TypeMoq.MockBehavior.Strict, NewProxyAction.ID, NewProxyAction.LABEL);
		mockNewProxyAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => mockProxiesViewComponent.object.openCreateProxyDialog());
		mockNewProxyAction.setup(s => s.id).returns(() => NewProxyAction.ID);
		mockNewProxyAction.setup(s => s.label).returns(() => NewProxyAction.LABEL);
		should(mockNewProxyAction.object.id).equal(NewProxyAction.ID);
		should(mockNewProxyAction.object.label).equal(NewProxyAction.LABEL);

		// New Proxy Action from Alerts View should open a dialog
		mockNewProxyAction.object.run(null);
		mockProxiesViewComponent.verify(c => c.openCreateProxyDialog(), TypeMoq.Times.once());
		done();
	});

	test('Edit Proxy Action', (done) => {
		mockEditProxyAction = TypeMoq.Mock.ofType(EditProxyAction, TypeMoq.MockBehavior.Strict, EditProxyAction.ID, EditProxyAction.LABEL);
		let commandServiceCalled: boolean = false;
		mockEditProxyAction.setup(s => s.run(TypeMoq.It.isAny())).returns(() => {
			commandServiceCalled = true;
			return Promise.resolve(commandServiceCalled);
		});
		mockEditProxyAction.setup(s => s.id).returns(() => EditProxyAction.ID);
		mockEditProxyAction.setup(s => s.label).returns(() => EditProxyAction.LABEL);
		should(mockEditProxyAction.object.id).equal(EditProxyAction.ID);
		should(mockEditProxyAction.object.label).equal(EditProxyAction.LABEL);

		// Edit Proxy Action from Proxies View should open a dialog
		mockEditProxyAction.object.run(null);
		should(commandServiceCalled).equal(true);
		done();
	});

	test('Delete Proxy Action', (done) => {
		mockDeleteProxyAction = TypeMoq.Mock.ofType(DeleteProxyAction, TypeMoq.MockBehavior.Strict, DeleteProxyAction.ID, DeleteProxyAction.LABEL, null, null, mockJobManagementService);
		let commandServiceCalled = false;
		mockDeleteProxyAction.setup(s => s.run(TypeMoq.It.isAny())).returns(async () => {
			commandServiceCalled = true;
			await mockJobManagementService.object.deleteProxy(null, null).then((result) => result.success);
			return commandServiceCalled;
		});
		mockDeleteProxyAction.setup(s => s.id).returns(() => DeleteProxyAction.ID);
		mockDeleteProxyAction.setup(s => s.label).returns(() => DeleteProxyAction.LABEL);
		should(mockDeleteProxyAction.object.id).equal(DeleteProxyAction.ID);
		should(mockDeleteProxyAction.object.label).equal(DeleteProxyAction.LABEL);

		// Delete Proxy Action should call job management service
		mockDeleteProxyAction.object.run(null);
		should(commandServiceCalled).equal(true);
		mockJobManagementService.verify(s => s.deleteProxy(null, null), TypeMoq.Times.once());
		done();
	});

});
