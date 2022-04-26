/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as sinon from 'sinon';
import { setMode } from 'sql/workbench/browser/parts/editor/editorStatusModeSelect';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { QueryEditorLanguageAssociation } from 'sql/workbench/contrib/query/browser/queryEditorFactory';
import { NotebookEditorLanguageAssociation } from 'sql/workbench/contrib/notebook/browser/models/notebookEditorFactory';
import { workbenchInstantiationService } from 'sql/workbench/test/workbenchTestServices';
import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { Registry } from 'vs/platform/registry/common/platform';
import { ILanguageAssociationRegistry, Extensions as LanguageAssociationExtensions } from 'sql/workbench/services/languageAssociation/common/languageAssociation';
import { TestQueryEditorService } from 'sql/workbench/services/queryEditor/test/browser/testQueryEditorService';
import { ITestInstantiationService, TestEditorService } from 'vs/workbench/test/browser/workbenchTestServices';
import { NotebookServiceStub } from 'sql/workbench/contrib/notebook/test/stubs';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IUntitledTextResourceEditorInput, IVisibleEditorPane } from 'vs/workbench/common/editor';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { IUntitledTextEditorService } from 'vs/workbench/services/untitled/common/untitledTextEditorService';
import { FileEditorInput } from 'vs/workbench/contrib/files/browser/editors/fileEditorInput';
import { URI } from 'vs/base/common/uri';
import { FileQueryEditorInput } from 'sql/workbench/contrib/query/browser/fileQueryEditorInput';
import { QueryResultsInput } from 'sql/workbench/common/editor/query/queryResultsInput';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { EditorType } from 'vs/editor/common/editorCommon';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';

const languageAssociations = Registry.as<ILanguageAssociationRegistry>(LanguageAssociationExtensions.LanguageAssociations);

suite('set mode', () => {
	let instantiationService: ITestInstantiationService;
	let disposables: IDisposable[] = [];

	function createFileInput(resource: URI, preferredResource?: URI, preferredMode?: string, preferredName?: string, preferredDescription?: string): FileEditorInput {
		return instantiationService.createInstance(FileEditorInput, resource, preferredResource, preferredName, preferredDescription, undefined, preferredMode, undefined);
	}

	setup(() => {
		disposables.push(languageAssociations.registerLanguageAssociation(QueryEditorLanguageAssociation.languages, QueryEditorLanguageAssociation, QueryEditorLanguageAssociation.isDefault));
		disposables.push(languageAssociations.registerLanguageAssociation(NotebookEditorLanguageAssociation.languages, NotebookEditorLanguageAssociation));
		instantiationService = workbenchInstantiationService();
		instantiationService.stub(INotebookService, new NotebookServiceStub());
		const editorService = new MockEditorService(instantiationService);
		instantiationService.stub(IEditorService, editorService);
		instantiationService.stub(IQueryEditorService, instantiationService.createInstance(TestQueryEditorService));
		instantiationService.invokeFunction(accessor => {
			languageAssociations.start(accessor);
		});
	});

	teardown(() => {
		disposables = dispose(disposables);
	});

	test('does leave editor alone and change mode when changed from plaintext to json', async () => {
		const editorService = new MockEditorService(instantiationService, 'plaintext');
		instantiationService.stub(IEditorService, editorService);
		const replaceEditorStub = sinon.stub(editorService, 'replaceEditors').callsFake(() => Promise.resolve());
		const stub = sinon.stub();
		const modeSupport = { setMode: stub };
		const activeEditor = createFileInput(URI.file('/test/file.txt'), undefined, 'plaintext', undefined);
		await instantiationService.invokeFunction(setMode, modeSupport, activeEditor, 'json');
		assert(stub.calledOnce);
		assert(stub.calledWithExactly('json'));
		assert(replaceEditorStub.notCalled);
	});

	test('does replace editor and set mode correctly when changed from sql to notebooks', async () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService(instantiationService, 'sql');
		instantiationService.stub(IEditorService, editorService);
		const stub = sinon.stub();
		const modeSupport = { setMode: stub };
		const uri = URI.file('/test/file.sql');
		const textInput = createFileInput(uri, undefined, 'sql', undefined);
		const activeEditor = instantiationService.createInstance(FileQueryEditorInput, '', textInput, instantiationService.createInstance(QueryResultsInput, uri.toString()));
		await instantiationService.invokeFunction(setMode, modeSupport, activeEditor, 'notebooks');
		assert(stub.calledOnce);
		assert(stub.calledWithExactly('notebooks'));
	});

	test('does replace editor and set mode correctly when changed from sql to plaintext', async () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService(instantiationService, 'sql');
		instantiationService.stub(IEditorService, editorService);
		const stub = sinon.stub();
		const modeSupport = { setMode: stub };
		const uri = URI.file('/test/file.sql');
		const textInput = createFileInput(uri, undefined, 'sql', undefined);
		const activeEditor = instantiationService.createInstance(FileQueryEditorInput, '', textInput, instantiationService.createInstance(QueryResultsInput, uri.toString()));
		await instantiationService.invokeFunction(setMode, modeSupport, activeEditor, 'plaintext');
		assert(stub.calledOnce);
		assert(stub.calledWithExactly('plaintext'));
	});

	test('does replace editor and set mode correctly when changed from plaintext to sql', async () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService(instantiationService, 'plaintext');
		instantiationService.stub(IEditorService, editorService);
		const stub = sinon.stub();
		const modeSupport = { setMode: stub };
		const activeEditor = createFileInput(URI.file('/test/file.txt'), undefined, 'plaintext', undefined);
		await instantiationService.invokeFunction(setMode, modeSupport, activeEditor, 'sql');
		assert(stub.calledOnce);
		assert(stub.calledWithExactly('sql'));
	});

	test('does show error if mode change happens on a dirty file', async () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService(instantiationService, 'plaintext');
		const errorStub = sinon.stub();
		instantiationService.stub(IEditorService, editorService);
		instantiationService.stub(INotificationService, TestNotificationService);
		(instantiationService as TestInstantiationService).stub(INotificationService, 'error', errorStub);
		const stub = sinon.stub();
		const modeSupport = { setMode: stub };
		const activeEditor = createFileInput(URI.file('/test/file.txt'), undefined, 'plaintext', undefined);
		sinon.stub(activeEditor, 'isDirty').callsFake(() => true);
		await instantiationService.invokeFunction(setMode, modeSupport, activeEditor, 'sql');
		assert(stub.notCalled);
		assert(errorStub.calledOnce);
	});
});


class MockEditorService extends TestEditorService {

	constructor(private readonly instantiationService: IInstantiationService, private readonly mode?: string) {
		super();
	}

	override activeEditorPane: IVisibleEditorPane = <any>{
		group: {}
	};

	override get activeTextEditorControl(): ICodeEditor {
		return {
			getModel: () => {
				return <any>{
					getLanguageIdentifier: () => {
						return { language: this.mode };
					}
				};
			},
			getEditorType: () => EditorType.ICodeEditor
		} as any;
	}

	override openEditor(_editor: any, _options?: any, _group?: any): Promise<any> {
		return Promise.resolve(_editor);
	}

	override createEditorInput(_input: IUntitledTextResourceEditorInput): EditorInput {
		const accessor = this.instantiationService.createInstance(ServiceAccessor);
		const service = accessor.untitledTextEditorService;
		return this.instantiationService.createInstance(UntitledTextEditorInput, service.create());
	}
}

class ServiceAccessor {
	constructor(
		@IUntitledTextEditorService public readonly untitledTextEditorService: IUntitledTextEditorService
	) { }
}
