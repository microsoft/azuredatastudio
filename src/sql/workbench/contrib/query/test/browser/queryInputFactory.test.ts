/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { TestEditorService } from 'vs/workbench/test/workbenchTestServices';
import { URI } from 'vs/base/common/uri';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IEditorInput } from 'vs/workbench/common/editor';
import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { workbenchInstantiationService } from 'sql/workbench/test/workbenchTestServices';
import { QueryEditorLanguageAssociation } from 'sql/workbench/contrib/query/common/queryInputFactory';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { TestObjectExplorerService } from 'sql/workbench/services/objectExplorer/test/browser/testObjectExplorerService';
import { TestConnectionManagementService } from 'sql/platform/connection/test/common/testConnectionManagementService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IConnectionManagementService, IConnectionCompletionOptions, IConnectionCallbacks, IConnectionResult } from 'sql/platform/connection/common/connectionManagement';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { UntitledQueryEditorInput } from 'sql/workbench/contrib/query/common/untitledQueryEditorInput';
import { UntitledTextEditorInput } from 'vs/workbench/common/editor/untitledTextEditorInput';

suite('Query Input Factory', () => {

	test('query editor input is connected if global connection exists (OE)', () => {
		const editorService = new MockEditorService();
		const instantiationService = workbenchInstantiationService();
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IObjectExplorerService, new MockObjectExplorerService());
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input = instantiationService.createInstance(FileEditorInput, URI.file('/test/file.sql'), undefined, undefined);
		queryEditorLanguageAssociation.convertInput(input);
		assert(connectionManagementService.numberConnects === 1, 'Convert input should have called connect when active OE connection exists');
	});

	test('query editor input is connected if global connection exists (Editor)', () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService(instantiationService);
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IObjectExplorerService, new MockObjectExplorerService());
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input = instantiationService.createInstance(FileEditorInput, URI.file('/test/file.sql'), undefined, undefined);
		queryEditorLanguageAssociation.convertInput(input);
		assert(connectionManagementService.numberConnects === 1, 'Convert input should have called connect when active editor connection exists');
	});

	test('query editor input is not connected if no global connection exists', () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService();
		const connectionManagementService = new MockConnectionManagementService();
		instantiationService.stub(IConnectionManagementService, connectionManagementService);
		instantiationService.stub(IEditorService, editorService);
		const queryEditorLanguageAssociation = instantiationService.createInstance(QueryEditorLanguageAssociation);
		const input = instantiationService.createInstance(FileEditorInput, URI.file('/test/file.sql'), undefined, undefined);
		queryEditorLanguageAssociation.convertInput(input);
		assert(connectionManagementService.numberConnects === 0, 'Convert input should not have been called connect when no global connections exist');
	});

});

class MockEditorService extends TestEditorService {
	public readonly activeEditor: IEditorInput | undefined = undefined;

	constructor(instantiationService?: IInstantiationService) {
		super();
		if (instantiationService) {
			const untitledInput = instantiationService.createInstance(UntitledTextEditorInput, URI.file('/test/file'), false, undefined, undefined, undefined);
			this.activeEditor = instantiationService.createInstance(UntitledQueryEditorInput, '', untitledInput, undefined);
		}
	}
}

class MockObjectExplorerService extends TestObjectExplorerService {
	public getSelectedProfileAndDatabase(): { profile: ConnectionProfile, databaseName: string } {
		return {
			profile: <ConnectionProfile>{}, // Not actually used so fine to cast
			databaseName: ''
		};
	}

	public isFocused(): boolean {
		return true;
	}
}

class MockConnectionManagementService extends TestConnectionManagementService {

	public numberConnects = 0;

	public isProfileConnected(connectionProfile: IConnectionProfile): boolean {
		return true;
	}

	public connect(connection: IConnectionProfile, uri: string, options?: IConnectionCompletionOptions, callbacks?: IConnectionCallbacks): Promise<IConnectionResult> {
		this.numberConnects++;
		return Promise.resolve(undefined);
	}

	public getConnectionProfile(fileUri: string): IConnectionProfile {
		return <IConnectionProfile>{}; // Not actually used so fine to cast
	}
}
