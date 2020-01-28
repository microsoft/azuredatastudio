/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { EditorReplacementContribution } from 'sql/workbench/common/editorReplacerContribution';
import { TestEditorService } from 'vs/workbench/test/workbenchTestServices';
import { IModeService, ILanguageSelection } from 'vs/editor/common/services/modeService';
import { Event } from 'vs/base/common/event';
import { IMode, LanguageId, LanguageIdentifier } from 'vs/editor/common/modes';
import { URI } from 'vs/base/common/uri';
import { IOpenEditorOverrideHandler, IOpenEditorOverride, IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IDisposable, toDisposable, dispose } from 'vs/base/common/lifecycle';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { IEditorInput, EditorInput } from 'vs/workbench/common/editor';
import { ITextEditorOptions, IEditorOptions } from 'vs/platform/editor/common/editor';
import { IEditorGroup } from 'vs/workbench/services/editor/common/editorGroupsService';
import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { QueryEditorInput } from 'sql/workbench/contrib/query/common/queryEditorInput';
import { Registry } from 'vs/platform/registry/common/platform';
import { ILanguageAssociationRegistry, Extensions as LanguageAssociationExtensions } from 'sql/workbench/common/languageAssociation';
import { QueryEditorLanguageAssociation } from 'sql/workbench/contrib/query/common/queryInputFactory';
import { workbenchInstantiationService } from 'sql/workbench/test/workbenchTestServices';
import { NotebookEditorInputAssociation } from 'sql/workbench/contrib/notebook/common/models/nodebookInputFactory';
import { NotebookInput } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';
import { UntitledTextEditorInput } from 'vs/workbench/common/editor/untitledTextEditorInput';
import { UntitledQueryEditorInput } from 'sql/workbench/contrib/query/common/untitledQueryEditorInput';
import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { NotebookServiceStub } from 'sql/workbench/contrib/notebook/test/stubs';

const languageAssociations = Registry.as<ILanguageAssociationRegistry>(LanguageAssociationExtensions.LanguageAssociations);

suite('Editor Replacer Contribution', () => {
	let disposables: IDisposable[] = [];

	setup(() => {
		disposables.push(languageAssociations.registerLanguageAssociation(QueryEditorLanguageAssociation.languages, QueryEditorLanguageAssociation, QueryEditorLanguageAssociation.isDefault));
		disposables.push(languageAssociations.registerLanguageAssociation(NotebookEditorInputAssociation.languages, NotebookEditorInputAssociation));
		const instantiationService = workbenchInstantiationService();
		instantiationService.stub(INotebookService, new NotebookServiceStub());
		instantiationService.invokeFunction(accessor => {
			languageAssociations.start(accessor);
		});
	});

	teardown(() => {
		disposables = dispose(disposables);
	});

	test('does proper lifecycle', () => {
		const editorService = new MockEditorService();
		const modeService = new TestModeService();
		const contrib = new EditorReplacementContribution(editorService, modeService);
		assert.equal(editorService.overridenOpens.length, 1);
		contrib.dispose();
		assert.equal(editorService.overridenOpens.length, 0);
	});

	test('does replace sql file input from uri (no mode service)', async () => {
		const editorService = new MockEditorService();
		const instantiationService = workbenchInstantiationService();
		instantiationService.stub(IEditorService, editorService);
		const contrib = instantiationService.createInstance(EditorReplacementContribution);
		const input = instantiationService.createInstance(FileEditorInput, URI.file('/test/file.sql'), undefined, undefined);
		const response = editorService.fireOpenEditor(input, undefined, undefined as IEditorGroup);
		assert(response?.override);
		const newinput = <any>(await response.override) as EditorInput; // our test service returns this so we are fine to cast this

		assert(newinput instanceof QueryEditorInput);

		contrib.dispose();
	});

	test('does replace sql file input using input mode', async () => {
		const editorService = new MockEditorService();
		const instantiationService = workbenchInstantiationService();
		instantiationService.stub(IEditorService, editorService);
		const contrib = instantiationService.createInstance(EditorReplacementContribution);
		const input = instantiationService.createInstance(FileEditorInput, URI.file('/test/file.other'), undefined, 'sql');
		const response = editorService.fireOpenEditor(input, undefined, undefined as IEditorGroup);
		assert(response?.override);
		const newinput = <any>(await response.override) as EditorInput; // our test service returns this so we are fine to cast this

		assert(newinput instanceof QueryEditorInput);

		contrib.dispose();
	});

	test('does replace notebook file input using input mode', async () => {
		const editorService = new MockEditorService();
		const instantiationService = workbenchInstantiationService();
		instantiationService.stub(IEditorService, editorService);
		const contrib = instantiationService.createInstance(EditorReplacementContribution);
		const input = instantiationService.createInstance(FileEditorInput, URI.file('/test/file.notebook'), undefined, undefined);
		const response = editorService.fireOpenEditor(input, undefined, undefined as IEditorGroup);
		assert(response?.override);
		const newinput = <any>(await response.override) as EditorInput; // our test service returns this so we are fine to cast this

		assert(newinput instanceof NotebookInput);

		contrib.dispose();
	});

	test('does replace notebook file input using input mode', async () => {
		const editorService = new MockEditorService();
		const instantiationService = workbenchInstantiationService();
		instantiationService.stub(IEditorService, editorService);
		const contrib = instantiationService.createInstance(EditorReplacementContribution);
		const input = instantiationService.createInstance(FileEditorInput, URI.file('/test/file.iynb'), undefined, 'notebook');
		const response = editorService.fireOpenEditor(input, undefined, undefined as IEditorGroup);
		assert(response?.override);
		const newinput = <any>(await response.override) as EditorInput; // our test service returns this so we are fine to cast this

		assert(newinput instanceof NotebookInput);

		contrib.dispose();
	});

	test('does replace notebook file input using input mode', async () => {
		const editorService = new MockEditorService();
		const instantiationService = workbenchInstantiationService();
		instantiationService.stub(IEditorService, editorService);
		const contrib = instantiationService.createInstance(EditorReplacementContribution);
		const input = instantiationService.createInstance(UntitledTextEditorInput, URI.file('/test/file'), false, undefined, undefined, undefined);
		const response = editorService.fireOpenEditor(input, undefined, undefined as IEditorGroup);
		assert(response?.override);
		const newinput = <any>(await response.override) as EditorInput; // our test service returns this so we are fine to cast this

		assert(newinput instanceof QueryEditorInput);

		contrib.dispose();
	});

	test('does not replace editors that it shouldnt', async () => {
		const editorService = new MockEditorService();
		const instantiationService = workbenchInstantiationService();
		instantiationService.stub(IEditorService, editorService);
		const contrib = instantiationService.createInstance(EditorReplacementContribution);
		const untitled = instantiationService.createInstance(UntitledTextEditorInput, URI.file('/test/file'), false, undefined, undefined, undefined);
		const input = instantiationService.createInstance(UntitledQueryEditorInput, '', untitled, undefined);
		const response = editorService.fireOpenEditor(input, undefined, undefined as IEditorGroup);
		assert(response === undefined);

		contrib.dispose();
	});

	test('does not replace editors if it doesnt have a replacer', async () => {
		const editorService = new MockEditorService();
		const instantiationService = workbenchInstantiationService();
		instantiationService.stub(IEditorService, editorService);
		const contrib = instantiationService.createInstance(EditorReplacementContribution);
		const input = instantiationService.createInstance(UntitledTextEditorInput, URI.file('/test/file.unknown'), false, undefined, undefined, undefined);
		const response = editorService.fireOpenEditor(input, undefined, undefined as IEditorGroup);
		assert(response === undefined);

		contrib.dispose();
	});
});

