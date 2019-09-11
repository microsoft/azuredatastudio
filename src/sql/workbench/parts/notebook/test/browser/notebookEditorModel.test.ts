/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as os from 'os';

import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { ConnectionManagementService } from 'sql/platform/connection/browser/connectionManagementService';
import { CellModel } from 'sql/workbench/parts/notebook/browser/models/cell';
import { CellTypes, NotebookChangeType } from 'sql/workbench/parts/notebook/common/models/contracts';
import { ModelFactory } from 'sql/workbench/parts/notebook/browser/models/modelFactory';
import { INotebookModelOptions, NotebookContentChange } from 'sql/workbench/parts/notebook/browser/models/modelInterfaces';
import { NotebookEditorModel } from 'sql/workbench/parts/notebook/browser/models/notebookInput';
import { NotebookModel } from 'sql/workbench/parts/notebook/browser/models/notebookModel';
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
import { TestEnvironmentService, TestLifecycleService, TestStorageService, TestTextFileService, workbenchInstantiationService, TestTextResourcePropertiesService } from 'vs/workbench/test/workbenchTestServices';
import { Range } from 'vs/editor/common/core/range';
import { nb } from 'azdata';
import { Emitter } from 'vs/base/common/event';
import { INotebookEditor, INotebookManager } from 'sql/workbench/services/notebook/browser/notebookService';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';


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
	const queryConnectionService = TypeMoq.Mock.ofType(ConnectionManagementService, TypeMoq.MockBehavior.Loose, memento.object, undefined, new TestStorageService());
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

	let mockNotebookService: TypeMoq.Mock<NotebookService>;
	mockNotebookService = TypeMoq.Mock.ofType(NotebookService, undefined, new TestLifecycleService(), undefined, undefined, undefined, instantiationService, new MockContextKeyService(),
		undefined, undefined, undefined, undefined, undefined, undefined, TestEnvironmentService);

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
			navigateToSection: undefined
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
		if (accessor && accessor.textFileService && accessor.textFileService.models) {
			(<TextFileEditorModelManager>accessor.textFileService.models).clear();
		}
	});

	test('should replace entire text model if NotebookChangeType is undefined', async function (): Promise<void> {
		await createNewNotebookModel();
		let notebookEditorModel = await createTextEditorModel(this);
		notebookEditorModel.replaceEntireTextEditorModel(notebookModel, undefined);

		should(notebookEditorModel.editorModel.textEditorModel.getLineCount()).equal(6);
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(5)).equal('    "cells": []');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(2)).equal('    "metadata": {},');
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
		should(notebookEditorModel.lastEditFullReplacement).equal(true);

		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(8)).equal('            "source": [');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(12)).equal('                "azdata_cell_guid": "' + newCell.cellGuid + '"');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(14)).equal('            "outputs": [');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(25)).equal('            "execution_count": 0');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(26)).equal('        }');

		should(notebookEditorModel.lastEditFullReplacement).equal(true);
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
		should(notebookEditorModel.lastEditFullReplacement).equal(true);

		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(25)).equal('            "execution_count": 0');

		newCell.executionCount = 1;
		contentChange = {
			changeType: NotebookChangeType.CellExecuted,
			cells: [newCell],
			cellIndex: 0
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellExecuted);

		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(8)).equal('            "source": [');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(12)).equal('                "azdata_cell_guid": "' + newCell.cellGuid + '"');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(14)).equal('            "outputs": [');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(25)).equal('            "execution_count": 1');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(26)).equal('        }');

		should(notebookEditorModel.lastEditFullReplacement).equal(false);

		newCell.executionCount = 10;
		contentChange = {
			changeType: NotebookChangeType.CellExecuted,
			cells: [newCell],
			cellIndex: 0
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellExecuted);
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(25)).equal('            "execution_count": 10');
		should(notebookEditorModel.lastEditFullReplacement).equal(false);

		newCell.executionCount = 15;
		contentChange = {
			changeType: NotebookChangeType.CellExecuted,
			cells: [newCell],
			cellIndex: 0
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellExecuted);
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(25)).equal('            "execution_count": 15');
		should(notebookEditorModel.lastEditFullReplacement).equal(false);

		newCell.executionCount = 105;
		contentChange = {
			changeType: NotebookChangeType.CellExecuted,
			cells: [newCell],
			cellIndex: 0
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellExecuted);
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(25)).equal('            "execution_count": 105');
		should(notebookEditorModel.lastEditFullReplacement).equal(false);
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
		should(notebookEditorModel.lastEditFullReplacement).equal(true);

		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(14)).equal('            "outputs": [');

		contentChange = {
			changeType: NotebookChangeType.CellOutputCleared,
			cells: [newCell],
			cellIndex: 0
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellOutputCleared);

		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(8)).equal('            "source": [');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(12)).equal('                "azdata_cell_guid": "' + newCell.cellGuid + '"');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(14)).equal('            "outputs": [],');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(15)).equal('            "execution_count": 0');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(16)).equal('        }');

		should(notebookEditorModel.lastEditFullReplacement).equal(false);
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
		should(notebookEditorModel.lastEditFullReplacement).equal(true);

		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(14)).equal('            "outputs": [');

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

		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(8)).equal('            "source": [');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(9)).equal('                "This is a test\\n",');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(10)).equal('                "Line 2 test\\n",');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(11)).equal('                "Line 3 test"');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(12)).equal('            ],');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(14)).equal('                "azdata_cell_guid": "' + newCell.cellGuid + '"');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(16)).equal('            "outputs": [');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(27)).equal('            "execution_count": 0');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(28)).equal('        }');

		should(notebookEditorModel.lastEditFullReplacement).equal(false);
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
		should(notebookEditorModel.lastEditFullReplacement).equal(true);

		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(14)).equal('            "outputs": [');

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

		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(8)).equal('            "source": [');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(9)).equal('                "This is a test"');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(10)).equal('            ],');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(12)).equal('                "azdata_cell_guid": "' + newCell.cellGuid + '"');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(14)).equal('            "outputs": [');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(25)).equal('            "execution_count": 0');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(26)).equal('        }');

		should(notebookEditorModel.lastEditFullReplacement).equal(false);
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
		should(notebookEditorModel.lastEditFullReplacement).equal(true);

		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(8)).equal('            "source": [');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(9)).equal('                ""');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(10)).equal('            ],');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(14)).equal('            "outputs": [');

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
		should(notebookEditorModel.lastEditFullReplacement).equal(false);

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

		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(8)).equal('            "source": [');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(9)).equal('                ""');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(10)).equal('            ],');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(12)).equal('                "azdata_cell_guid": "' + newCell.cellGuid + '"');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(14)).equal('            "outputs": [');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(25)).equal('            "execution_count": 0');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(26)).equal('        }');

		should(notebookEditorModel.lastEditFullReplacement).equal(false);
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

		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(14)).equal('            "outputs": [');

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
		should(notebookEditorModel.lastEditFullReplacement).equal(false);

		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(8)).equal('            "source": [');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(9)).equal('                "This is a test\\n",');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(10)).equal('                "Line 2 test\\n",');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(11)).equal('                "Line 3 test"');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(12)).equal('            ],');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(14)).equal('                "azdata_cell_guid": "' + newCell.cellGuid + '"');

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
		should(notebookEditorModel.lastEditFullReplacement).equal(false);

		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(8)).equal('            "source": [');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(9)).equal('                "Tt"');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(10)).equal('            ],');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(12)).equal('                "azdata_cell_guid": "' + newCell.cellGuid + '"');
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
			should(notebookEditorModel.lastEditFullReplacement).equal(true);
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
		should(notebookEditorModel.lastEditFullReplacement).equal(false);

		for (let i = 0; i < 10; i++) {
			should(notebookEditorModel.editorModel.textEditorModel.getLineContent(8 + i * 21)).equal('            "source": [');
			if (i === 7) {
				should(notebookEditorModel.editorModel.textEditorModel.getLineContent(9 + i * 21)).equal('                "This is a test"');
				should(notebookEditorModel.editorModel.textEditorModel.getLineContent(12 + i * 21)).equal('                "azdata_cell_guid": "' + newCell.cellGuid + '"');
			} else {
				should(notebookEditorModel.editorModel.textEditorModel.getLineContent(9 + i * 21)).equal('                ""');
			}
			should(notebookEditorModel.editorModel.textEditorModel.getLineContent(10 + i * 21)).equal('            ],');
			should(notebookEditorModel.editorModel.textEditorModel.getLineContent(14 + i * 21)).equal('            "outputs": [');
			should(notebookEditorModel.editorModel.textEditorModel.getLineContent(25 + i * 21)).equal('            "execution_count": 0');
			should(notebookEditorModel.editorModel.textEditorModel.getLineContent(26 + i * 21)).startWith('        }');
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
		should(notebookEditorModel.lastEditFullReplacement).equal(true);

		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(14)).equal('            "outputs": [');

		newCell[<any>'_outputs'] = newCell.outputs.concat(newCell.outputs);

		contentChange = {
			changeType: NotebookChangeType.CellOutputUpdated,
			cells: [newCell]
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellOutputUpdated);

		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(8)).equal('            "source": [');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(12)).equal('                "azdata_cell_guid": "' + newCell.cellGuid + '"');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(14)).equal('            "outputs": [');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(23)).equal('                }, {');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(31)).equal('}');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(32)).equal('            ],');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(33)).equal('            "execution_count": 0');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(34)).equal('        }');

		should(notebookEditorModel.lastEditFullReplacement).equal(false);
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
		should(notebookEditorModel.lastEditFullReplacement).equal(true);

		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(14)).equal('            "outputs": [],');

		// add output
		newCell[<any>'_outputs'] = previousOutputs;

		contentChange = {
			changeType: NotebookChangeType.CellOutputUpdated,
			cells: [newCell]
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellOutputUpdated);

		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(8)).equal('            "source": [');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(12)).equal('                "azdata_cell_guid": "' + newCell.cellGuid + '"');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(14)).equal('            "outputs": [');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(23)).equal('}');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(25)).equal('            "execution_count": 0');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(26)).equal('        }');

		should(notebookEditorModel.lastEditFullReplacement).equal(false);
	});

	async function createNewNotebookModel() {
		let options: INotebookModelOptions = Object.assign({}, defaultModelOptions, <Partial<INotebookModelOptions>><unknown>{
			factory: mockModelFactory.object
		});
		notebookModel = new NotebookModel(options, undefined, logService, undefined, undefined);
		await notebookModel.loadContents();
	}

	async function createTextEditorModel(self: Mocha.ITestCallbackContext): Promise<NotebookEditorModel> {
		let textFileEditorModel = instantiationService.createInstance(TextFileEditorModel, toResource.call(self, defaultUri.toString()), 'utf8', undefined);
		(<TextFileEditorModelManager>accessor.textFileService.models).add(textFileEditorModel.getResource(), textFileEditorModel);
		await textFileEditorModel.load();
		return new NotebookEditorModel(defaultUri, textFileEditorModel, mockNotebookService.object, accessor.textFileService, testResourcePropertiesService);
	}
});
