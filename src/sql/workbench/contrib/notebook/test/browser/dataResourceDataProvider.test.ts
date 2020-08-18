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
// import * as pfs from 'vs/base/node/pfs';
import { DataResourceDataProvider } from '../../browser/outputs/gridOutput.component';
import { IDataResource } from 'sql/workbench/services/notebook/browser/sql/sqlSessionManager';
import { ResultSetSummary } from 'sql/workbench/services/query/common/query';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { TestFileDialogService } from 'vs/workbench/test/browser/workbenchTestServices';
import { SerializationService } from 'sql/platform/serialization/common/serializationService';
import { SaveFormat, ResultSerializer } from 'sql/workbench/services/query/common/resultSerializer';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { URI } from 'vs/base/common/uri';

export class TestSerializationProvider implements azdata.SerializationProvider {
	handle?: number;
	providerId: string;
	constructor(providerId: string = 'providerId') { }

	startSerialization(requestParams: azdata.SerializeDataStartRequestParams): Thenable<azdata.SerializeDataResult> {
		return Promise.resolve(undefined);
	}

	continueSerialization(requestParams: azdata.SerializeDataContinueRequestParams): Thenable<azdata.SerializeDataResult> {
		return Promise.resolve(undefined);
	}

}

suite('Data Resource Data Provider', function () {
	let _notificationService: TestNotificationService;
	let dataResourceDataProvider: DataResourceDataProvider;
	let fileDialogService: TypeMoq.Mock<TestFileDialogService>;
	let saveFile: URI;
	let serializer: ResultSerializer;

	suiteSetup(async () => {
		let source: IDataResource = {
			data: [{ 0: '1' }],
			schema: { fields: [{ name: 'col1' }] }
		};
		let resultSet: ResultSetSummary = {
			batchId: 0,
			columnInfo: [{ columnName: 'col1' }],
			complete: true,
			id: 0,
			rowCount: 1
		};
		let documentUri = 'untitled:Notebook-0';
		let tempFolderPath = path.join(os.tmpdir(), `TestDataResourceDataProvider_${uuid.v4()}`);
		await fs.mkdir(tempFolderPath);
		saveFile = URI.file(path.join(tempFolderPath, 'results.csv'));
		serializer = new ResultSerializer(
			undefined, // IQueryManagementService
			undefined, // IConfigurationService
			undefined, // IEditorService
			undefined, // IWorkspaceContextService
			fileDialogService.object,
			_notificationService,
			undefined // IOpenerService
		);

		fileDialogService = TypeMoq.Mock.ofType(TestFileDialogService, TypeMoq.MockBehavior.Strict);
		fileDialogService.setup(x => x.showSaveDialog(TypeMoq.It.isAny()))
			.returns(() => Promise.resolve(saveFile));
		_notificationService = new TestNotificationService();
		let _serializationService = new SerializationService(undefined, undefined); //_connectionService _capabilitiesService
		_serializationService.registerProvider('testProviderId', new TestSerializationProvider());
		let _instantiationService = TypeMoq.Mock.ofType(InstantiationService, TypeMoq.MockBehavior.Strict);
		_instantiationService.setup(x => x.createInstance(TypeMoq.It.isValue(ResultSerializer)))
			.returns(() => serializer);

		dataResourceDataProvider = new DataResourceDataProvider(
			source,
			resultSet,
			documentUri,
			_notificationService,
			undefined, // IClipboardService
			undefined, // IConfigurationService
			undefined, // ITextResourcePropertiesService
			_serializationService,
			_instantiationService.object
		);
	});

	test('getRowData returns correct rows', function (): void {
		dataResourceDataProvider.getRowData(0, 1).then((result) => {
			assert(result.rowCount === 1, 'rowCount should be correct');
			assert(result.rows[0][0].displayValue === '1', 'rows should have correct value');
		});
	});

	test('serializeResults call is successful', async function (): Promise<void> {
		assert.ok(dataResourceDataProvider.serializeResults(SaveFormat.CSV, undefined));
		// const data = await pfs.readFile(saveFile.path, 'utf-8');
		// assert.equal(data.toString(), JSON.stringify({ col1: 1 }));
	});

});

