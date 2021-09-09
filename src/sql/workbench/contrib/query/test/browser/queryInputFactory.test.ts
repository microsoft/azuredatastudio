/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as sinon from 'sinon';
import { ITestInstantiationService, TestEditorService } from 'vs/workbench/test/browser/workbenchTestServices';
import { URI } from 'vs/base/common/uri';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IEditorInput } from 'vs/workbench/common/editor';
import { FileEditorInput } from 'vs/workbench/contrib/files/browser/editors/fileEditorInput';
import { workbenchInstantiationService } from 'sql/workbench/test/workbenchTestServices';
import { QueryEditorLanguageAssociation } from 'sql/workbench/contrib/query/browser/queryInputFactory';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { TestObjectExplorerService } from 'sql/workbench/services/objectExplorer/test/browser/testObjectExplorerService';
import { TestConnectionManagementService } from 'sql/platform/connection/test/common/testConnectionManagementService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IConnectionManagementService, IConnectionCompletionOptions, IConnectionCallbacks, IConnectionResult } from 'sql/platform/connection/common/connectionManagement';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { UntitledQueryEditorInput } from 'sql/base/query/browser/untitledQueryEditorInput';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { IUntitledTextEditorService } from 'vs/workbench/services/untitled/common/untitledTextEditorService';
import { isThenable } from 'vs/base/common/async';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { QueryResultsInput } from 'sql/workbench/common/editor/query/queryResultsInput';
import { extUri } from 'vs/base/common/resources';
import { IResourceEditorInputIdentifier } from 'vs/platform/editor/common/editor';

