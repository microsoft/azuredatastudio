/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as TypeMoq from 'typemoq';
import { nb } from 'azdata';
import * as assert from 'assert';

import { URI } from 'vs/base/common/uri';
import { ExecuteManagerStub, NotebookServiceStub, SerializationManagerStub } from 'sql/workbench/contrib/notebook/test/stubs';
import { CellTypes, NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';
import { ICellModel, IClientSession, INotebookModelOptions } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { ILogService, NullLogService } from 'vs/platform/log/common/log';
import { NotebookFindModel } from 'sql/workbench/contrib/notebook/browser/find/notebookFindModel';
import { TestConnectionManagementService } from 'sql/platform/connection/test/common/testConnectionManagementService';
import { Deferred } from 'sql/base/common/promise';
import { ModelFactory } from 'sql/workbench/services/notebook/browser/models/modelFactory';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { Memento } from 'vs/workbench/common/memento';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { ClientSession } from 'sql/workbench/services/notebook/browser/models/clientSession';
import { mock, TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';
import { NotebookEditorContentLoader } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';
import { INotebookService, NotebookRange, SQL_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/browser/notebookService';
import { NotebookMarkdownRenderer } from 'sql/workbench/contrib/notebook/browser/outputs/notebookMarkdown';
import { NullAdsTelemetryService } from 'sql/platform/telemetry/common/adsTelemetryService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { TestConfigurationService } from 'sql/platform/connection/test/common/testConfigurationService';
import { SessionManager } from 'sql/workbench/contrib/notebook/test/emptySessionClasses';
import { NBFORMAT, NBFORMAT_MINOR } from 'sql/workbench/common/constants';
import { Emitter } from 'vs/base/common/event';
import { IStandardKernelWithProvider } from 'sql/workbench/services/notebook/browser/models/notebookUtils';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { ICommandService, NullCommandService } from 'vs/platform/commands/common/commands';
import { ILanguageService } from 'vs/editor/common/languages/language';

let expectedNotebookContent: nb.INotebookContents = {
	cells: [{
		cell_type: CellTypes.Code,
		source: ['insert into t1 values (c1, c2) ', 'INSERT into markdown values (*hello world*)'],
		metadata: { language: 'python' },
		execution_count: 1
	}, {
		cell_type: CellTypes.Markdown,
		source: ['I am *markdown insertImportant*'],
		metadata: { language: 'python' },
		execution_count: 1
	}],
	metadata: {
		kernelspec: {
			name: 'mssql',
			language: 'sql',
			display_name: 'SQL'
		}
	},
	nbformat: NBFORMAT,
	nbformat_minor: NBFORMAT_MINOR
};

let defaultUri = URI.file('/some/path.ipynb');
let max_find_count = 3;
let mockClientSession: TypeMoq.Mock<IClientSession>;
let sessionReady: Deferred<void>;
let mockModelFactory: TypeMoq.Mock<ModelFactory>;
let notificationService: TypeMoq.Mock<INotificationService>;
let capabilitiesService: TypeMoq.Mock<ICapabilitiesService>;
let instantiationService: TestInstantiationService;
let serviceCollection = new ServiceCollection();

suite('Notebook Find Model', function (): void {
	let serializationManagers = [new SerializationManagerStub()];
	let executeManagers = [new ExecuteManagerStub()];
	let memento: TypeMoq.Mock<Memento>;
	let queryConnectionService: TypeMoq.Mock<TestConnectionManagementService>;
	let defaultModelOptions: INotebookModelOptions;
	const logService = new NullLogService();
	let model: NotebookModel;
	let markdownRenderer: NotebookMarkdownRenderer = new NotebookMarkdownRenderer(new TestConfigurationService());
	let configurationService: IConfigurationService;

	setup(async () => {
		let mockSessionManager = TypeMoq.Mock.ofType(SessionManager);
		executeManagers[0].providerId = SQL_NOTEBOOK_PROVIDER;
		executeManagers[0].sessionManager = mockSessionManager.object;
		sessionReady = new Deferred<void>();
		notificationService = TypeMoq.Mock.ofType<INotificationService>(TestNotificationService, TypeMoq.MockBehavior.Loose);
		capabilitiesService = TypeMoq.Mock.ofType<ICapabilitiesService>(TestCapabilitiesService);
		memento = TypeMoq.Mock.ofType(Memento, TypeMoq.MockBehavior.Loose, '');
		memento.setup(x => x.getMemento(TypeMoq.It.isAny(), TypeMoq.It.isAny()
		)).returns(() => void 0);
		queryConnectionService = TypeMoq.Mock.ofType(TestConnectionManagementService, TypeMoq.MockBehavior.Loose, memento.object, undefined, new TestStorageService());
		queryConnectionService.callBase = true;

		configurationService = new TestConfigurationService();
		serviceCollection.set(ICommandService, NullCommandService);
		serviceCollection.set(IConfigurationService, configurationService);
		serviceCollection.set(ILogService, new NullLogService());
		instantiationService = new TestInstantiationService(serviceCollection, true);
		instantiationService.stub(INotebookService, new class extends mock<INotebookService>() {
			override async serializeNotebookStateChange(notebookUri: URI, changeType: NotebookChangeType, cell?: ICellModel, isTrusted?: boolean): Promise<void> { }
			override notifyCellExecutionStarted(): void { }
		});
		instantiationService.stub(ILanguageService, new class extends mock<ILanguageService>() { });

		defaultModelOptions = {
			notebookUri: defaultUri,
			factory: new ModelFactory(instantiationService),
			serializationManagers: serializationManagers,
			executeManagers: executeManagers,
			contentLoader: undefined,
			notificationService: notificationService.object,
			connectionService: queryConnectionService.object,
			providerId: 'SQL',
			cellMagicMapper: undefined,
			defaultKernel: undefined,
			layoutChanged: undefined,
			capabilitiesService: capabilitiesService.object,
			getInputLanguageMode: () => undefined
		};
		mockClientSession = TypeMoq.Mock.ofType<IClientSession>(ClientSession, undefined, defaultModelOptions);
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
	});

	test('Should set notebook model on initialize', async function (): Promise<void> {
		//initialize find
		let notebookFindModel = new NotebookFindModel(model);
		assert.strictEqual(notebookFindModel.notebookModel, model, 'Failed to set notebook model');
	});

	test('Should have no decorations on initialize', async function (): Promise<void> {
		//initialize find
		let notebookFindModel = new NotebookFindModel(model);
		assert.strictEqual(notebookFindModel.findDecorations, undefined, 'findDecorations should be undefined on initialize');
		assert.strictEqual(notebookFindModel.getPosition(), undefined, 'currentMatch should be undefined on initialize');
		assert.strictEqual(notebookFindModel.getLastPosition(), undefined, 'previousMatch should be undefined on initialize');
	});

	test('Should find results in the notebook', async function (): Promise<void> {
		// Need to set rendered text content for 2nd cell
		setRenderedTextContent(1);

		//initialize find
		let notebookFindModel = new NotebookFindModel(model);
		await notebookFindModel.find('markdown', false, false, max_find_count);

		assert(notebookFindModel.findMatches, 'Find in notebook failed.');
		assert.strictEqual(notebookFindModel.findMatches.length, 2, 'Find could not find all occurrences');
		assert.strictEqual(notebookFindModel.findArray.length, 2, 'Find could not find all occurrences');
		assert.strictEqual(notebookFindModel.getFindCount(), 2, 'Find count do not match find results');
	});

	test('Should not find results in the notebook', async function (): Promise<void> {
		//initialize find
		let notebookFindModel = new NotebookFindModel(model);
		await notebookFindModel.find('notFound', false, false, max_find_count);

		assert.strictEqual(notebookFindModel.findMatches.length, 0, 'Find failed');
	});

	test('Should match find result ranges', async function (): Promise<void> {
		// Need to set rendered text content for 2nd cell
		setRenderedTextContent(1);

		let notebookFindModel = new NotebookFindModel(model);
		await notebookFindModel.find('markdown', false, false, max_find_count);

		let expectedFindRange1 = new NotebookRange(model.cells[0], 2, 13, 2, 21);
		assert.deepStrictEqual(notebookFindModel.findMatches[0].range, expectedFindRange1, 'Find in markdown range is wrong :\n' + JSON.stringify(expectedFindRange1) + '\n ' + JSON.stringify(notebookFindModel.findMatches[0].range));

		let expectedFindRange2 = new NotebookRange(model.cells[1], 1, 6, 1, 14);
		assert.deepStrictEqual(notebookFindModel.findMatches[1].range, expectedFindRange2, 'Find in markdown range is wrong :\n' + JSON.stringify(expectedFindRange2) + '\n ' + JSON.stringify(notebookFindModel.findMatches[1].range));
	});

	test('Should set selection when find matches results', async function (): Promise<void> {
		// Need to set rendered text content for 2nd cell
		setRenderedTextContent(1);

		//initialize find
		let notebookFindModel = new NotebookFindModel(model);
		await notebookFindModel.find('markdown', false, false, max_find_count);

		notebookFindModel.setSelection(notebookFindModel.findMatches[0].range);
		let expectedFindRange1 = new NotebookRange(model.cells[0], 2, 13, 2, 21);
		assert.deepStrictEqual(notebookFindModel.currentMatch, expectedFindRange1, 'Find failed to set selection on finding results');
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
					language: 'sql',
					display_name: 'SQL'
				}
			},
			nbformat: NBFORMAT,
			nbformat_minor: NBFORMAT_MINOR
		};
		await initNotebookModel(markdownContent);

		// Need to set rendered text content for 1st cell
		setRenderedTextContent(0);

		let notebookFindModel = new NotebookFindModel(model);
		await notebookFindModel.find('best', false, false, max_find_count);

		assert.strictEqual(notebookFindModel.findMatches.length, 1, 'Find failed on markdown link');

		let expectedFindRange1 = new NotebookRange(model.cells[0], 1, 21, 1, 25);
		assert.deepStrictEqual(notebookFindModel.findMatches[0].range, expectedFindRange1, 'Find in markdown range is wrong :\n' + JSON.stringify(expectedFindRange1) + '\n ' + JSON.stringify(notebookFindModel.findMatches[0].range));

	});

	test('Should not find more than max results in the notebook', async function (): Promise<void> {
		let codeContent: nb.INotebookContents = {
			cells: [{
				cell_type: CellTypes.Code,
				source: ['import x', 'x.init()', 'x.show()', 'x.analyze()'],
				metadata: { language: 'python' },
				execution_count: 1
			}],
			metadata: {
				kernelspec: {
					name: 'python',
					language: 'python',
					display_name: 'Python'
				}
			},
			nbformat: NBFORMAT,
			nbformat_minor: NBFORMAT_MINOR
		};
		await initNotebookModel(codeContent);
		//initialize find
		let notebookFindModel = new NotebookFindModel(model);
		await notebookFindModel.find('x', false, false, max_find_count);

		assert.strictEqual(notebookFindModel.findMatches.length, 3, 'Find failed');
	});

	test('Should match find results for multiple results on same line', async function (): Promise<void> {
		let codeContent: nb.INotebookContents = {
			cells: [{
				cell_type: CellTypes.Code,
				source: ['abc abc abc abc abc abcabc ab a b c'],
				metadata: { language: 'python' },
				execution_count: 1
			}],
			metadata: {
				kernelspec: {
					name: 'python',
					language: 'python',
					display_name: 'Python'
				}
			},
			nbformat: NBFORMAT,
			nbformat_minor: NBFORMAT_MINOR
		};
		await initNotebookModel(codeContent);
		//initialize find
		let notebookFindModel = new NotebookFindModel(model);
		// Intentionally not using max_find_count here, as 7 items should be found
		await notebookFindModel.find('abc', false, false, 10);

		assert.strictEqual(notebookFindModel.findMatches.length, 7, 'Find failed to find number of matches correctly');

		assert.deepStrictEqual(notebookFindModel.findMatches[0].range, new NotebookRange(model.cells[0], 1, 1, 1, 4));
		assert.deepStrictEqual(notebookFindModel.findMatches[1].range, new NotebookRange(model.cells[0], 1, 5, 1, 8));
		assert.deepStrictEqual(notebookFindModel.findMatches[2].range, new NotebookRange(model.cells[0], 1, 9, 1, 12));
		assert.deepStrictEqual(notebookFindModel.findMatches[3].range, new NotebookRange(model.cells[0], 1, 13, 1, 16));
		assert.deepStrictEqual(notebookFindModel.findMatches[4].range, new NotebookRange(model.cells[0], 1, 17, 1, 20));
		assert.deepStrictEqual(notebookFindModel.findMatches[5].range, new NotebookRange(model.cells[0], 1, 21, 1, 24));
		assert.deepStrictEqual(notebookFindModel.findMatches[6].range, new NotebookRange(model.cells[0], 1, 24, 1, 27));
	});


	test('Should find results correctly with & without matching case selection', async function (): Promise<void> {
		// Need to set rendered text content for 2nd cell
		setRenderedTextContent(1);

		//initialize find
		let notebookFindModel = new NotebookFindModel(model);
		await notebookFindModel.find('insert', false, false, max_find_count);

		assert(notebookFindModel.findMatches, 'Find in notebook failed.');
		assert.strictEqual(notebookFindModel.findMatches.length, 3, 'Find couldn\'t find all occurrences');

		await notebookFindModel.find('insert', true, false, max_find_count);
		assert.strictEqual(notebookFindModel.findMatches.length, 2, 'Find failed to apply match case while searching');

	});

	test('Should find results with matching whole word in the notebook', async function (): Promise<void> {
		//initialize find
		let notebookFindModel = new NotebookFindModel(model);

		await notebookFindModel.find('insert', true, true, max_find_count);
		assert.strictEqual(notebookFindModel.findMatches.length, 1, 'Find failed to apply whole word filter while searching');

	});

	test('Should find special characters in the search term without problems', async function (): Promise<void> {
		let codeContent: nb.INotebookContents = {
			cells: [{
				cell_type: CellTypes.Code,
				source: ['import x', 'x.init()', '//am just adding a bunch of {special} <characters> !!!!$}'],
				metadata: { language: 'python' },
				execution_count: 1
			}],
			metadata: {
				kernelspec: {
					name: 'python',
					language: 'python',
					display_name: 'Python'
				}
			},
			nbformat: NBFORMAT,
			nbformat_minor: NBFORMAT_MINOR
		};
		await initNotebookModel(codeContent);
		//initialize find
		let notebookFindModel = new NotebookFindModel(model);
		// test for string with special character
		await notebookFindModel.find('{special}', true, true, max_find_count);
		assert.strictEqual(notebookFindModel.findMatches.length, 1, 'Find failed for search term with special character');
		// test for only special character !!
		await notebookFindModel.find('!!', false, false, max_find_count);
		assert.strictEqual(notebookFindModel.findMatches.length, 2, 'Find failed for special character');

		// test for only special character combination
		await notebookFindModel.find('!!!$}', false, false, max_find_count);
		assert.strictEqual(notebookFindModel.findMatches.length, 1, 'Find failed for special character combination');
	});

	test('Should find // characters in the search term correctly', async function (): Promise<void> {
		let codeContent: nb.INotebookContents = {
			cells: [{
				cell_type: CellTypes.Code,
				source: ['import x', 'x.init()', '//am just adding a bunch of {special} <characters> !test$}'],
				metadata: { language: 'python' },
				execution_count: 1
			}],
			metadata: {
				kernelspec: {
					name: 'python',
					language: 'python',
					display_name: 'Python'
				}
			},
			nbformat: NBFORMAT,
			nbformat_minor: NBFORMAT_MINOR
		};
		await initNotebookModel(codeContent);
		//initialize find
		let notebookFindModel = new NotebookFindModel(model);

		await notebookFindModel.find('/', true, false, max_find_count);
		assert.strictEqual(notebookFindModel.findMatches.length, 2, 'Find failed to find number of / occurrences');

		await notebookFindModel.find('//', true, false, max_find_count);
		assert.strictEqual(notebookFindModel.findMatches.length, 1, 'Find failed to find number of // occurrences');

		await notebookFindModel.find('//', true, true, max_find_count);
		assert.strictEqual(notebookFindModel.findMatches.length, 0, 'Find failed to apply match whole word for //');
	});

	test('Should find results in the code cell on markdown edit', async function (): Promise<void> {
		let markdownContent: nb.INotebookContents = {
			cells: [{
				cell_type: CellTypes.Markdown,
				source: ['SOP067 - INTERNAL - Install azdata CLI - release candidate', '==========================================================', 'Steps', '-----', '### Parameters'],
				metadata: { language: 'python' },
				execution_count: 1
			}],
			metadata: {
				kernelspec: {
					name: 'mssql',
					language: 'sql',
					display_name: 'SQL'
				}
			},
			nbformat: NBFORMAT,
			nbformat_minor: NBFORMAT_MINOR
		};
		await initNotebookModel(markdownContent);

		// Need to set rendered text content for 1st cell
		setRenderedTextContent(0);

		let notebookFindModel = new NotebookFindModel(model);
		await notebookFindModel.find('SOP', false, false, max_find_count);

		assert.strictEqual(notebookFindModel.findMatches.length, 1, 'Find failed on markdown');

		// fire the edit mode on cell
		model.cells[0].isEditMode = true;
		notebookFindModel = new NotebookFindModel(model);
		await notebookFindModel.find('SOP', false, false, max_find_count);

		assert.strictEqual(notebookFindModel.findMatches.length, 2, 'Find failed on markdown edit');
	});

	test('Should find results in the output of the code cell when output is stream', async function (): Promise<void> {
		let codeCellOutput: nb.IStreamResult = {
			output_type: 'stream',
			name: 'stdout',
			text: 'trace\nhello world\n.local\n'
		};
		let cellContent: nb.INotebookContents = {
			cells: [{
				cell_type: CellTypes.Markdown,
				source: ['Hello World'],
				metadata: { language: 'python' },
				execution_count: 1
			},
			{
				cell_type: 'code',
				source: [
					'print(\'trace\')\n',
					'print(\'hello world\')\n',
					'print(\'.local\')'
				],
				metadata: { language: 'python' },
				outputs: [
					codeCellOutput
				],
				execution_count: 1
			}],
			metadata: {
				kernelspec: {
					name: 'mssql',
					language: 'sql',
					display_name: 'SQL'
				}
			},
			nbformat: 4,
			nbformat_minor: NBFORMAT_MINOR
		};
		await initNotebookModel(cellContent);

		// Need to set rendered text content for 1st cell
		setRenderedTextContent(0);

		let notebookFindModel = new NotebookFindModel(model);

		await notebookFindModel.find('trace', false, false, max_find_count);
		assert.strictEqual(notebookFindModel.findMatches.length, 2, 'Find failed on code cell and its output');

		await notebookFindModel.find('hello', false, false, max_find_count);
		assert.strictEqual(notebookFindModel.findMatches.length, 3, 'Find failed on code cell output');
	});

	test('Should find results in the output of the code cell when output is executeResult', async function (): Promise<void> {
		let codeCellOutput: nb.IExecuteResult = {
			output_type: 'execute_result',
			execution_count: null,
			data: {
				'application/vnd.dataresource+json': {
					'schema': {
						'fields': [
							{
								'name': 'ContactTypeID'
							},
							{
								'name': 'Name'
							},
							{
								'name': 'ModifiedDate'
							}
						]
					},
					'data': [
						{
							'0': '1',
							'1': 'Accounting Manager',
							'2': '2008-04-30 00:00:00.000'
						},
						{
							'0': '2',
							'1': 'Assistant Sales Agent',
							'2': '2008-04-30 00:00:00.000'
						},
						{
							'0': '3',
							'1': 'Assistant Sales Representative',
							'2': '2008-04-30 00:00:00.000'
						},
						{
							'0': '4',
							'1': 'Coordinator Foreign Markets',
							'2': '2008-04-30 00:00:00.000'
						},
						{
							'0': '5',
							'1': 'Export Administrator',
							'2': '2008-04-30 00:00:00.000'
						},
						{
							'0': '6',
							'1': 'International Marketing Manager',
							'2': '2008-04-30 00:00:00.000'
						},
						{
							'0': '7',
							'1': 'Marketing Assistant',
							'2': '2008-04-30 00:00:00.000'
						},
						{
							'0': '8',
							'1': 'Marketing Manager',
							'2': '2008-04-30 00:00:00.000'
						},
						{
							'0': '9',
							'1': 'Marketing Representative',
							'2': '2008-04-30 00:00:00.000'
						},
						{
							'0': '10',
							'1': 'Order Administrator',
							'2': '2008-04-30 00:00:00.000'
						}
					]
				}
			}
		};
		let cellContent: nb.INotebookContents = {
			cells: [
				{
					cell_type: 'code',
					source: [
						'Select top 10 * from Person.ContactType\n', ' -- Assistant'
					],
					metadata: { language: 'sql' },
					outputs: [
						codeCellOutput
					],
					execution_count: 1
				}],
			metadata: {
				kernelspec: {
					name: 'mssql',
					language: 'sql',
					display_name: 'SQL'
				}
			},
			nbformat: 4,
			nbformat_minor: NBFORMAT_MINOR
		};
		max_find_count = 4;
		await initNotebookModel(cellContent);

		// Need to set rendered text content for 1st cell
		setRenderedTextContent(0);

		let notebookFindModel = new NotebookFindModel(model);
		await notebookFindModel.find('Assistant', false, false, max_find_count);

		assert.strictEqual(notebookFindModel.getFindCount(), 4, 'Find failed on executed code cell output');
	});


	test('Find next/previous should return the correct find index', async function (): Promise<void> {
		// Need to set rendered text content for 2nd cell
		setRenderedTextContent(1);

		//initialize find
		let notebookFindModel = new NotebookFindModel(model);
		await notebookFindModel.find('insert', false, false, max_find_count);

		assert.strictEqual(notebookFindModel.getFindIndex(), 1, 'Failed to get the correct find index');

		notebookFindModel.findNext();
		assert.strictEqual(notebookFindModel.getFindIndex(), 2, 'Failed to get the correct find index');

		notebookFindModel.findPrevious();
		assert.strictEqual(notebookFindModel.getFindIndex(), 1, 'Failed to get the correct find index');
	});

	test('Should clear results on clear', async function (): Promise<void> {
		// Need to set rendered text content for 2nd cell
		setRenderedTextContent(1);

		//initialize find
		let notebookFindModel = new NotebookFindModel(model);
		await notebookFindModel.find('insert', false, false, max_find_count);

		assert.strictEqual(notebookFindModel.findMatches.length, 3, 'Failed to find all occurrences');

		notebookFindModel.clearFind();
		assert.strictEqual(notebookFindModel.findMatches.length, 0, 'Failed to clear find results');
		assert.strictEqual(notebookFindModel.findDecorations, undefined, 'Failed to clear find decorations on clear');
	});


	async function initNotebookModel(contents: nb.INotebookContents): Promise<void> {
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(contents));
		defaultModelOptions.contentLoader = mockContentManager.object;
		let mockNotebookService = TypeMoq.Mock.ofType(NotebookServiceStub);
		mockNotebookService.setup(s => s.onNotebookKernelsAdded).returns(() => new Emitter<IStandardKernelWithProvider[]>().event);

		// Initialize the model
		model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService, undefined, mockNotebookService.object, undefined, undefined);
		await model.loadContents();
		await model.requestModelLoad();
	}

	function setRenderedTextContent(cellIndex: number): void {
		model.cells[cellIndex].renderedOutputTextContent = [markdownRenderer.render({
			isTrusted: true,
			value: model.cells[cellIndex].source[0]
		}).element.innerText.toString()];
	}
});
