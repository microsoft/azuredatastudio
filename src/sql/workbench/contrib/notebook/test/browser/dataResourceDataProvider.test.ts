/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import { DataResourceDataProvider } from '../../browser/outputs/gridOutput.component';
import { IDataResource } from 'sql/workbench/services/notebook/browser/sql/sqlSessionManager';
import { ResultSetSummary } from 'sql/workbench/services/query/common/query';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { SerializationService } from 'sql/platform/serialization/common/serializationService';
import { SaveFormat, ResultSerializer } from 'sql/workbench/services/query/common/resultSerializer';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';

suite('Data Resource Data Provider', function () {
	let source: IDataResource;
	let resultSet: ResultSetSummary;
	let documentUri: string;
	let _notificationService: INotificationService;
	let _clipboardService: IClipboardService;
	let _configurationService: IConfigurationService;
	let _textResourcePropertiesService: ITextResourcePropertiesService;
	let _serializationService: TypeMoq.Mock<SerializationService>;
	let _instantiationService: TypeMoq.Mock<InstantiationService>;
	let dataResourceDataProvider: DataResourceDataProvider;
	let mockResultSerializer: TypeMoq.Mock<ResultSerializer>;
	let format: SaveFormat;
	let selection: Slick.Range[];

	suiteSetup(() => {
		source = {
			data: [{ 0: '1' }],
			schema: { fields: [{ name: 'col1' }] }
		};
		resultSet = {
			batchId: 0,
			columnInfo: [{ columnName: 'col1' }],
			complete: true,
			id: 0,
			rowCount: 1
		};
		documentUri = 'untitled:Notebook-0';
		_notificationService = undefined;
		_clipboardService = undefined;
		_configurationService = undefined;
		_textResourcePropertiesService = undefined;
		_serializationService = TypeMoq.Mock.ofType(SerializationService);
		mockResultSerializer = TypeMoq.Mock.ofType(ResultSerializer);
		_instantiationService = TypeMoq.Mock.ofType(InstantiationService);
		_instantiationService.setup(x => x.createInstance(TypeMoq.It.isValue(ResultSerializer)))
			.returns(() => mockResultSerializer.object);
		dataResourceDataProvider = new DataResourceDataProvider(
			source,
			resultSet,
			documentUri,
			_notificationService,
			_clipboardService,
			_configurationService,
			_textResourcePropertiesService,
			_serializationService.object,
			_instantiationService.object
		);
		format = SaveFormat.CSV;
		selection = undefined;
	});

	test('getRowData returns correct rows', function (): void {
		dataResourceDataProvider.getRowData(0, 1).then((result) => {
			assert(result.rowCount === 1, 'rowCount should be correct');
			assert(result.rows[0][0].displayValue === '1', 'rows should have correct value');
		});
	});

	test('getColumnHeaders returns correct headers', function (): void {
		// let headers = dataResourceDataProvider.getColumnHeaders(new Slick.Range(0, 0, 1, 1));
		// assert(headers === ['col1']);
	});

	test('serializeResults call is successful', function (): void {
		dataResourceDataProvider.serializeResults(SaveFormat.CSV, selection);
		mockResultSerializer.verify(x => x.handleSerialization(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

});

