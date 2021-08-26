/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import * as azdata from 'azdata';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as uuid from 'uuid';
import * as sinon from 'sinon';
import { DataResourceDataProvider } from '../../browser/outputs/gridOutput.component';
import { IDataResource } from 'sql/workbench/services/notebook/browser/sql/sqlSessionManager';
import { ResultSetSummary } from 'sql/workbench/services/query/common/query';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { TestFileDialogService, TestEditorService, TestPathService } from 'vs/workbench/test/browser/workbenchTestServices';
import { TestContextService } from 'vs/workbench/test/common/workbenchTestServices';
import { SerializationService } from 'sql/platform/serialization/common/serializationService';
import { SaveFormat, ResultSerializer } from 'sql/workbench/services/query/common/resultSerializer';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { URI } from 'vs/base/common/uri';
import { CellModel } from 'sql/workbench/services/notebook/browser/models/cell';
import { createandLoadNotebookModel } from 'sql/workbench/contrib/notebook/test/browser/cellToolbarActions.test';

export class TestSerializationProvider implements azdata.SerializationProvider {
	providerId: string;
	constructor(providerId: string = 'providerId') { }

	// Write data to file
	async startSerialization(requestParams: azdata.SerializeDataStartRequestParams): Promise<azdata.SerializeDataResult> {
		let data: string = '';
		requestParams.rows.forEach((row) => {
			row.forEach((element) => {
				data += element.displayValue + ' ';
			});
			data += '\n';
		});
		await fs.promises.writeFile(requestParams.filePath, data);
		return Promise.resolve({ succeeded: true, messages: undefined });
	}

	continueSerialization(requestParams: azdata.SerializeDataContinueRequestParams): Thenable<azdata.SerializeDataResult> {
		return Promise.resolve(undefined);
	}
}

suite('Data Resource Data Provider', function () {
	let fileDialogService: TestFileDialogService;
	let serializer: ResultSerializer;
	let notificationService: TestNotificationService;
	let serializationService: SerializationService;
	let instantiationService: TypeMoq.Mock<InstantiationService>;
	let cellModel = TypeMoq.Mock.ofType(CellModel);

	// Create test data with two rows and two columns
	let source: IDataResource = {
		data: [{ 0: '1', 1: '2' }, { 0: '3', 1: '4' }],
		schema: { fields: [{ name: 'col1' }, { name: 'col2' }] }
	};
	let resultSet: ResultSetSummary = {
		batchId: 0,
		columnInfo: [{ columnName: 'col1' }, { columnName: 'col2' }],
		complete: true,
		id: 0,
		rowCount: 2
	};

	suiteSetup(async () => {
		let notebookModel = await createandLoadNotebookModel();
		cellModel.setup(x => x.notebookModel).returns(() => notebookModel);

		// Mock services
		let editorService = TypeMoq.Mock.ofType(TestEditorService, TypeMoq.MockBehavior.Strict);
		editorService.setup(x => x.openEditor(TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
		let contextService = new TestContextService();
		let pathService = new TestPathService();
		fileDialogService = new TestFileDialogService(pathService);
		notificationService = new TestNotificationService();
		serializationService = new SerializationService(undefined, undefined); //_connectionService _capabilitiesService
		serializationService.registerProvider('testProviderId', new TestSerializationProvider());
		serializer = new ResultSerializer(
			undefined, // IQueryManagementService
			undefined, // IConfigurationService
			editorService.object,
			contextService,
			fileDialogService,
			notificationService,
			undefined // IOpenerService
		);
		instantiationService = TypeMoq.Mock.ofType(InstantiationService, TypeMoq.MockBehavior.Strict);
		instantiationService.setup(x => x.createInstance(TypeMoq.It.isValue(ResultSerializer)))
			.returns(() => serializer);
	});

	test('serializeResults call is successful', async function (): Promise<void> {
		let tempFolderPath = path.join(os.tmpdir(), `TestDataResourceDataProvider_${uuid.v4()}`);
		await fs.mkdir(tempFolderPath);
		let dataResourceDataProvider = new DataResourceDataProvider(
			source,
			resultSet,
			cellModel.object,
			notificationService,
			undefined, // IClipboardService
			undefined, // IConfigurationService
			undefined, // ITextResourcePropertiesService
			serializationService,
			instantiationService.object
		);
		let noHeadersFile = URI.file(path.join(tempFolderPath, 'result_noHeaders.csv'));
		let fileDialogServiceStub = sinon.stub(fileDialogService, 'showSaveDialog').returns(Promise.resolve(noHeadersFile));
		let serializerStub = sinon.stub(serializer, 'getBasicSaveParameters').returns(<azdata.SaveResultsRequestParams>{ resultFormat: SaveFormat.CSV as string, includeHeaders: false });
		await dataResourceDataProvider.serializeResults(SaveFormat.CSV, undefined);
		fileDialogServiceStub.restore();
		serializerStub.restore();

		let withHeadersFile = URI.file(path.join(tempFolderPath, 'result_withHeaders.csv'));
		fileDialogServiceStub = sinon.stub(fileDialogService, 'showSaveDialog').returns(Promise.resolve(withHeadersFile));
		serializerStub = sinon.stub(serializer, 'getBasicSaveParameters').returns(<azdata.SaveResultsRequestParams>{ resultFormat: SaveFormat.CSV as string, includeHeaders: true });
		await dataResourceDataProvider.serializeResults(SaveFormat.CSV, undefined);
		fileDialogServiceStub.restore();
		serializerStub.restore();

		const noHeadersResult = await fs.readFile(noHeadersFile.fsPath);
		assert.equal(noHeadersResult.toString(), '1 2 \n3 4 \n', 'result data should not include headers');

		const withHeadersResult = await fs.readFile(withHeadersFile.fsPath);
		assert.equal(withHeadersResult.toString(), 'col1 col2 \n1 2 \n3 4 \n', 'result data should include headers');
	});
});
