/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as TypeMoq from 'typemoq';
import { nb } from 'azdata';
import * as assert from 'assert';

import { URI } from 'vs/base/common/uri';
import { NotebookManagerStub } from 'sql/workbench/contrib/notebook/test/stubs';
import { CellTypes } from 'sql/workbench/contrib/notebook/common/models/contracts';
import { IClientSession, INotebookModelOptions } from 'sql/workbench/contrib/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/contrib/notebook/browser/models/notebookModel';
import { NullLogService } from 'vs/platform/log/common/log';
import { NotebookFindModel } from 'sql/workbench/contrib/notebook/find/notebookFindModel';
import { TestConnectionManagementService } from 'sql/platform/connection/test/common/testConnectionManagementService';
import { Deferred } from 'sql/base/common/promise';
import { ModelFactory } from 'sql/workbench/contrib/notebook/browser/models/modelFactory';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { Memento } from 'vs/workbench/common/memento';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { ClientSession } from 'sql/workbench/contrib/notebook/browser/models/clientSession';
import { TestStorageService } from 'vs/workbench/test/workbenchTestServices';
import { NotebookRange } from 'sql/workbench/contrib/notebook/find/notebookFindDecorations';
import { NotebookEditorContentManager } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';

let expectedNotebookContent: nb.INotebookContents = {
	cells: [{
		cell_type: CellTypes.Code,
		source: 'insert into t1 values (c1, c2) \ninsert into markdown values (*hello worls*)',
		metadata: { language: 'python' },
		execution_count: 1
	}, {
		cell_type: CellTypes.Markdown,
		source: 'I am *markdown*',
		metadata: { language: 'python' },
		execution_count: 1
	}],
	metadata: {
		kernelspec: {
			name: 'mssql',
			language: 'sql'
		}
	},
	nbformat: 4,
	nbformat_minor: 5
};

let defaultUri = URI.file('/some/path.ipynb');

let mockClientSession: TypeMoq.Mock<IClientSession>;
let sessionReady: Deferred<void>;
let mockModelFactory: TypeMoq.Mock<ModelFactory>;
let notificationService: TypeMoq.Mock<INotificationService>;
let capabilitiesService: TypeMoq.Mock<ICapabilitiesService>;
let instantiationService: IInstantiationService;
let serviceCollection = new ServiceCollection();

suite('Notebook Find Model', function (): void {

	let notebookManagers = [new NotebookManagerStub()];
	let memento: TypeMoq.Mock<Memento>;
	let queryConnectionService: TypeMoq.Mock<TestConnectionManagementService>;
	let defaultModelOptions: INotebookModelOptions;
	const logService = new NullLogService();
	let model: NotebookModel;
	//const retryCount = 24; // 2 minutes

	setup(async () => {
		sessionReady = new Deferred<void>();
		notificationService = TypeMoq.Mock.ofType(TestNotificationService, TypeMoq.MockBehavior.Loose);
		capabilitiesService = TypeMoq.Mock.ofType(TestCapabilitiesService);
		memento = TypeMoq.Mock.ofType(Memento, TypeMoq.MockBehavior.Loose, '');
		memento.setup(x => x.getMemento(TypeMoq.It.isAny())).returns(() => void 0);
		queryConnectionService = TypeMoq.Mock.ofType(TestConnectionManagementService, TypeMoq.MockBehavior.Loose, memento.object, undefined, new TestStorageService());
		queryConnectionService.callBase = true;

		instantiationService = new InstantiationService(serviceCollection, true);
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
		mockClientSession = TypeMoq.Mock.ofType(ClientSession, undefined, defaultModelOptions);
		mockClientSession.setup(c => c.initialize()).returns(() => {
			return Promise.resolve();
		});
		mockClientSession.setup(c => c.ready).returns(() => sessionReady.promise);
		mockModelFactory = TypeMoq.Mock.ofType(ModelFactory);
		mockModelFactory.callBase = true;
		mockModelFactory.setup(f => f.createClientSession(TypeMoq.It.isAny())).returns(() => {
			return mockClientSession.object;
		});

		await initNotebookModel(expectedNotebookContent);

		/* let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentManager);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedNotebookContent));
		defaultModelOptions.contentManager = mockContentManager.object;
		// When I initialize the model
		model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, undefined);
		await model.loadContents();
		await model.requestModelLoad(); */
	});

	test('Should find results in the notebook', async function (): Promise<void> {
		//initialize find
		let notebookFindModel = new NotebookFindModel(model);
		await notebookFindModel.find('markdown', 5);

		assert(notebookFindModel.findMatches, new Error('Find in notebook failed.'));
		assert.equal(notebookFindModel.findMatches.length, 2, new Error('Find couldnt find all occurances'));
	});

	test('Should match find result ranges', async function (): Promise<void> {
		let notebookFindModel = new NotebookFindModel(model);
		await notebookFindModel.find('markdown', 5);

		let expectedFindRange1 = new NotebookRange(model.cells[0], 2, 13, 2, 21);
		assert.deepEqual(notebookFindModel.findMatches[0].range, expectedFindRange1, new Error('Find in markdown range is wrong :\n' + JSON.stringify(expectedFindRange1) + '\n ' + JSON.stringify(notebookFindModel.findMatches[0].range)));

		let expectedFindRange2 = new NotebookRange(model.cells[1], 1, 6, 1, 14);
		assert.deepEqual(notebookFindModel.findMatches[1].range, expectedFindRange2, new Error('Find in markdown range is wrong :\n' + JSON.stringify(expectedFindRange2) + '\n ' + JSON.stringify(notebookFindModel.findMatches[1].range)));
	});

	test('Should ignore hyperlink markdown data and find correctly', async function (): Promise<void> {
		let markdownContent: nb.INotebookContents = {
			cells: [{
				cell_type: CellTypes.Markdown,
				source: 'I am markdown link: [best link ever](https://url/of/the/best-link-ever)',
				metadata: { language: 'python' },
				execution_count: 1
			}],
			metadata: {
				kernelspec: {
					name: 'mssql',
					language: 'sql'
				}
			},
			nbformat: 4,
			nbformat_minor: 5
		};
		await initNotebookModel(markdownContent);

		let notebookFindModel = new NotebookFindModel(model);
		await notebookFindModel.find('best', 5);

		assert.equal(notebookFindModel.findMatches.length, 1, new Error('Find failed on markdown link'));

		let expectedFindRange1 = new NotebookRange(model.cells[0], 1, 21, 1, 25);
		assert.deepEqual(notebookFindModel.findMatches[0].range, expectedFindRange1, new Error('Find in markdown range is wrong :\n' + JSON.stringify(expectedFindRange1) + '\n ' + JSON.stringify(notebookFindModel.findMatches[0].range)));


	});

	async function initNotebookModel(contents: nb.INotebookContents): Promise<void> {
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentManager);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(contents));
		defaultModelOptions.contentManager = mockContentManager.object;
		// When I initialize the model
		model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, undefined);
		await model.loadContents();
		await model.requestModelLoad();
	}

});

