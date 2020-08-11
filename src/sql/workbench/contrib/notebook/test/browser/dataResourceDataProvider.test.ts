/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import { DataResourceDataProvider } from '../../browser/outputs/gridOutput.component';
import { IDataResource } from 'sql/workbench/services/notebook/browser/sql/sqlSessionManager';
import { ResultSetSummary } from 'sql/workbench/services/query/common/query';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ISerializationService, SerializeDataParams } from 'sql/platform/serialization/common/serializationService';
import { SaveFormat, ResultSerializer } from 'sql/workbench/services/query/common/resultSerializer';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { DbCellValue } from 'azdata';
import { URI } from 'vs/base/common/uri';

suite('Data Resource Data Provider', function () {
	let source: IDataResource;
	let resultSet: ResultSetSummary;
	let documentUri: string;
	let _notificationService: INotificationService;
	let _clipboardService: IClipboardService;
	let _configurationService: IConfigurationService;
	let _textResourcePropertiesService: ITextResourcePropertiesService;
	let _serializationService: ISerializationService;
	let _instantiationService: TypeMoq.Mock<InstantiationService>;
	let dataResourceDataProvider: DataResourceDataProvider;
	let mockResultSerializer: TypeMoq.Mock<ResultSerializer>;
	let format: SaveFormat;
	let selection: Slick.Range[];
	let params: SerializeDataParams;

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
		_serializationService = undefined;
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
			_serializationService,
			_instantiationService.object
		);
		format = SaveFormat.CSV;
		selection = undefined;
		sinon.stub(mockResultSerializer.object, 'getBasicSaveParameters').withArgs(format).returns({ resultFormat: SaveFormat.CSV });
		params = dataResourceDataProvider.getSerializeRequestParams(mockResultSerializer.object, URI.file(documentUri), format, selection);
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

	test('getRowRange should return with headers when includeHeaders is true', function (): void {
		let rowStart = 0;
		let includeHeaders = true;
		let numberOfRows = 1;
		let results: DbCellValue[][] = params.getRowRange(rowStart, includeHeaders, numberOfRows);
		assert.equal(results.length, 2, 'Results should have 2 rows');
	});

	test('getRowRange should return without headers when includeHeaders is false', function (): void {
		let rowStart = 0;
		let includeHeaders = false;
		let numberOfRows = 1;
		let results: DbCellValue[][] = params.getRowRange(rowStart, includeHeaders, numberOfRows);
		assert.equal(results.length, 1, 'Results should have 1 row');
	});
});