suite('Query Input Factory', () => {
	let instantiationService: ITestInstantiationService;

	function createFileInput(resource: URI, preferredResource?: URI, preferredMode?: string, preferredName?: string, preferredDescription?: string): FileEditorInput {
		return instantiationService.createInstance(FileEditorInput, resource, preferredResource, preferredName, preferredDescription, undefined, preferredMode, undefined);
	}

	test('sync query editor input is connected if global connection exists (OE)', async () => {
		const editorService = new MockEditorService();
		instantiationService = workbenchInstantiationService();
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IObjectExplorerService, new MockObjectExplorerService());
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input = createFileInput(URI.file('/test/file.sql'), undefined, undefined, undefined);
		await queryEditorLanguageAssociation.convertInput(input);
		assert(connectionManagementService.numberConnects === 1, 'Convert input should have called connect when active OE connection exists');
	});

	test('query editor input is connected if global connection exists (OE)', async () => {
		const editorService = new MockEditorService();
		instantiationService = workbenchInstantiationService();
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IObjectExplorerService, new MockObjectExplorerService());
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input = createFileInput(URI.file('/test/file.sql'), undefined, undefined, undefined);
		const response = queryEditorLanguageAssociation.convertInput(input);
		assert(isThenable(response));
		await response;
		assert(connectionManagementService.numberConnects === 1, 'Convert input should have called connect when active OE connection exists');
	});

	test('sync query editor input is connected if global connection exists (Editor)', () => {
		instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService(instantiationService);
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IObjectExplorerService, new MockObjectExplorerService());
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input = createFileInput(URI.file('/test/file.sql'), undefined, undefined, undefined);
		queryEditorLanguageAssociation.convertInput(input);
		assert(connectionManagementService.numberConnects === 1, 'Convert input should have called connect when active editor connection exists');
	});

	test('query editor input is connected if global connection exists (Editor)', async () => {
		instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService(instantiationService);
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IObjectExplorerService, new MockObjectExplorerService());
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input = createFileInput(URI.file('/test/file.sql'), undefined, undefined, undefined);
		const response = queryEditorLanguageAssociation.convertInput(input);
		assert(isThenable(response));
		await response;
		assert(connectionManagementService.numberConnects === 1, 'Convert input should have called connect when active editor connection exists');
	});

	test('untitled query editor input is connected if global connection exists (Editor)', async () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService(instantiationService);
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IObjectExplorerService, new MockObjectExplorerService());
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const untitledService = instantiationService.invokeFunction(accessor => accessor.get(IUntitledTextEditorService));
		const queryeditorservice = instantiationService.invokeFunction(accessor => accessor.get(IQueryEditorService));
		const newsqlEditorStub = sinon.stub(queryeditorservice, 'newSqlEditor').callsFake(() => {
			const untitledInput = instantiationService.createInstance(UntitledTextEditorInput, untitledService.create());
			const queryResultsInput: QueryResultsInput = instantiationService.createInstance(QueryResultsInput, untitledInput.resource.toString());
			let queryInput = instantiationService.createInstance(UntitledQueryEditorInput, '', untitledInput, queryResultsInput);
			return Promise.resolve(queryInput);
		});
		const input = instantiationService.createInstance(UntitledTextEditorInput, untitledService.create());
		const response = queryEditorLanguageAssociation.convertInput(input);
		assert(isThenable(response));
		await response;
		assert(newsqlEditorStub.calledWithExactly({ resource: undefined, open: false, initalContent: '' }));
		assert(connectionManagementService.numberConnects === 1, 'Convert input should have called connect when active editor connection exists');
	});

	test('sync query editor input is not connected if no global connection exists', () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService();
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input = createFileInput(URI.file('/test/file.sql'), undefined, undefined, undefined);
		queryEditorLanguageAssociation.syncConvertInput(input);
		assert(connectionManagementService.numberConnects === 0, 'Convert input should not have been called connect when no global connections exist');
	});

	test('async query editor input is not connected if no global connection exists', async () => {
		instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService();
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input = createFileInput(URI.file('/test/file.sql'), undefined, undefined, undefined);
		const response = queryEditorLanguageAssociation.convertInput(input);
		assert(isThenable(response));
		await response;
		assert(connectionManagementService.numberConnects === 0, 'Convert input should not have been called connect when no global connections exist');
	});

	test('sync query editor input can only be connected once when global connection exists', () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService();
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IObjectExplorerService, new MockObjectExplorerService());
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input1 = createFileInput(URI.file('/test/file.sql'), undefined, undefined, undefined);
		const input2 = createFileInput(URI.file('/test/file.sql'), undefined, undefined, undefined);
		queryEditorLanguageAssociation.syncConvertInput(input1);
		queryEditorLanguageAssociation.syncConvertInput(input2);
		let connProfile = connectionManagementService.getConnectionProfile('file:///test/file.sql');
		assert(connProfile !== undefined, 'connection profile should not be undefined');
		assert(connProfile.azureResourceId === 'file:///test/file.sql', 'azureResourceId should not be undefined');
		assert(connectionManagementService.numberConnects === 1, 'Convert input should have called connect when active OE connection exists');
	});

	test('sync query editor inputs can be connected one after the other when global connection exists', () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService();
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IObjectExplorerService, new MockObjectExplorerService());
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input1 = createFileInput(URI.file('/test/file1.sql'), undefined, undefined, undefined);
		const input2 = createFileInput(URI.file('/test/file2.sql'), undefined, undefined, undefined);
		queryEditorLanguageAssociation.syncConvertInput(input1);
		queryEditorLanguageAssociation.syncConvertInput(input2);
		let connProfile1 = connectionManagementService.getConnectionProfile('file:///test/file1.sql');
		assert(connProfile1 !== undefined, 'connection profile should not be undefined');
		assert(connProfile1.azureResourceId === 'file:///test/file1.sql', 'azureResourceId should not be undefined');
		let connProfile2 = connectionManagementService.getConnectionProfile('file:///test/file2.sql');
		assert(connProfile2 !== undefined, 'connection profile should not be undefined');
		assert(connProfile2.azureResourceId === 'file:///test/file2.sql', 'azureResourceId should not be undefined');
		assert(connectionManagementService.numberConnects === 2, 'Convert input should have called connect two times when active OE connection exists and we have two inputs');
	});

	test('query editor input can only be connected once when global connection exists (OE)', async () => {
		const editorService = new MockEditorService();
		instantiationService = workbenchInstantiationService();
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IObjectExplorerService, new MockObjectExplorerService());
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input1 = createFileInput(URI.file('/test/file.sql'), undefined, undefined, undefined);
		const input2 = createFileInput(URI.file('/test/file.sql'), undefined, undefined, undefined);
		const response1 = queryEditorLanguageAssociation.convertInput(input1);
		assert(isThenable(response1));
		await response1;
		const response2 = queryEditorLanguageAssociation.convertInput(input2);
		assert(isThenable(response2));
		await response2;
		let connProfile = connectionManagementService.getConnectionProfile('file:///test/file.sql');
		assert(connProfile !== undefined, 'connection profile should not be undefined');
		assert(connProfile.azureResourceId === 'file:///test/file.sql', 'azureResourceId should not be undefined');
		assert(connectionManagementService.numberConnects === 1, 'Convert input should have called connect when active OE connection exists');
	});

	test('sync query editor input can only be connected once when global connection exists (OE)', async () => {
		const editorService = new MockEditorService();
		instantiationService = workbenchInstantiationService();
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IObjectExplorerService, new MockObjectExplorerService());
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input1 = createFileInput(URI.file('/test/file.sql'), undefined, undefined, undefined);
		const input2 = createFileInput(URI.file('/test/file.sql'), undefined, undefined, undefined);
		await queryEditorLanguageAssociation.convertInput(input1);
		await queryEditorLanguageAssociation.convertInput(input2);
		let connProfile = connectionManagementService.getConnectionProfile('file:///test/file.sql');
		assert(connProfile !== undefined, 'connection profile should not be undefined');
		assert(connProfile.azureResourceId === 'file:///test/file.sql', 'azureResourceId should not be undefined');
		assert(connectionManagementService.numberConnects === 1, 'Convert input should have called connect only once when active OE connection exists');
	});

	test('sync query editor inputs can be connected one after the other when global connection exists (OE)', async () => {
		const editorService = new MockEditorService();
		instantiationService = workbenchInstantiationService();
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IObjectExplorerService, new MockObjectExplorerService());
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input1 = createFileInput(URI.file('/test/file1.sql'), undefined, undefined, undefined);
		const input2 = createFileInput(URI.file('/test/file2.sql'), undefined, undefined, undefined);
		await queryEditorLanguageAssociation.convertInput(input1);
		await queryEditorLanguageAssociation.convertInput(input2);
		let connProfile1 = connectionManagementService.getConnectionProfile('file:///test/file1.sql');
		assert(connProfile1 !== undefined, 'connection profile should not be undefined');
		assert(connProfile1.azureResourceId === 'file:///test/file1.sql', 'azureResourceId should not be undefined');
		let connProfile2 = connectionManagementService.getConnectionProfile('file:///test/file2.sql');
		assert(connProfile2 !== undefined, 'connection profile should not be undefined');
		assert(connProfile2.azureResourceId === 'file:///test/file2.sql', 'azureResourceId should not be undefined');
		assert(connectionManagementService.numberConnects === 2, 'Convert input should have called connect two times when active OE connection exists and we have two inputs');
	});

	test('query editor input can be connected one after the other when global connection exists (OE)', async () => {
		const editorService = new MockEditorService();
		instantiationService = workbenchInstantiationService();
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IObjectExplorerService, new MockObjectExplorerService());
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input1 = createFileInput(URI.file('/test/file1.sql'), undefined, undefined, undefined);
		const input2 = createFileInput(URI.file('/test/file2.sql'), undefined, undefined, undefined);
		const response1 = queryEditorLanguageAssociation.convertInput(input1);
		assert(isThenable(response1));
		await response1;
		const response2 = queryEditorLanguageAssociation.convertInput(input2);
		assert(isThenable(response2));
		await response2;
		let connProfile1 = connectionManagementService.getConnectionProfile('file:///test/file1.sql');
		assert(connProfile1 !== undefined, 'connection profile should not be undefined');
		assert(connProfile1.azureResourceId === 'file:///test/file1.sql', 'azureResourceId should not be undefined');
		let connProfile2 = connectionManagementService.getConnectionProfile('file:///test/file2.sql');
		assert(connProfile2 !== undefined, 'connection profile should not be undefined');
		assert(connProfile2.azureResourceId === 'file:///test/file2.sql', 'azureResourceId should not be undefined');
		assert(connectionManagementService.numberConnects === 2, 'Convert input should have called connect two times when active OE connection exists and we have two inputs');
	});

	test('sync query editor input can only be connected once when global connection exists (Editor)', () => {
		instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService(instantiationService);
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IObjectExplorerService, new MockObjectExplorerService());
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input1 = createFileInput(URI.file('/test/file.sql'), undefined, undefined, undefined);
		const input2 = createFileInput(URI.file('/test/file.sql'), undefined, undefined, undefined);
		queryEditorLanguageAssociation.convertInput(input1);
		queryEditorLanguageAssociation.convertInput(input2);
		let connProfile = connectionManagementService.getConnectionProfile('file:///test/file.sql');
		assert(connProfile !== undefined, 'connection profile should not be undefined');
		assert(connProfile.azureResourceId === 'file:///test/file.sql', 'azureResourceId should not be undefined');
		assert(connectionManagementService.numberConnects === 1, 'Convert input should have called connect when active editor connection exists');
	});

	test('query editor input can only be connected once when global connection exists (Editor)', async () => {
		instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService(instantiationService);
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IObjectExplorerService, new MockObjectExplorerService());
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input1 = createFileInput(URI.file('/test/file.sql'), undefined, undefined, undefined);
		const input2 = createFileInput(URI.file('/test/file.sql'), undefined, undefined, undefined);
		const response1 = queryEditorLanguageAssociation.convertInput(input1);
		assert(isThenable(response1));
		await response1;
		const response2 = queryEditorLanguageAssociation.convertInput(input2);
		assert(isThenable(response2));
		await response2;
		let connProfile = connectionManagementService.getConnectionProfile('file:///test/file.sql');
		assert(connProfile !== undefined, 'connection profile should not be undefined');
		assert(connProfile.azureResourceId === 'file:///test/file.sql', 'azureResourceId should not be undefined');
		assert(connectionManagementService.numberConnects === 1, 'Convert input should have called connect when active editor connection exists');
	});

	test('sync query editor input can be connected one after the other when global connection exists (Editor)', () => {
		instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService(instantiationService);
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IObjectExplorerService, new MockObjectExplorerService());
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input1 = createFileInput(URI.file('/test/file1.sql'), undefined, undefined, undefined);
		const input2 = createFileInput(URI.file('/test/file2.sql'), undefined, undefined, undefined);
		queryEditorLanguageAssociation.convertInput(input1);
		queryEditorLanguageAssociation.convertInput(input2);
		let connProfile1 = connectionManagementService.getConnectionProfile('file:///test/file1.sql');
		assert(connProfile1 !== undefined, 'connection profile should not be undefined');
		assert(connProfile1.azureResourceId === 'file:///test/file1.sql', 'azureResourceId should not be undefined');
		let connProfile2 = connectionManagementService.getConnectionProfile('file:///test/file2.sql');
		assert(connProfile2 !== undefined, 'connection profile should not be undefined');
		assert(connProfile2.azureResourceId === 'file:///test/file2.sql', 'azureResourceId should not be undefined');
		assert(connectionManagementService.numberConnects === 2, 'Convert input should have called connect two times when active editor connection exists and we have two inputs');
	});

	test('query editor input can be connected one after the other when global connection exists (Editor)', async () => {
		instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService(instantiationService);
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IObjectExplorerService, new MockObjectExplorerService());
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input1 = createFileInput(URI.file('/test/file1.sql'), undefined, undefined, undefined);
		const input2 = createFileInput(URI.file('/test/file2.sql'), undefined, undefined, undefined);
		const response1 = queryEditorLanguageAssociation.convertInput(input1);
		assert(isThenable(response1));
		await response1;
		const response2 = queryEditorLanguageAssociation.convertInput(input2);
		assert(isThenable(response2));
		await response2;
		let connProfile1 = connectionManagementService.getConnectionProfile('file:///test/file1.sql');
		assert(connProfile1 !== undefined, 'connection profile should not be undefined');
		assert(connProfile1.azureResourceId === 'file:///test/file1.sql', 'azureResourceId should not be undefined');
		let connProfile2 = connectionManagementService.getConnectionProfile('file:///test/file2.sql');
		assert(connProfile2 !== undefined, 'connection profile should not be undefined');
		assert(connProfile2.azureResourceId === 'file:///test/file2.sql', 'azureResourceId should not be undefined');
		assert(connectionManagementService.numberConnects === 2, 'Convert input should have called connect two times when active editor connection exists and we have two inputs');
	});

	test('uses existing resource if provided', async () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService(instantiationService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const untitledService = instantiationService.invokeFunction(accessor => accessor.get(IUntitledTextEditorService));
		const queryeditorservice = instantiationService.invokeFunction(accessor => accessor.get(IQueryEditorService));
		const input = instantiationService.createInstance(UntitledTextEditorInput, untitledService.create());
		sinon.stub(editorService, 'isOpened').callsFake((editor: IResourceEditorInputIdentifier) => extUri.isEqual(editor.resource, input.resource));
		const newsqlEditorStub = sinon.stub(queryeditorservice, 'newSqlEditor').callsFake(() => {
			const untitledInput = instantiationService.createInstance(UntitledTextEditorInput, untitledService.create());
			const queryResultsInput: QueryResultsInput = instantiationService.createInstance(QueryResultsInput, untitledInput.resource.toString());
			let queryInput = instantiationService.createInstance(UntitledQueryEditorInput, '', untitledInput, queryResultsInput);
			return Promise.resolve(queryInput);
		});
		const response = queryEditorLanguageAssociation.convertInput(input);
		assert(isThenable(response));
		await response;
		assert(newsqlEditorStub.calledWithExactly({ resource: input.resource, open: false, initalContent: '' }));
	});

});

