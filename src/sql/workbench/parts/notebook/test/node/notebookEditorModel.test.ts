/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as TypeMoq from 'typemoq';

import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { ConnectionManagementService } from 'sql/platform/connection/common/connectionManagementService';
import { CellModel } from 'sql/workbench/parts/notebook/common/models/cell';
import { CellTypes, NotebookChangeType } from 'sql/workbench/parts/notebook/common/models/contracts';
import { ModelFactory } from 'sql/workbench/parts/notebook/common/models/modelFactory';
import { INotebookModel, INotebookModelOptions, NotebookContentChange } from 'sql/workbench/parts/notebook/common/models/modelInterfaces';
import { NotebookEditorModel } from 'sql/workbench/parts/notebook/common/models/notebookInput';
import { NotebookModel } from 'sql/workbench/parts/notebook/common/models/notebookModel';
import { NotebookManagerStub } from 'sql/workbench/parts/notebook/test/node/common';
import { NotebookService } from 'sql/workbench/services/notebook/common/notebookServiceImpl';
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
import { TestEnvironmentService, TestLifecycleService, TestStorageService, TestTextFileService, workbenchInstantiationService } from 'vs/workbench/test/workbenchTestServices';
import { INotebookEditor } from 'sql/workbench/services/notebook/common/notebookService';



class ServiceAccessor {
	constructor(
		@IEditorService public editorService: IEditorService,
		@ITextFileService public textFileService: TestTextFileService,
		@IModelService public modelService: IModelService
	) {
	}
}

let defaultUri = URI.file('/some/path.ipynb');

suite('Notebook Editor Model', function (): void {
	let notebookManagers = [new NotebookManagerStub()];
	let notebookModel: NotebookModel;
	let instantiationService: IInstantiationService = workbenchInstantiationService();

	let accessor: ServiceAccessor;
	let defaultModelOptions: INotebookModelOptions;
	const logService = new NullLogService();
	const notificationService = TypeMoq.Mock.ofType(TestNotificationService, TypeMoq.MockBehavior.Loose);
	let memento = TypeMoq.Mock.ofType(Memento, TypeMoq.MockBehavior.Loose, '');
	memento.setup(x => x.getMemento(TypeMoq.It.isAny())).returns(() => void 0);
	const queryConnectionService = TypeMoq.Mock.ofType(ConnectionManagementService, TypeMoq.MockBehavior.Loose, memento.object, undefined, new TestStorageService());
	queryConnectionService.callBase = true;
	const capabilitiesService = TypeMoq.Mock.ofType(TestCapabilitiesService);

	let mockModelFactory = TypeMoq.Mock.ofType(ModelFactory);
	mockModelFactory.callBase = true;
	mockModelFactory.setup(f => f.createCell(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
		return new CellModel({ cell_type: CellTypes.Code, source: '' }, undefined, undefined);
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

	test('should replace entire text model for cell add (0 -> 1 cells)', async function (): Promise<void> {
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

		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(8)).startWith('            "source": [');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(12)).startWith('                "azdata_cell_guid": ');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(14)).startWith('            "outputs": [],');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(15)).equal('            "execution_count": 0');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(16)).equal('        }');

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

		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(15)).equal('            "execution_count": 0');

		newCell.executionCount = 1;
		contentChange = {
			changeType: NotebookChangeType.CellExecuted,
			cells: [newCell],
			cellIndex: 0
		};

		notebookEditorModel.updateModel(contentChange, NotebookChangeType.CellExecuted);

		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(8)).startWith('            "source": [');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(12)).startWith('                "azdata_cell_guid": ');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(14)).startWith('            "outputs": [],');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(15)).equal('            "execution_count": 1');
		should(notebookEditorModel.editorModel.textEditorModel.getLineContent(16)).equal('        }');

		should(notebookEditorModel.lastEditFullReplacement).equal(false);
	});

	async function createNewNotebookModel() {
		let options: INotebookModelOptions = Object.assign({}, defaultModelOptions, <Partial<INotebookModelOptions>><unknown>{
			factory: mockModelFactory.object
		});
		notebookModel = new NotebookModel(options, undefined, logService, undefined, undefined);
		await notebookModel.loadContents();
	}

	async function createTextEditorModel(self) {
		let textFileEditorModel = instantiationService.createInstance(TextFileEditorModel, toResource.call(self, defaultUri.toString()), 'utf8', undefined);
		(<TextFileEditorModelManager>accessor.textFileService.models).add(textFileEditorModel.getResource(), textFileEditorModel);
		await textFileEditorModel.load();

		return new NotebookEditorModel(defaultUri, textFileEditorModel, mockNotebookService.object, accessor.textFileService);

	}

});

