/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { EditorReplacementContribution } from 'sql/workbench/contrib/editorReplacement/common/editorReplacerContribution';
import { TestEditorService } from 'vs/workbench/test/browser/workbenchTestServices';
import { IModeService, ILanguageSelection } from 'vs/editor/common/services/modeService';
import { Event } from 'vs/base/common/event';
import { IMode, LanguageId, LanguageIdentifier } from 'vs/editor/common/modes';
import { URI } from 'vs/base/common/uri';
import { IOpenEditorOverrideHandler, IOpenEditorOverride, IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IDisposable, toDisposable, dispose } from 'vs/base/common/lifecycle';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { IEditorInput, EditorInput, IUntitledTextResourceEditorInput } from 'vs/workbench/common/editor';
import { ITextEditorOptions, IEditorOptions } from 'vs/platform/editor/common/editor';
import { IEditorGroup, OpenEditorContext } from 'vs/workbench/services/editor/common/editorGroupsService';
import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { QueryEditorInput } from 'sql/workbench/common/editor/query/queryEditorInput';
import { Registry } from 'vs/platform/registry/common/platform';
import { ILanguageAssociationRegistry, Extensions as LanguageAssociationExtensions } from 'sql/workbench/services/languageAssociation/common/languageAssociation';
import { QueryEditorLanguageAssociation } from 'sql/workbench/contrib/query/browser/queryInputFactory';
import { workbenchInstantiationService } from 'sql/workbench/test/workbenchTestServices';
import { NotebookEditorInputAssociation } from 'sql/workbench/contrib/notebook/browser/models/nodebookInputFactory';
import { NotebookInput } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { UntitledQueryEditorInput } from 'sql/workbench/common/editor/query/untitledQueryEditorInput';
import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { NotebookServiceStub } from 'sql/workbench/contrib/notebook/test/stubs';
import { IUntitledTextEditorService } from 'vs/workbench/services/untitled/common/untitledTextEditorService';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { TestQueryEditorService } from 'sql/workbench/services/queryEditor/test/common/testQueryEditorService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

const languageAssociations = Registry.as<ILanguageAssociationRegistry>(LanguageAssociationExtensions.LanguageAssociations);


