/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { AssessmentType, AssessmentTargetType } from 'sql/workbench/contrib/assessment/common/consts';
import {
	IAssessmentComponent,
	AsmtServerInvokeItemsAction,
	AsmtServerSelectItemsAction,
	AsmtExportAsScriptAction,
	AsmtSamplesLinkAction,
	AsmtDatabaseInvokeItemsAction,
	AsmtDatabaseSelectItemsAction
} from 'sql/workbench/contrib/assessment/common/asmtActions';
import { AssessmentService } from 'sql/workbench/services/assessment/common/assessmentService';
import { NullAdsTelemetryService } from 'sql/platform/telemetry/common/adsTelemetryService';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { TestConnectionManagementService } from 'sql/platform/connection/test/common/testConnectionManagementService';
import { NullLogService } from 'vs/platform/log/common/log';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { OpenerServiceStub } from 'sql/platform/opener/common/openerServiceStub';
/**
 * Class to test Assessment Management Actions
 */

let assessmentResultItems: azdata.SqlAssessmentResultItem[] = [
	<azdata.SqlAssessmentResultItem>{ checkId: 'check1' },
	<azdata.SqlAssessmentResultItem>{ checkId: 'check2' },
	<azdata.SqlAssessmentResultItem>{ checkId: 'check3' }
];

class AssessmentTestViewComponent implements IAssessmentComponent {
	showProgress(mode: AssessmentType) { return undefined; }
	showInitialResults(result: azdata.SqlAssessmentResult, method: AssessmentType) { return undefined; }
	appendResults(result: azdata.SqlAssessmentResult, method: AssessmentType) { }
	stopProgress(mode: AssessmentType) { return undefined; }
	resultItems: azdata.SqlAssessmentResultItem[] = assessmentResultItems;
	isActive: boolean = true;
}

let mockAssessmentService: TypeMoq.Mock<AssessmentService>;
let mockAsmtViewComponent: TypeMoq.Mock<IAssessmentComponent>;

let assessmentResult: azdata.SqlAssessmentResult = {
	success: true,
	errorMessage: '',
	apiVersion: '',
	items: assessmentResultItems
};

