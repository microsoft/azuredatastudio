/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as os from 'os';
import * as assert from 'assert';

import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { ConnectionManagementService } from 'sql/workbench/services/connection/browser/connectionManagementService';
import { CellModel } from 'sql/workbench/services/notebook/browser/models/cell';
import { CellTypes, NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';
import { ModelFactory } from 'sql/workbench/services/notebook/browser/models/modelFactory';
import { INotebookModelOptions, NotebookContentChange, ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookEditorModel } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { NotebookService } from 'sql/workbench/services/notebook/browser/notebookServiceImpl';
import { URI } from 'vs/base/common/uri';
import { toResource } from 'vs/base/test/common/utils';
import { IModelService } from 'vs/editor/common/services/modelService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';
import { NullLogService } from 'vs/platform/log/common/log';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { Memento } from 'vs/workbench/common/memento';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { TextFileEditorModel } from 'vs/workbench/services/textfile/common/textFileEditorModel';
import { TextFileEditorModelManager } from 'vs/workbench/services/textfile/common/textFileEditorModelManager';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { TestLifecycleService, TestTextFileService, workbenchInstantiationService, TestTextFileEditorModelManager } from 'vs/workbench/test/browser/workbenchTestServices';
import { Range } from 'vs/editor/common/core/range';
import { nb } from 'azdata';
import { Emitter } from 'vs/base/common/event';
import { INotebookEditor, INotebookManager } from 'sql/workbench/services/notebook/browser/notebookService';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { startsWith } from 'vs/base/common/strings';
import { assign } from 'vs/base/common/objects';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { TestStorageService, TestTextResourcePropertiesService } from 'vs/workbench/test/common/workbenchTestServices';
import { NullAdsTelemetryService } from 'sql/platform/telemetry/common/adsTelemetryService';
import { IProductService } from 'vs/platform/product/common/productService';


class ServiceAccessor {
	constructor(
		@IEditorService public editorService: IEditorService,
		@ITextFileService public textFileService: TestTextFileService,
		@IModelService public modelService: IModelService
	) {
	}
}

class NotebookManagerStub implements INotebookManager {
	providerId: string;
	contentManager: nb.ContentManager;
	sessionManager: nb.SessionManager;
	serverManager: nb.ServerManager;
}

let defaultUri = URI.file('/some/path.ipynb');

// Note: these tests are intentionally written to be extremely brittle and break on any changes to notebook/cell serialization changes.
// If any of these tests fail, it is likely that notebook editor rehydration will fail with cryptic JSON messages.
suite('Notebook Editor Model', function (): void {
	let notebookManagers = [new NotebookManagerStub()];
	let notebookModel: NotebookModel;
	const instantiationService: IInstantiationService = workbenchInstantiationService();
	let accessor: ServiceAccessor;
	let defaultModelOptions: INotebookModelOptions;
	const logService = new NullLogService();
	const notificationService = TypeMoq.Mock.ofType(TestNotificationService, TypeMoq.MockBehavior.Loose);
	let memento = TypeMoq.Mock.ofType(Memento, TypeMoq.MockBehavior.Loose, '');
	memento.setup(x => x.getMemento(TypeMoq.It.isAny())).returns(() => void 0);
	let testinstantiationService = new TestInstantiationService();
	testinstantiationService.stub(IStorageService, new TestStorageService());
	testinstantiationService.stub(IProductService, { quality: 'stable' });
	const queryConnectionService = TypeMoq.Mock.ofType(ConnectionManagementService, TypeMoq.MockBehavior.Loose,
		undefined, // connection store
		undefined, // connection status manager
		undefined, // connection dialog service
		testinstantiationService, // instantiation service
		undefined, // editor service
		undefined, // telemetry service
		undefined, // configuration service
		new TestCapabilitiesService());
	queryConnectionService.callBase = true;
	const capabilitiesService = TypeMoq.Mock.ofType(TestCapabilitiesService);
	const configurationService = new TestConfigurationService();
	const testResourcePropertiesService = new TestTextResourcePropertiesService(configurationService);
	let mockModelFactory = TypeMoq.Mock.ofType(ModelFactory);
	mockModelFactory.callBase = true;
	mockModelFactory.setup(f => f.createCell(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
		return new CellModel({
			cell_type: CellTypes.Code,
			source: '',
			outputs: [
				<nb.IDisplayData>{
					output_type: 'display_data',
					data: {
						'text/html': [
							'<div>',
							'</div>'
						]
					}
				}
			]
		}, undefined, undefined);
	});

	let notebookService = new NotebookService(
		new TestLifecycleService(),
		undefined,
		undefined,
		undefined,
		instantiationService,
		undefined,
		undefined,
		undefined,
		new MockContextKeyService(),
		testinstantiationService.get(IProductService)
	);
	let mockNotebookService = TypeMoq.Mock.ofInstance(notebookService);

	mockNotebookService.setup(s => s.findNotebookEditor(TypeMoq.It.isAny())).returns(() => {
		return {
			cells: undefined,
			id: '0',
			notebookParams: undefined,
			modelReady: undefined,
			model: notebookModel,
			isDirty: undefined,
			isActive: undefined,
			isVisible: undefined,
			runAllCells: undefined,
			runCell: undefined,
			clearAllOutputs: undefined,
			clearOutput: undefined,
			executeEdits: undefined,
			getSections: undefined,
			navigateToSection: undefined,
			cellEditors: undefined,
			deltaDecorations: undefined,
			addCell: undefined
		};
	});

	let mockOnNotebookEditorAddEvent = new Emitter<INotebookEditor>();
	mockNotebookService.setup(s => s.onNotebookEditorAdd).returns(() => mockOnNotebookEditorAddEvent.event);

	setup(() => {
		accessor = instantiationService.createInstance(ServiceAccessor);

		defaultModelOptions = {
			notebookUri: defaultUri,
			factory: new ModelFactory(instantiationService),
			notebookManagers,
			contentManager: undefined,
			notificationService: notificationService.object,
			connectionService: queryConnectionService.object,
			providerId: 'SQL',
			cellMagicMapper: undefined,
			defaultKernel: undefined,
			layoutChanged: undefined,
			capabilitiesService: capabilitiesService.object
		};
	});

	teardown(() => {
		if (accessor && accessor.textFileService && accessor.textFileService.files) {
			(<TextFileEditorModelManager>accessor.textFileService.files).clear();
		}
	});

	test('should replace entire text model if NotebookChangeType is undefined', async function (): Promise<void> {
		await createNewNotebookModel();
		let notebookEditorModel = await createTextEditorModel(this);
		notebookEditorModel.replaceEntireTextEditorModel(notebookModel, undefined);

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineCount(), 6);
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(5), '    "cells": []');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(2), '    "metadata": {},');
	});

	test('should replace entire text model for add cell (0 -> 1 cells)', async function (): Promise<void> {
		await createNewNotebookModel();
		let notebookEditorModel = await createTextEditorModel(this);

		notebookEditorModel.replaceEntireTextEditorModel(notebookModel, undefined);

		let newCell = notebookModel.addCell(CellTypes.Code);

		let contentChange: NotebookContentChange = {
			changeType: NotebookChangeType.CellsModified,
			cells: [newCell],
			cellIndex: 0
		};
		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellsModified);
		assert(notebookEditorModel.lastEditFullReplacement);

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(8), '            "source": [');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(12), '                "azdata_cell_guid": "' + newCell.cellGuid + '"');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(14), '            "outputs": [');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(25), '            "execution_count": null');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(26), '        }');

		assert(notebookEditorModel.lastEditFullReplacement);
	});

	test('should not replace entire text model for execution count change', async function (): Promise<void> {
		await createNewNotebookModel();
		let notebookEditorModel = await createTextEditorModel(this);
		notebookEditorModel.replaceEntireTextEditorModel(notebookModel, undefined);

		let newCell = notebookModel.addCell(CellTypes.Code);

		let contentChange: NotebookContentChange = {
			changeType: NotebookChangeType.CellsModified,
			cells: [newCell],
			cellIndex: 0
		};
		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellsModified);
		assert(notebookEditorModel.lastEditFullReplacement);

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(25), '            "execution_count": null');

		newCell.executionCount = 1;
		contentChange = {
			changeType: NotebookChangeType.CellExecuted,
			cells: [newCell],
			cellIndex: 0
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellExecuted);

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(8), '            "source": [');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(12), '                "azdata_cell_guid": "' + newCell.cellGuid + '"');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(14), '            "outputs": [');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(25), '            "execution_count": 1');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(26), '        }');

		assert(!notebookEditorModel.lastEditFullReplacement);

		newCell.executionCount = 10;
		contentChange = {
			changeType: NotebookChangeType.CellExecuted,
			cells: [newCell],
			cellIndex: 0
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellExecuted);
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(25), '            "execution_count": 10');
		assert(!notebookEditorModel.lastEditFullReplacement);

		newCell.executionCount = 15;
		contentChange = {
			changeType: NotebookChangeType.CellExecuted,
			cells: [newCell],
			cellIndex: 0
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellExecuted);
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(25), '            "execution_count": 15');
		assert(!notebookEditorModel.lastEditFullReplacement);

		newCell.executionCount = 105;
		contentChange = {
			changeType: NotebookChangeType.CellExecuted,
			cells: [newCell],
			cellIndex: 0
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellExecuted);
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(25), '            "execution_count": 105');
		assert(!notebookEditorModel.lastEditFullReplacement);
	});

	test('should not replace entire text model for clear output', async function (): Promise<void> {
		await createNewNotebookModel();
		let notebookEditorModel = await createTextEditorModel(this);
		notebookEditorModel.replaceEntireTextEditorModel(notebookModel, undefined);

		let newCell = notebookModel.addCell(CellTypes.Code);

		let contentChange: NotebookContentChange = {
			changeType: NotebookChangeType.CellsModified,
			cells: [newCell],
			cellIndex: 0
		};
		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellsModified);
		assert(notebookEditorModel.lastEditFullReplacement);

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(14), '            "outputs": [');

		contentChange = {
			changeType: NotebookChangeType.CellOutputCleared,
			cells: [newCell],
			cellIndex: 0
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellOutputCleared);

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(8), '            "source": [');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(12), '                "azdata_cell_guid": "' + newCell.cellGuid + '"');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(14), '            "outputs": [],');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(15), '            "execution_count": null');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(16), '        }');

		assert(!notebookEditorModel.lastEditFullReplacement);
	});

	test('should not replace entire text model for multiline source change', async function (): Promise<void> {
		await createNewNotebookModel();
		let notebookEditorModel = await createTextEditorModel(this);
		notebookEditorModel.replaceEntireTextEditorModel(notebookModel, undefined);

		let newCell = notebookModel.addCell(CellTypes.Code);

		let contentChange: NotebookContentChange = {
			changeType: NotebookChangeType.CellsModified,
			cells: [newCell],
			cellIndex: 0
		};
		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellsModified);
		assert(notebookEditorModel.lastEditFullReplacement);

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(14), '            "outputs": [');

		contentChange = {
			changeType: NotebookChangeType.CellSourceUpdated,
			cells: [newCell],
			cellIndex: 0,
			modelContentChangedEvent: {
				changes: [{ range: new Range(1, 1, 1, 1), rangeLength: 0, rangeOffset: 0, text: 'This is a test' + os.EOL + 'Line 2 test' + os.EOL + 'Line 3 test' }],
				eol: os.EOL,
				isFlush: false,
				isRedoing: false,
				isUndoing: false,
				versionId: 2
			}
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellSourceUpdated);

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(8), '            "source": [');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(9), '                "This is a test\\n",');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(10), '                "Line 2 test\\n",');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(11), '                "Line 3 test"');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(12), '            ],');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(14), '                "azdata_cell_guid": "' + newCell.cellGuid + '"');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(16), '            "outputs": [');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(27), '            "execution_count": null');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(28), '        }');

		assert(!notebookEditorModel.lastEditFullReplacement);
	});

	test('should not replace entire text model for single line source change', async function (): Promise<void> {
		await createNewNotebookModel();
		let notebookEditorModel = await createTextEditorModel(this);
		notebookEditorModel.replaceEntireTextEditorModel(notebookModel, undefined);

		let newCell = notebookModel.addCell(CellTypes.Code);

		let contentChange: NotebookContentChange = {
			changeType: NotebookChangeType.CellsModified,
			cells: [newCell],
			cellIndex: 0
		};
		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellsModified);
		assert(notebookEditorModel.lastEditFullReplacement);

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(14), '            "outputs": [');

		contentChange = {
			changeType: NotebookChangeType.CellSourceUpdated,
			cells: [newCell],
			cellIndex: 0,
			modelContentChangedEvent: {
				changes: [{ range: new Range(1, 1, 1, 1), rangeLength: 0, rangeOffset: 0, text: 'This is a test' }],
				eol: '\n',
				isFlush: false,
				isRedoing: false,
				isUndoing: false,
				versionId: 2
			}
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellSourceUpdated);

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(8), '            "source": [');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(9), '                "This is a test"');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(10), '            ],');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(12), '                "azdata_cell_guid": "' + newCell.cellGuid + '"');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(14), '            "outputs": [');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(25), '            "execution_count": null');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(26), '        }');

		assert(!notebookEditorModel.lastEditFullReplacement);
	});

	test('should not replace entire text model for single line source change then delete', async function (): Promise<void> {
		await createNewNotebookModel();
		let notebookEditorModel = await createTextEditorModel(this);
		notebookEditorModel.replaceEntireTextEditorModel(notebookModel, undefined);

		let newCell = notebookModel.addCell(CellTypes.Code);

		let contentChange: NotebookContentChange = {
			changeType: NotebookChangeType.CellsModified,
			cells: [newCell],
			cellIndex: 0
		};
		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellsModified);
		assert(notebookEditorModel.lastEditFullReplacement);

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(8), '            "source": [');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(9), '                ""');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(10), '            ],');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(14), '            "outputs": [');

		contentChange = {
			changeType: NotebookChangeType.CellSourceUpdated,
			cells: [newCell],
			cellIndex: 0,
			modelContentChangedEvent: {
				changes: [{ range: new Range(1, 1, 1, 1), rangeLength: 0, rangeOffset: 0, text: 'This is a test' }],
				eol: '\n',
				isFlush: false,
				isRedoing: false,
				isUndoing: false,
				versionId: 2
			}
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellSourceUpdated);
		assert(!notebookEditorModel.lastEditFullReplacement);

		contentChange = {
			changeType: NotebookChangeType.CellSourceUpdated,
			cells: [newCell],
			cellIndex: 0,
			modelContentChangedEvent: {
				changes: [{ range: new Range(1, 1, 1, 15), rangeLength: 14, rangeOffset: 0, text: '' }],
				eol: '\n',
				isFlush: false,
				isRedoing: false,
				isUndoing: false,
				versionId: 3
			}
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellSourceUpdated);

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(8), '            "source": [');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(9), '                ""');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(10), '            ],');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(12), '                "azdata_cell_guid": "' + newCell.cellGuid + '"');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(14), '            "outputs": [');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(25), '            "execution_count": null');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(26), '        }');

		assert(!notebookEditorModel.lastEditFullReplacement);
	});

	test('should not replace entire text model for multiline source delete', async function (): Promise<void> {
		await createNewNotebookModel();
		let notebookEditorModel = await createTextEditorModel(this);
		notebookEditorModel.replaceEntireTextEditorModel(notebookModel, undefined);

		let newCell = notebookModel.addCell(CellTypes.Code);

		let contentChange: NotebookContentChange = {
			changeType: NotebookChangeType.CellsModified,
			cells: [newCell],
			cellIndex: 0
		};
		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellsModified);

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(14), '            "outputs": [');

		contentChange = {
			changeType: NotebookChangeType.CellSourceUpdated,
			cells: [newCell],
			cellIndex: 0,
			modelContentChangedEvent: {
				changes: [{ range: new Range(1, 1, 1, 1), rangeLength: 0, rangeOffset: 0, text: 'This is a test' + os.EOL + 'Line 2 test' + os.EOL + 'Line 3 test' }],
				eol: os.EOL,
				isFlush: false,
				isRedoing: false,
				isUndoing: false,
				versionId: 2
			}
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellSourceUpdated);
		assert(!notebookEditorModel.lastEditFullReplacement);

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(8), '            "source": [');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(9), '                "This is a test\\n",');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(10), '                "Line 2 test\\n",');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(11), '                "Line 3 test"');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(12), '            ],');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(14), '                "azdata_cell_guid": "' + newCell.cellGuid + '"');

		contentChange = {
			changeType: NotebookChangeType.CellSourceUpdated,
			cells: [newCell],
			cellIndex: 0,
			modelContentChangedEvent: {
				changes: [{ range: new Range(1, 2, 3, 11), rangeLength: 36, rangeOffset: 1, text: '' }],
				eol: '\n',
				isFlush: false,
				isRedoing: false,
				isUndoing: false,
				versionId: 3
			}
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellSourceUpdated);
		assert(!notebookEditorModel.lastEditFullReplacement);

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(8), '            "source": [');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(9), '                "Tt"');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(10), '            ],');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(12), '                "azdata_cell_guid": "' + newCell.cellGuid + '"');
	});

	test('should not replace entire text model and affect only edited cell', async function (): Promise<void> {
		await createNewNotebookModel();
		let notebookEditorModel = await createTextEditorModel(this);
		notebookEditorModel.replaceEntireTextEditorModel(notebookModel, undefined);

		let newCell;
		let contentChange: NotebookContentChange;
		for (let i = 0; i < 10; i++) {
			let cell;
			if (i === 7) {
				newCell = notebookModel.addCell(CellTypes.Code);
				cell = newCell;
			} else {
				cell = notebookModel.addCell(CellTypes.Code);
			}

			contentChange = {
				changeType: NotebookChangeType.CellsModified,
				cells: [cell],
				cellIndex: 0
			};
			notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellsModified);
			assert(notebookEditorModel.lastEditFullReplacement);
		}

		contentChange = {
			changeType: NotebookChangeType.CellSourceUpdated,
			cells: [newCell],
			modelContentChangedEvent: {
				changes: [{ range: new Range(1, 1, 1, 1), rangeLength: 0, rangeOffset: 0, text: 'This is a test' }],
				eol: '\n',
				isFlush: false,
				isRedoing: false,
				isUndoing: false,
				versionId: 2
			}
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellSourceUpdated);
		assert(!notebookEditorModel.lastEditFullReplacement);

		for (let i = 0; i < 10; i++) {
			assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(8 + i * 21), '            "source": [');
			if (i === 7) {
				assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(9 + i * 21), '                "This is a test"');
				assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(12 + i * 21), '                "azdata_cell_guid": "' + newCell.cellGuid + '"');
			} else {
				assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(9 + i * 21), '                ""');
			}
			assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(10 + i * 21), '            ],');
			assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(14 + i * 21), '            "outputs": [');
			assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(25 + i * 21), '            "execution_count": null');
			assert(startsWith(notebookEditorModel.editorModel.textEditorModel.getLineContent(26 + i * 21), '        }'));
		}
	});

	test('should not replace entire text model for output changes', async function (): Promise<void> {
		await createNewNotebookModel();
		let notebookEditorModel = await createTextEditorModel(this);
		notebookEditorModel.replaceEntireTextEditorModel(notebookModel, undefined);

		let newCell = notebookModel.addCell(CellTypes.Code);

		let contentChange: NotebookContentChange = {
			changeType: NotebookChangeType.CellsModified,
			cells: [newCell],
			cellIndex: 0
		};
		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellsModified);
		assert(notebookEditorModel.lastEditFullReplacement);

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(14), '            "outputs": [');

		newCell[<any>'_outputs'] = newCell.outputs.concat(newCell.outputs);

		contentChange = {
			changeType: NotebookChangeType.CellOutputUpdated,
			cells: [newCell]
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellOutputUpdated);

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(8), '            "source": [');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(12), '                "azdata_cell_guid": "' + newCell.cellGuid + '"');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(14), '            "outputs": [');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(23), '                }, {');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(31), '}');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(32), '            ],');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(33), '            "execution_count": null');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(34), '        }');

		assert(!notebookEditorModel.lastEditFullReplacement);
	});
	test('should not insert update at incorrect location', async function (): Promise<void> {
		await createNewNotebookModel();
		let notebookEditorModel = await createTextEditorModel(this);
		notebookEditorModel.replaceEntireTextEditorModel(notebookModel, undefined);

		let newCell = notebookModel.addCell(CellTypes.Code);

		let contentChange: NotebookContentChange = {
			changeType: NotebookChangeType.CellsModified,
			cells: [newCell],
			cellIndex: 0
		};
		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellsModified);
		assert(notebookEditorModel.lastEditFullReplacement);

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(14), '            "outputs": [');

		// First update the model with unmatched brackets
		let newUnmatchedBracketOutput: nb.IStreamResult = { output_type: 'stream', name: 'stdout', text: '[0em' };
		newCell[<any>'_outputs'] = newCell.outputs.concat(newUnmatchedBracketOutput);

		contentChange = {
			changeType: NotebookChangeType.CellOutputUpdated,
			cells: [newCell]
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellOutputUpdated);

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(8), '            "source": [');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(12), '                "azdata_cell_guid": "' + newCell.cellGuid + '"');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(14), '            "outputs": [');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(26), '    "text": "[0em"');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(27), '}');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(28), '            ],');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(29), '            "execution_count": null');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(30), '        }');

		assert(!notebookEditorModel.lastEditFullReplacement);

		// Now test updating the model after an unmatched bracket was previously output
		let newBracketlessOutput: nb.IStreamResult = { output_type: 'stream', name: 'stdout', text: 'test test test' };
		newCell[<any>'_outputs'] = newCell[<any>'_outputs'].concat(newBracketlessOutput);

		contentChange = {
			changeType: NotebookChangeType.CellOutputUpdated,
			cells: [newCell]
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellOutputUpdated);

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(32), '                    "text": "test test test"');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(33), '                }');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(34), '            ],');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(35), '            "execution_count": null');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(36), '        }');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(37), '    ]');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(38), '}');

		assert(notebookEditorModel.lastEditFullReplacement);
	});

	test('should not replace entire text model for output changes (1st update)', async function (): Promise<void> {
		await createNewNotebookModel();
		let notebookEditorModel = await createTextEditorModel(this);
		notebookEditorModel.replaceEntireTextEditorModel(notebookModel, undefined);

		let newCell = notebookModel.addCell(CellTypes.Code);
		let previousOutputs = newCell.outputs;
		// clear outputs
		newCell[<any>'_outputs'] = [];

		let contentChange: NotebookContentChange = {
			changeType: NotebookChangeType.CellsModified,
			cells: [newCell],
			cellIndex: 0
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellsModified);
		assert(notebookEditorModel.lastEditFullReplacement);

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(14), '            "outputs": [],');

		// add output
		newCell[<any>'_outputs'] = previousOutputs;

		contentChange = {
			changeType: NotebookChangeType.CellOutputUpdated,
			cells: [newCell]
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellOutputUpdated);

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(8), '            "source": [');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(12), '                "azdata_cell_guid": "' + newCell.cellGuid + '"');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(14), '            "outputs": [');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(23), '}');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(25), '            "execution_count": null');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(26), '        }');

		assert(!notebookEditorModel.lastEditFullReplacement);
	});

	test('should not replace entire text model for content change with double quotes', async function (): Promise<void> {
		await createNewNotebookModel();
		let notebookEditorModel = await createTextEditorModel(this);
		notebookEditorModel.replaceEntireTextEditorModel(notebookModel, undefined);

		let newCell = notebookModel.addCell(CellTypes.Code);
		setupTextEditorModelWithEmptyOutputs(notebookEditorModel, newCell);

		addTextToBeginningOfTextEditorModel(notebookEditorModel, newCell, '"This text is in quotes"');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(9), '                "\\"This text is in quotes\\""');

		ensureStaticContentInOneLineCellIsCorrect(notebookEditorModel, newCell);
		assert(!notebookEditorModel.lastEditFullReplacement);
	});

	test('should not replace entire text model for content change with many double quotes', async function (): Promise<void> {
		await createNewNotebookModel();
		let notebookEditorModel = await createTextEditorModel(this);
		notebookEditorModel.replaceEntireTextEditorModel(notebookModel, undefined);

		let newCell = notebookModel.addCell(CellTypes.Code);
		setupTextEditorModelWithEmptyOutputs(notebookEditorModel, newCell);

		addTextToBeginningOfTextEditorModel(notebookEditorModel, newCell, '""""""""""');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(9), '                "\\"\\"\\"\\"\\"\\"\\"\\"\\"\\""');

		ensureStaticContentInOneLineCellIsCorrect(notebookEditorModel, newCell);
		assert(!notebookEditorModel.lastEditFullReplacement);
	});

	test('should not replace entire text model for content change with many backslashes', async function (): Promise<void> {
		await createNewNotebookModel();
		let notebookEditorModel = await createTextEditorModel(this);
		notebookEditorModel.replaceEntireTextEditorModel(notebookModel, undefined);

		let newCell = notebookModel.addCell(CellTypes.Code);
		setupTextEditorModelWithEmptyOutputs(notebookEditorModel, newCell);

		addTextToBeginningOfTextEditorModel(notebookEditorModel, newCell, '\\\\\\\\\\');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(9), '                "\\\\\\\\\\\\\\\\\\\\\"');

		ensureStaticContentInOneLineCellIsCorrect(notebookEditorModel, newCell);
		assert(!notebookEditorModel.lastEditFullReplacement);
	});

	test('should not replace entire text model for content change with many backslashes and double quotes', async function (): Promise<void> {
		await createNewNotebookModel();
		let notebookEditorModel = await createTextEditorModel(this);
		notebookEditorModel.replaceEntireTextEditorModel(notebookModel, undefined);

		let newCell = notebookModel.addCell(CellTypes.Code);
		setupTextEditorModelWithEmptyOutputs(notebookEditorModel, newCell);

		addTextToBeginningOfTextEditorModel(notebookEditorModel, newCell, '\"\"\"\"\"\"\"\"\"\"');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(9), '                "\\\"\\\"\\\"\\\"\\\"\\\"\\\"\\\"\\\"\\\""');

		ensureStaticContentInOneLineCellIsCorrect(notebookEditorModel, newCell);
		assert(!notebookEditorModel.lastEditFullReplacement);
	});

	test('should not replace entire text model for content change with no special characters', async function (): Promise<void> {
		await createNewNotebookModel();
		let notebookEditorModel = await createTextEditorModel(this);
		notebookEditorModel.replaceEntireTextEditorModel(notebookModel, undefined);

		let newCell = notebookModel.addCell(CellTypes.Code);
		setupTextEditorModelWithEmptyOutputs(notebookEditorModel, newCell);

		addTextToBeginningOfTextEditorModel(notebookEditorModel, newCell, 'this is a long line in a cell test. Everything should serialize correctly! # Comments here: adding more tests is fun?');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(9), '                "this is a long line in a cell test. Everything should serialize correctly! # Comments here: adding more tests is fun?"');

		ensureStaticContentInOneLineCellIsCorrect(notebookEditorModel, newCell);
		assert(!notebookEditorModel.lastEditFullReplacement);
	});

	test('should not replace entire text model for content change with variety of characters', async function (): Promise<void> {
		await createNewNotebookModel();
		let notebookEditorModel = await createTextEditorModel(this);
		notebookEditorModel.replaceEntireTextEditorModel(notebookModel, undefined);

		let newCell = notebookModel.addCell(CellTypes.Code);
		setupTextEditorModelWithEmptyOutputs(notebookEditorModel, newCell);

		addTextToBeginningOfTextEditorModel(notebookEditorModel, newCell, '`~1!2@3#4$5%6^7&8*9(0)-_=+[{]}\\|;:",<.>/?\'');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(9), '                "`~1!2@3#4$5%6^7&8*9(0)-_=+[{]}\\\\|;:\\",<.>/?\'"');

		ensureStaticContentInOneLineCellIsCorrect(notebookEditorModel, newCell);
		assert(!notebookEditorModel.lastEditFullReplacement);
	});

	test('should not replace entire text model for content change with single quotes', async function (): Promise<void> {
		await createNewNotebookModel();
		let notebookEditorModel = await createTextEditorModel(this);
		notebookEditorModel.replaceEntireTextEditorModel(notebookModel, undefined);

		let newCell = notebookModel.addCell(CellTypes.Code);
		setupTextEditorModelWithEmptyOutputs(notebookEditorModel, newCell);

		addTextToBeginningOfTextEditorModel(notebookEditorModel, newCell, '\'\'\'\'');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(9), '                "\'\'\'\'"');

		ensureStaticContentInOneLineCellIsCorrect(notebookEditorModel, newCell);
		assert(!notebookEditorModel.lastEditFullReplacement);
	});

	test('should not replace entire text model for content change with empty content', async function (): Promise<void> {
		await createNewNotebookModel();
		let notebookEditorModel = await createTextEditorModel(this);
		notebookEditorModel.replaceEntireTextEditorModel(notebookModel, undefined);

		let newCell = notebookModel.addCell(CellTypes.Code);
		setupTextEditorModelWithEmptyOutputs(notebookEditorModel, newCell);

		addTextToBeginningOfTextEditorModel(notebookEditorModel, newCell, '');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(9), '                ""');

		ensureStaticContentInOneLineCellIsCorrect(notebookEditorModel, newCell);
		assert(!notebookEditorModel.lastEditFullReplacement);
	});

	test('should not replace entire text model for content change with multiline content', async function (): Promise<void> {
		await createNewNotebookModel();
		let notebookEditorModel = await createTextEditorModel(this);
		notebookEditorModel.replaceEntireTextEditorModel(notebookModel, undefined);

		let newCell = notebookModel.addCell(CellTypes.Code);
		setupTextEditorModelWithEmptyOutputs(notebookEditorModel, newCell);

		addTextToBeginningOfTextEditorModel(notebookEditorModel, newCell, '"test"' + os.EOL + 'test""');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(9), '                "\\"test\\"\\n",');

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(8), '            "source": [');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(10), '                "test\\"\\""');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(11), '            ],');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(13), '                "azdata_cell_guid": "' + newCell.cellGuid + '"');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(15), '            "outputs": [],');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(16), '            "execution_count": null');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(17), '        }');

		assert(!notebookEditorModel.lastEditFullReplacement);
	});

	test('should not replace entire text model for content change with multiline content different escaped characters', async function (): Promise<void> {
		await createNewNotebookModel();
		let notebookEditorModel = await createTextEditorModel(this);
		notebookEditorModel.replaceEntireTextEditorModel(notebookModel, undefined);

		let newCell = notebookModel.addCell(CellTypes.Code);
		setupTextEditorModelWithEmptyOutputs(notebookEditorModel, newCell);

		addTextToBeginningOfTextEditorModel(notebookEditorModel, newCell, '"""""test"' + os.EOL + '"""""""test\\""');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(9), '                "\\"\\"\\"\\"\\"test\\"\\n",');

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(8), '            "source": [');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(10), '                "\\"\\"\\"\\"\\"\\"\\"test\\\\\\"\\""');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(11), '            ],');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(13), '                "azdata_cell_guid": "' + newCell.cellGuid + '"');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(15), '            "outputs": [],');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(16), '            "execution_count": null');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(17), '        }');

		assert(!notebookEditorModel.lastEditFullReplacement);
	});

	async function createNewNotebookModel() {
		let options: INotebookModelOptions = assign({}, defaultModelOptions, <Partial<INotebookModelOptions>><unknown>{
			factory: mockModelFactory.object
		});
		notebookModel = new NotebookModel(options, undefined, logService, undefined, new NullAdsTelemetryService());
		await notebookModel.loadContents();
	}

	async function createTextEditorModel(self: Mocha.ITestCallbackContext): Promise<NotebookEditorModel> {
		let textFileEditorModel = instantiationService.createInstance(TextFileEditorModel, toResource.call(self, defaultUri.toString()), 'utf8', undefined);
		(<TestTextFileEditorModelManager>accessor.textFileService.files).add(textFileEditorModel.resource, textFileEditorModel);
		await textFileEditorModel.load();
		return new NotebookEditorModel(defaultUri, textFileEditorModel, mockNotebookService.object, testResourcePropertiesService);
	}

	function setupTextEditorModelWithEmptyOutputs(notebookEditorModel: NotebookEditorModel, newCell: ICellModel) {
		// clear outputs
		newCell[<any>'_outputs'] = [];

		let contentChange: NotebookContentChange = {
			changeType: NotebookChangeType.CellsModified,
			cells: [newCell],
			cellIndex: 0
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellsModified);
		assert(notebookEditorModel.lastEditFullReplacement);

		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(14), '            "outputs": [],');
	}

	function addTextToBeginningOfTextEditorModel(notebookEditorModel: NotebookEditorModel, newCell: ICellModel, textToAdd: string) {
		let contentChange: NotebookContentChange = {
			changeType: NotebookChangeType.CellSourceUpdated,
			cells: [newCell],
			cellIndex: 0,
			modelContentChangedEvent: {
				changes: [{ range: new Range(1, 1, 1, 1), rangeLength: 0, rangeOffset: 0, text: textToAdd }],
				eol: '\n',
				isFlush: false,
				isRedoing: false,
				isUndoing: false,
				versionId: 2
			}
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellSourceUpdated);
	}

	function ensureStaticContentInOneLineCellIsCorrect(notebookEditorModel: NotebookEditorModel, newCell: ICellModel) {
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(8), '            "source": [');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(10), '            ],');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(12), '                "azdata_cell_guid": "' + newCell.cellGuid + '"');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(14), '            "outputs": [],');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(15), '            "execution_count": null');
		assert.equal(notebookEditorModel.editorModel.textEditorModel.getLineContent(16), '        }');
	}
});