suite('Editor Replacer Contribution', () => {
	let disposables: IDisposable[] = [];

	setup(() => {
		disposables.push(languageAssociations.registerLanguageAssociation(QueryEditorLanguageAssociation.languages, QueryEditorLanguageAssociation, QueryEditorLanguageAssociation.isDefault));
		disposables.push(languageAssociations.registerLanguageAssociation(NotebookEditorInputAssociation.languages, NotebookEditorInputAssociation));
		const instantiationService = workbenchInstantiationService();
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

	test('does proper lifecycle', () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService(instantiationService);
		const modeService = new TestModeService();
		const contrib = new EditorReplacementContribution(editorService, modeService);
		assert.equal(editorService.overridenOpens.length, 1);
		contrib.dispose();
		assert.equal(editorService.overridenOpens.length, 0);
	});

	test('does replace sql file input from uri (no mode service)', async () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService(instantiationService);
		instantiationService.stub(IEditorService, editorService);
		const contrib = instantiationService.createInstance(EditorReplacementContribution);
		const input = instantiationService.createInstance(FileEditorInput, URI.file('/test/file.sql'), undefined, undefined, undefined);
		const response = editorService.fireOpenEditor(input, undefined, undefined as IEditorGroup, OpenEditorContext.NEW_EDITOR);
		assert(response?.override);
		const newinput = <any>(await response.override) as EditorInput; // our test service returns this so we are fine to cast this

		assert(newinput instanceof QueryEditorInput);

		contrib.dispose();
	});

	test('does replace sql file input using input mode', async () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService(instantiationService);
		instantiationService.stub(IEditorService, editorService);
		const contrib = instantiationService.createInstance(EditorReplacementContribution);
		const input = instantiationService.createInstance(FileEditorInput, URI.file('/test/file.other'), undefined, undefined, 'sql');
		const response = editorService.fireOpenEditor(input, undefined, undefined as IEditorGroup, OpenEditorContext.NEW_EDITOR);
		assert(response?.override);
		const newinput = <any>(await response.override) as EditorInput; // our test service returns this so we are fine to cast this

		assert(newinput instanceof QueryEditorInput);

		contrib.dispose();
	});

	test('does replace notebook file input using input extension notebook', async () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService(instantiationService);
		instantiationService.stub(IEditorService, editorService);
		const contrib = instantiationService.createInstance(EditorReplacementContribution);
		const input = instantiationService.createInstance(FileEditorInput, URI.file('/test/file.notebook'), undefined, undefined, undefined);
		const response = editorService.fireOpenEditor(input, undefined, undefined as IEditorGroup, OpenEditorContext.NEW_EDITOR);
		assert(response?.override);
		const newinput = <any>(await response.override) as EditorInput; // our test service returns this so we are fine to cast this

		assert(newinput instanceof NotebookInput);

		contrib.dispose();
	});

	test('does replace notebook file input using input extension iynb', async () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService(instantiationService);
		instantiationService.stub(IEditorService, editorService);
		const contrib = instantiationService.createInstance(EditorReplacementContribution);
		const input = instantiationService.createInstance(FileEditorInput, URI.file('/test/file.iynb'), undefined, undefined, 'notebook');
		const response = editorService.fireOpenEditor(input, undefined, undefined as IEditorGroup, OpenEditorContext.NEW_EDITOR);
		assert(response?.override);
		const newinput = <any>(await response.override) as EditorInput; // our test service returns this so we are fine to cast this

		assert(newinput instanceof NotebookInput);

		contrib.dispose();
	});

	test('does replace file input using default mode', async function () {
		const instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService(instantiationService);
		instantiationService.stub(IEditorService, editorService);
		const contrib = instantiationService.createInstance(EditorReplacementContribution);
		const accessor = instantiationService.createInstance(ServiceAccessor);
		const service = accessor.untitledTextEditorService;

		const input = instantiationService.createInstance(UntitledTextEditorInput, service.create());
		const response = editorService.fireOpenEditor(input, undefined, undefined as IEditorGroup, OpenEditorContext.NEW_EDITOR);
		assert(response?.override);
		const newinput = <any>(await response.override) as EditorInput; // our test service returns this so we are fine to cast this

		assert(newinput instanceof QueryEditorInput);

		contrib.dispose();
	});

	test('does not replace editors that it shouldnt', async () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService(instantiationService);
		instantiationService.stub(IEditorService, editorService);
		const contrib = instantiationService.createInstance(EditorReplacementContribution);
		const accessor = instantiationService.createInstance(ServiceAccessor);
		const service = accessor.untitledTextEditorService;
		const untitled = instantiationService.createInstance(UntitledTextEditorInput, service.create());
		const input = instantiationService.createInstance(UntitledQueryEditorInput, '', untitled, undefined);
		const response = editorService.fireOpenEditor(input, undefined, undefined as IEditorGroup, OpenEditorContext.NEW_EDITOR);
		assert(response === undefined);

		contrib.dispose();
	});

	test('does not replace editors if it doesnt have a replacer', async () => {
		const instantiationService = workbenchInstantiationService();
		const editorService = new MockEditorService(instantiationService);
		instantiationService.stub(IEditorService, editorService);
		const contrib = instantiationService.createInstance(EditorReplacementContribution);
		const accessor = instantiationService.createInstance(ServiceAccessor);
		const service = accessor.untitledTextEditorService;
		const input = instantiationService.createInstance(UntitledTextEditorInput, service.create({ associatedResource: URI.file('/test/file.unknown') }));
		const response = editorService.fireOpenEditor(input, undefined, undefined as IEditorGroup, OpenEditorContext.NEW_EDITOR);
		assert(response === undefined);

		contrib.dispose();
	});
});

class MockEditorService extends TestEditorService {

	constructor(private readonly instantiationService: IInstantiationService) {
		super();
	}
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

	fireOpenEditor(editor: IEditorInput, options: IEditorOptions | ITextEditorOptions | undefined, group: IEditorGroup, context: OpenEditorContext) {
		for (const handler of this.overridenOpens) {
			let response: IOpenEditorOverride | undefined;
			if (response = handler.open(editor, options, group, context)) {
				return response;
			}
		}
		return undefined;
	}

	openEditor(_editor: any, _options?: any, _group?: any): Promise<any> {
		return Promise.resolve(_editor);
	}

	createEditorInput(_input: IUntitledTextResourceEditorInput): EditorInput {
		const accessor = this.instantiationService.createInstance(ServiceAccessor);
		const service = accessor.untitledTextEditorService;
		return this.instantiationService.createInstance(UntitledTextEditorInput, service.create());
	}
}

class TestModeService implements IModeService {
	_serviceBrand: undefined;
	onDidCreateMode: Event<IMode>;
	onLanguagesMaybeChanged: Event<void>;

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

class ServiceAccessor {
	constructor(
		@IUntitledTextEditorService public readonly untitledTextEditorService: IUntitledTextEditorService
	) { }
}
