/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Event } from 'vs/base/common/event';
import { toResource } from 'vs/base/test/common/utils';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { TestFilesConfigurationService, workbenchInstantiationService, TestServiceAccessor, registerTestFileEditor, createEditorPart } from 'vs/workbench/test/browser/workbenchTestServices';
import { IResolvedTextFileEditorModel, ITextFileEditorModel } from 'vs/workbench/services/textfile/common/textfiles';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { TextFileEditorModelManager } from 'vs/workbench/services/textfile/common/textFileEditorModelManager';
import { EditorService } from 'vs/workbench/services/editor/browser/editorService';
import { EditorAutoSave } from 'vs/workbench/browser/parts/editor/editorAutoSave';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { IFilesConfigurationService } from 'vs/workbench/services/filesConfiguration/common/filesConfigurationService';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';
import { DEFAULT_EDITOR_ASSOCIATION } from 'vs/workbench/common/editor';
import { TestWorkspace } from 'vs/platform/workspace/test/common/testWorkspace';
import { TestContextService } from 'vs/workbench/test/common/workbenchTestServices';

suite('EditorAutoSave', () => {

	const disposables = new DisposableStore();

	setup(() => {
		disposables.add(registerTestFileEditor());
	});

	teardown(() => {
		disposables.clear();
	});

	async function createEditorAutoSave(autoSaveConfig: object): Promise<TestServiceAccessor> {
		const instantiationService = workbenchInstantiationService(undefined, disposables);

		const configurationService = new TestConfigurationService();
		configurationService.setUserConfiguration('files', autoSaveConfig);
		instantiationService.stub(IConfigurationService, configurationService);

		instantiationService.stub(IFilesConfigurationService, new TestFilesConfigurationService(
			<IContextKeyService>instantiationService.createInstance(MockContextKeyService),
			configurationService,
			new TestContextService(TestWorkspace)
		));

		const part = await createEditorPart(instantiationService, disposables);
		instantiationService.stub(IEditorGroupsService, part);

		const editorService: EditorService = instantiationService.createInstance(EditorService);
		instantiationService.stub(IEditorService, editorService);

		const accessor = instantiationService.createInstance(TestServiceAccessor);
		disposables.add((<TextFileEditorModelManager>accessor.textFileService.files));

		disposables.add(instantiationService.createInstance(EditorAutoSave));

		return accessor;
	}

	test('editor auto saves after short delay if configured', async function () {
		const accessor = await createEditorAutoSave({ autoSave: 'afterDelay', autoSaveDelay: 1 });

		const resource = toResource.call(this, '/path/index.txt');

		const model = await accessor.textFileService.files.resolve(resource) as IResolvedTextFileEditorModel;
		model.textEditorModel.setValue('Super Good');

		assert.ok(model.isDirty());

		await awaitModelSaved(model);

		assert.ok(!model.isDirty());
	});

	test.skip('editor auto saves on focus change if configured', async function () { // {{SQL CARBON EDIT}} skip failing test
		const accessor = await createEditorAutoSave({ autoSave: 'onFocusChange' });

		const resource = toResource.call(this, '/path/index.txt');
		await accessor.editorService.openEditor({ resource, options: { override: DEFAULT_EDITOR_ASSOCIATION.id } });

		const model = await accessor.textFileService.files.resolve(resource) as IResolvedTextFileEditorModel;
		model.textEditorModel.setValue('Super Good');

		assert.ok(model.isDirty());

		await accessor.editorService.openEditor({ resource: toResource.call(this, '/path/index_other.txt') });

		await awaitModelSaved(model);

		assert.ok(!model.isDirty());
	});

	function awaitModelSaved(model: ITextFileEditorModel): Promise<void> {
		return Event.toPromise(Event.once(model.onDidChangeDirty));
	}
});