// Tests
suite('Assessment Actions', () => {

	// Actions
	setup(() => {
		mockAsmtViewComponent = TypeMoq.Mock.ofType<IAssessmentComponent>(AssessmentTestViewComponent);

		mockAssessmentService = TypeMoq.Mock.ofType<AssessmentService>(AssessmentService);
		mockAssessmentService.setup(s => s.assessmentInvoke(TypeMoq.It.isAny(), AssessmentTargetType.Server)).returns(() => Promise.resolve(assessmentResult));
		mockAssessmentService.setup(s => s.assessmentInvoke(TypeMoq.It.isAny(), AssessmentTargetType.Database)).returns(() => Promise.resolve(assessmentResult));
		mockAssessmentService.setup(s => s.getAssessmentItems(TypeMoq.It.isAny(), AssessmentTargetType.Server)).returns(() => Promise.resolve(assessmentResult));
		mockAssessmentService.setup(s => s.getAssessmentItems(TypeMoq.It.isAny(), AssessmentTargetType.Database)).returns(() => Promise.resolve(assessmentResult));

		let resultStatus: azdata.ResultStatus = {
			success: true,
			errorMessage: null
		};
		mockAssessmentService.setup(s => s.generateAssessmentScript(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns(() => Promise.resolve(resultStatus));
	});

	function createConnectionManagementService(dbListResult: azdata.ListDatabasesResult): TypeMoq.Mock<IConnectionManagementService> {
		let connectionProfile = TypeMoq.Mock.ofType<ConnectionProfile>(ConnectionProfile);
		connectionProfile.setup(cp => cp.cloneWithDatabase(TypeMoq.It.isAnyString())).returns(() => connectionProfile.object);
		connectionProfile.setup(cp => cp.clone()).returns(() => connectionProfile.object);
		let connectionManagementService = TypeMoq.Mock.ofType<IConnectionManagementService>(TestConnectionManagementService);
		connectionManagementService.setup(c => c.listDatabases(TypeMoq.It.isAny())).returns(() => Promise.resolve(dbListResult));
		connectionManagementService.setup(c => c.getConnectionUriFromId(TypeMoq.It.isAny())).returns(() => '');
		connectionManagementService.setup(c => c.getConnection(TypeMoq.It.isAny())).returns(() => connectionProfile.object);
		connectionManagementService.setup(c => c.connectIfNotConnected(TypeMoq.It.isAny())).returns(() => Promise.resolve(''));

		return connectionManagementService;
	}

	test('Get Server Assessment Items Action', async () => {
		const dbListResult: azdata.ListDatabasesResult = {
			databaseNames: ['db1', 'db2']
		};

		const connectionManagementService = createConnectionManagementService(dbListResult);

		const action = new AsmtServerSelectItemsAction(connectionManagementService.object, new NullLogService(), mockAssessmentService.object, new NullAdsTelemetryService());
		assert.equal(action.id, AsmtServerSelectItemsAction.ID, 'Get Server Rules id action mismatch');
		assert.equal(action.label, AsmtServerSelectItemsAction.LABEL, 'Get Server Rules label action mismatch');

		let result = await action.run({ ownerUri: '', component: mockAsmtViewComponent.object, connectionId: '' });
		assert.ok(result, 'Get Server Rules action should succeed');
		mockAsmtViewComponent.verify(s => s.showProgress(AssessmentType.AvailableRules), TypeMoq.Times.once());
		mockAssessmentService.verify(s => s.getAssessmentItems(TypeMoq.It.isAny(), AssessmentTargetType.Server), TypeMoq.Times.once());
		mockAsmtViewComponent.verify(s => s.showInitialResults(TypeMoq.It.isAny(), AssessmentType.AvailableRules), TypeMoq.Times.once());
		// should be executed for every db in database list
		mockAssessmentService.verify(s => s.getAssessmentItems(TypeMoq.It.isAny(), AssessmentTargetType.Database), TypeMoq.Times.exactly(dbListResult.databaseNames.length));
		mockAsmtViewComponent.verify(s => s.appendResults(TypeMoq.It.isAny(), AssessmentType.AvailableRules), TypeMoq.Times.exactly(dbListResult.databaseNames.length));

		mockAsmtViewComponent.verify(s => s.stopProgress(AssessmentType.AvailableRules), TypeMoq.Times.once());
	});


	test('Invoke Server Assessment Action', async () => {
		const dbListResult: azdata.ListDatabasesResult = {
			databaseNames: ['db1', 'db2']
		};

		const connectionManagementService = createConnectionManagementService(dbListResult);

		const action = new AsmtServerInvokeItemsAction(connectionManagementService.object, new NullLogService(), mockAssessmentService.object, new NullAdsTelemetryService());
		assert.equal(action.id, AsmtServerInvokeItemsAction.ID, 'Invoke Server Assessment id action mismatch');
		assert.equal(action.label, AsmtServerInvokeItemsAction.LABEL, 'Invoke Server Assessment label action mismatch');

		let result = await action.run({ ownerUri: '', component: mockAsmtViewComponent.object, connectionId: '' });
		assert.ok(result, 'Invoke Server Assessment action should succeed');
		mockAsmtViewComponent.verify(s => s.showProgress(AssessmentType.InvokeAssessment), TypeMoq.Times.once());
		mockAssessmentService.verify(s => s.assessmentInvoke(TypeMoq.It.isAny(), AssessmentTargetType.Server), TypeMoq.Times.once());
		mockAsmtViewComponent.verify(s => s.showInitialResults(TypeMoq.It.isAny(), AssessmentType.InvokeAssessment), TypeMoq.Times.once());
		// should be executed for every db in database list
		mockAssessmentService.verify(s => s.assessmentInvoke(TypeMoq.It.isAny(), AssessmentTargetType.Database), TypeMoq.Times.exactly(dbListResult.databaseNames.length));
		mockAsmtViewComponent.verify(s => s.appendResults(TypeMoq.It.isAny(), AssessmentType.InvokeAssessment), TypeMoq.Times.exactly(dbListResult.databaseNames.length));

		mockAsmtViewComponent.verify(s => s.stopProgress(AssessmentType.InvokeAssessment), TypeMoq.Times.once());
	});

	test('Get Assessment Items Database Action', async () => {
		const action = new AsmtDatabaseSelectItemsAction('databaseName', mockAssessmentService.object, new NullAdsTelemetryService());
		assert.equal(action.id, AsmtDatabaseSelectItemsAction.ID, 'Get Database Rules id action mismatch');

		let result = await action.run({ ownerUri: '', component: mockAsmtViewComponent.object, connectionId: '' });
		assert.ok(result, 'Get Assessment Database action should succeed');
		mockAsmtViewComponent.verify(s => s.showProgress(AssessmentType.AvailableRules), TypeMoq.Times.once());
		mockAsmtViewComponent.verify(s => s.showInitialResults(TypeMoq.It.isAny(), AssessmentType.AvailableRules), TypeMoq.Times.once());
		mockAsmtViewComponent.verify(s => s.stopProgress(AssessmentType.AvailableRules), TypeMoq.Times.once());
		mockAssessmentService.verify(s => s.getAssessmentItems(TypeMoq.It.isAny(), AssessmentTargetType.Database), TypeMoq.Times.once());

	});

	test('Invoke Database Assessment Action', async () => {
		const action = new AsmtDatabaseInvokeItemsAction('databaseName', mockAssessmentService.object, new NullAdsTelemetryService());
		assert.equal(action.id, AsmtDatabaseInvokeItemsAction.ID, 'Invoke Database Assessment id action mismatch');

		let result = await action.run({ ownerUri: '', component: mockAsmtViewComponent.object, connectionId: '' });
		assert.ok(result, 'Invoke Database Assessment action should succeed');
		mockAsmtViewComponent.verify(s => s.showProgress(AssessmentType.InvokeAssessment), TypeMoq.Times.once());
		mockAsmtViewComponent.verify(s => s.showInitialResults(TypeMoq.It.isAny(), AssessmentType.InvokeAssessment), TypeMoq.Times.once());
		mockAsmtViewComponent.verify(s => s.stopProgress(AssessmentType.InvokeAssessment), TypeMoq.Times.once());
		mockAssessmentService.verify(s => s.assessmentInvoke(TypeMoq.It.isAny(), AssessmentTargetType.Database), TypeMoq.Times.once());

	});

	test('Generate Script Action', async () => {
		const action = new AsmtExportAsScriptAction(mockAssessmentService.object, new NullAdsTelemetryService());
		assert.equal(action.id, AsmtExportAsScriptAction.ID, 'Generate Assessment script id action mismatch');
		assert.equal(action.label, AsmtExportAsScriptAction.LABEL, 'Generate Assessment script label action mismatch');

		let result = await action.run({ ownerUri: '', component: mockAsmtViewComponent.object, connectionId: '' });
		assert.ok(result, 'Generate Script action should succeed');
		mockAssessmentService.verify(s => s.generateAssessmentScript(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	test('Samples Link Action', async () => {
		let openerService = TypeMoq.Mock.ofType<IOpenerService>(OpenerServiceStub);
		openerService.setup(s => s.open(TypeMoq.It.isAny())).returns(() => Promise.resolve(true));

		const action = new AsmtSamplesLinkAction(openerService.object, new NullAdsTelemetryService());
		assert.equal(action.id, AsmtSamplesLinkAction.ID, 'Samples Link id action mismatch');
		assert.equal(action.label, AsmtSamplesLinkAction.LABEL, 'Samples Link label action mismatch');

		let result = await action.run();
		assert.ok(result, 'Samples Link action should succeed');
		openerService.verify(s => s.open(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

});