class ServiceAccessor {
	constructor(
		@IUntitledTextEditorService public readonly untitledTextEditorService: IUntitledTextEditorService
	) { }
}

class MockEditorService extends TestEditorService {
	private __activeEditor: IEditorInput | undefined = undefined;
	public override get activeEditor(): IEditorInput | undefined {
		return this.__activeEditor;
	}

	constructor(instantiationService?: IInstantiationService) {
		super();
		if (instantiationService) {
			const workbenchinstantiationService = workbenchInstantiationService();
			const accessor = workbenchinstantiationService.createInstance(ServiceAccessor);
			const service = accessor.untitledTextEditorService;
			const untitledInput = instantiationService.createInstance(UntitledTextEditorInput, service.create({ associatedResource: URI.file('/test/file') }));
			this.__activeEditor = instantiationService.createInstance(UntitledQueryEditorInput, '', untitledInput, undefined);
		}
	}
}

class MockObjectExplorerService extends TestObjectExplorerService {
	public override getSelectedProfileAndDatabase(): { profile: ConnectionProfile, databaseName: string } {
		return {
			profile: <ConnectionProfile>{}, // Not actually used so fine to cast
			databaseName: ''
		};
	}

	public override isFocused(): boolean {
		return true;
	}
}

class MockConnectionManagementService extends TestConnectionManagementService {

	public numberConnects = 0;

	public connectionProfiles = [];

	public override isProfileConnected(connectionProfile: IConnectionProfile): boolean {
		return true;
	}

	public override connect(connection: IConnectionProfile, uri: string, options?: IConnectionCompletionOptions, callbacks?: IConnectionCallbacks): Promise<IConnectionResult> {
		this.numberConnects++;
		this.connectionProfiles.push(uri);
		return Promise.resolve(undefined);
	}

	public override getConnectionProfile(fileUri: string): IConnectionProfile {
		let element = this.connectionProfiles.find(element => fileUri === element);
		if (element) {
			return <IConnectionProfile>{ azureResourceId: element };
		}
		else {
			return undefined;
		}
	}
}