class MockEditorService extends TestEditorService {
	readonly overridenOpens: IOpenEditorOverrideHandler[] = [];

	overrideOpenEditor(_handler: IOpenEditorOverrideHandler): IDisposable {
		this.overridenOpens.push(_handler);
		return toDisposable(() => {
			const index = this.overridenOpens.findIndex(v => v === _handler);
			if (!isUndefinedOrNull(index)) {
				this.overridenOpens.splice(index, 1);
			}
		});
	}

	fireOpenEditor(editor: IEditorInput, options: IEditorOptions | ITextEditorOptions | undefined, group: IEditorGroup) {
		for (const handler of this.overridenOpens) {
			let response: IOpenEditorOverride | undefined;
			if (response = handler(editor, options, group)) {
				return response;
			}
		}
		return undefined;
	}

	openEditor(_editor: any, _options?: any, _group?: any): Promise<any> {
		return Promise.resolve(_editor);
	}
}

class TestModeService implements IModeService {
	_serviceBrand: undefined;
	onDidCreateMode: Event<IMode>;

	isRegisteredMode(mimetypeOrModeId: string): boolean {
		throw new Error('Method not implemented.');
	}

	getRegisteredModes(): string[] {
		throw new Error('Method not implemented.');
	}

	getRegisteredLanguageNames(): string[] {
		throw new Error('Method not implemented.');
	}

	getExtensions(alias: string): string[] {
		throw new Error('Method not implemented.');
	}

	getFilenames(alias: string): string[] {
		throw new Error('Method not implemented.');
	}

	getMimeForMode(modeId: string): string {
		throw new Error('Method not implemented.');
	}

	getLanguageName(modeId: string): string {
		throw new Error('Method not implemented.');
	}

	getModeIdForLanguageName(alias: string): string {
		throw new Error('Method not implemented.');
	}

	getModeIdByFilepathOrFirstLine(resource: URI, firstLine?: string): string {
		throw new Error('Method not implemented.');
	}

	getModeId(commaSeparatedMimetypesOrCommaSeparatedIds: string): string {
		throw new Error('Method not implemented.');
	}

	getLanguageIdentifier(modeId: string | LanguageId): LanguageIdentifier {
		throw new Error('Method not implemented.');
	}

	getConfigurationFiles(modeId: string): URI[] {
		throw new Error('Method not implemented.');
	}

	create(commaSeparatedMimetypesOrCommaSeparatedIds: string): ILanguageSelection {
		throw new Error('Method not implemented.');
	}

	createByLanguageName(languageName: string): ILanguageSelection {
		throw new Error('Method not implemented.');
	}

	createByFilepathOrFirstLine(rsource: URI, firstLine?: string): ILanguageSelection {
		throw new Error('Method not implemented.');
	}

	triggerMode(commaSeparatedMimetypesOrCommaSeparatedIds: string): void {
		throw new Error('Method not implemented.');
	}
}
