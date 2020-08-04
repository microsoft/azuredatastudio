/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DataResourceDataProvider } from '../../browser/outputs/gridOutput.component';
import { IDataResource } from 'sql/workbench/services/notebook/browser/sql/sqlSessionManager';
import { ResultSetSummary } from 'sql/workbench/services/query/common/query';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ISerializationService, SerializeDataParams } from 'sql/platform/serialization/common/serializationService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { SaveFormat, ResultSerializer } from 'sql/workbench/services/query/common/resultSerializer';
import * as assert from 'assert';
import { URI } from 'vs/base/common/uri';
import { workbenchInstantiationService } from 'vs/workbench/test/browser/workbenchTestServices';
import sinon = require('sinon');
import { DbCellValue } from 'azdata';

suite('Data Resource Data Provider', function () {
	let source: IDataResource;
	let resultSet: ResultSetSummary;
	let documentUri: string;
	let _notificationService: INotificationService;
	let _clipboardService: IClipboardService;
	let _configurationService: IConfigurationService;
	let _textResourcePropertiesService: ITextResourcePropertiesService;
	let _serializationService: ISerializationService;
	let _instantiationService: IInstantiationService;
	let dataResourceDataProvider: DataResourceDataProvider;
	let serializer: ResultSerializer;
	let format: SaveFormat;
	let selection: Slick.Range[];
	let params: SerializeDataParams;

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
	_instantiationService = workbenchInstantiationService();
	dataResourceDataProvider = new DataResourceDataProvider(
		source,
		resultSet,
		documentUri,
		_notificationService,
		_clipboardService,
		_configurationService,
		_textResourcePropertiesService,
		_serializationService,
		_instantiationService
	);
	serializer = _instantiationService.createInstance(ResultSerializer);
	format = SaveFormat.CSV;
	selection = undefined;
	sinon.stub(ResultSerializer.prototype, 'getBasicSaveParameters').withArgs(format).returns({ resultFormat: SaveFormat.CSV });
	params = dataResourceDataProvider.getSerializeRequestParams(serializer, URI.file(documentUri), format, selection);

	test('getRowRange should return with headers when includeHeaders is true', async function (): Promise<void> {
		let rowStart = 0;
		let includeHeaders = true;
		let numberOfRows = 1;
		let results: DbCellValue[][] = params.getRowRange(rowStart, includeHeaders, numberOfRows);
		assert.equal(results.length, 2, 'result should have 2 rows');
	});

	test('getRows should return without headers when includeHeaders is false', async function (): Promise<void> {
		let rowStart = 0;
		let includeHeaders = false;
		let numberOfRows = 1;
		let results: DbCellValue[][] = params.getRowRange(rowStart, includeHeaders, numberOfRows);
		assert.equal(results.length, 1, 'results should have 1 row');
	});
});

