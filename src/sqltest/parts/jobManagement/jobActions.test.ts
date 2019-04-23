/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as azdata from 'azdata';
import * as TypeMoq from 'typemoq';
import { JobsRefreshAction, NewJobAction, EditJobAction, RunJobAction, StopJobAction } from 'sql/platform/jobManagement/common/jobActions';
import { TestJobManagementView } from 'sqltest/stubs/jobsManagementViewStub';
import { JobManagementService } from 'sql/platform/jobManagement/common/jobManagementService';


let mockJobsViewComponent: TypeMoq.Mock<TestJobManagementView>;
let mockJobManagementService: TypeMoq.Mock<JobManagementService>;

// Mock Actions
let mockRefreshAction: TypeMoq.Mock<JobsRefreshAction>;
let mockNewJobAction: TypeMoq.Mock<NewJobAction>;
let mockEditJobAction: TypeMoq.Mock<EditJobAction>;
let mockRunJobAction: TypeMoq.Mock<RunJobAction>;
let mockStopJobAction: TypeMoq.Mock<StopJobAction>;

// Tests
suite('Job Actions', () => {
	setup(() => {
		mockJobsViewComponent = TypeMoq.Mock.ofType<TestJobManagementView>(TestJobManagementView);
		mockJobManagementService = TypeMoq.Mock.ofType<JobManagementService>(JobManagementService);
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
		let resultStatus: azdata.ResultStatus = {
			success: true,
			errorMessage: null
		};
		mockJobManagementService.setup(s => s.jobAction(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(resultStatus));
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

});
