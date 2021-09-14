/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { EditorResourceAccessor, SideBySideEditor, IEditorInputWithPreferredResource, EditorInputCapabilities, isEditorIdentifier } from 'vs/workbench/common/editor';
import { DiffEditorInput } from 'vs/workbench/common/editor/diffEditorInput';
import { URI } from 'vs/base/common/uri';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { workbenchInstantiationService, TestServiceAccessor, TestEditorInput, registerTestEditor, registerTestFileEditor, registerTestResourceEditor, TestFileEditorInput, createEditorPart, registerTestSideBySideEditor } from 'vs/workbench/test/browser/workbenchTestServices';
import { Schemas } from 'vs/base/common/network';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { toResource } from 'vs/base/test/common/utils';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { whenEditorClosed } from 'vs/workbench/browser/editor';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { EditorService } from 'vs/workbench/services/editor/browser/editorService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { SideBySideEditorInput } from 'vs/workbench/common/editor/sideBySideEditorInput';

suite('Workbench editor utils', () => {

	class TestEditorInputWithPreferredResource extends TestEditorInput implements IEditorInputWithPreferredResource {

		constructor(resource: URI, public preferredResource: URI, typeId: string) {
			super(resource, typeId);
		}
	}

	const disposables = new DisposableStore();

	const TEST_EDITOR_ID = 'MyTestEditorForEditors';

	let instantiationService: IInstantiationService;
	let accessor: TestServiceAccessor;

	async function createServices(): Promise<TestServiceAccessor> {
		const instantiationService = workbenchInstantiationService();

		const part = await createEditorPart(instantiationService, disposables);

		instantiationService.stub(IEditorGroupsService, part);

		const editorService = instantiationService.createInstance(EditorService);
		instantiationService.stub(IEditorService, editorService);

		return instantiationService.createInstance(TestServiceAccessor);
	}

	setup(() => {
		instantiationService = workbenchInstantiationService();
		accessor = instantiationService.createInstance(TestServiceAccessor);

		disposables.add(registerTestFileEditor());
		disposables.add(registerTestSideBySideEditor());
		disposables.add(registerTestResourceEditor());
		disposables.add(registerTestEditor(TEST_EDITOR_ID, [new SyncDescriptor(TestFileEditorInput)]));
	});

	teardown(() => {
		accessor.untitledTextEditorService.dispose();

		disposables.clear();
	});

	test('EditorInputCapabilities', () => {
		const testInput1 = new TestFileEditorInput(URI.file('resource1'), 'testTypeId');
		const testInput2 = new TestFileEditorInput(URI.file('resource2'), 'testTypeId');

		testInput1.capabilities = EditorInputCapabilities.None;
		assert.strictEqual(testInput1.hasCapability(EditorInputCapabilities.None), true);
		assert.strictEqual(testInput1.hasCapability(EditorInputCapabilities.Readonly), false);
		assert.strictEqual(testInput1.hasCapability(EditorInputCapabilities.Untitled), false);
		assert.strictEqual(testInput1.hasCapability(EditorInputCapabilities.RequiresTrust), false);
		assert.strictEqual(testInput1.hasCapability(EditorInputCapabilities.Singleton), false);

		testInput1.capabilities |= EditorInputCapabilities.Readonly;
		assert.strictEqual(testInput1.hasCapability(EditorInputCapabilities.Readonly), true);
		assert.strictEqual(testInput1.hasCapability(EditorInputCapabilities.None), false);
		assert.strictEqual(testInput1.hasCapability(EditorInputCapabilities.Untitled), false);
		assert.strictEqual(testInput1.hasCapability(EditorInputCapabilities.RequiresTrust), false);
		assert.strictEqual(testInput1.hasCapability(EditorInputCapabilities.Singleton), false);

		testInput1.capabilities = EditorInputCapabilities.None;
		testInput2.capabilities = EditorInputCapabilities.None;

		const sideBySideInput = new SideBySideEditorInput('name', undefined, testInput1, testInput2);
		assert.strictEqual(sideBySideInput.hasCapability(EditorInputCapabilities.None), true);
		assert.strictEqual(sideBySideInput.hasCapability(EditorInputCapabilities.Readonly), false);
		assert.strictEqual(sideBySideInput.hasCapability(EditorInputCapabilities.Untitled), false);
		assert.strictEqual(sideBySideInput.hasCapability(EditorInputCapabilities.RequiresTrust), false);
		assert.strictEqual(sideBySideInput.hasCapability(EditorInputCapabilities.Singleton), false);

		testInput1.capabilities |= EditorInputCapabilities.Readonly;
		assert.strictEqual(sideBySideInput.hasCapability(EditorInputCapabilities.Readonly), false);

		testInput2.capabilities |= EditorInputCapabilities.Readonly;
		assert.strictEqual(sideBySideInput.hasCapability(EditorInputCapabilities.Readonly), true);

		testInput1.capabilities |= EditorInputCapabilities.Untitled;
		assert.strictEqual(sideBySideInput.hasCapability(EditorInputCapabilities.Untitled), false);

		testInput2.capabilities |= EditorInputCapabilities.Untitled;
		assert.strictEqual(sideBySideInput.hasCapability(EditorInputCapabilities.Untitled), true);

		testInput1.capabilities |= EditorInputCapabilities.RequiresTrust;
		assert.strictEqual(sideBySideInput.hasCapability(EditorInputCapabilities.RequiresTrust), true);

		testInput2.capabilities |= EditorInputCapabilities.RequiresTrust;
		assert.strictEqual(sideBySideInput.hasCapability(EditorInputCapabilities.RequiresTrust), true);

		testInput1.capabilities |= EditorInputCapabilities.Singleton;
		assert.strictEqual(sideBySideInput.hasCapability(EditorInputCapabilities.Singleton), true);

		testInput2.capabilities |= EditorInputCapabilities.Singleton;
		assert.strictEqual(sideBySideInput.hasCapability(EditorInputCapabilities.Singleton), true);
	});

	test('EditorResourceAccessor', () => {
		const service = accessor.untitledTextEditorService;

		assert.ok(!EditorResourceAccessor.getCanonicalUri(null!));
		assert.ok(!EditorResourceAccessor.getOriginalUri(null!));

		const untitled = instantiationService.createInstance(UntitledTextEditorInput, service.create());

		assert.strictEqual(EditorResourceAccessor.getCanonicalUri(untitled)!.toString(), untitled.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getCanonicalUri(untitled, { supportSideBySide: SideBySideEditor.PRIMARY })!.toString(), untitled.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getCanonicalUri(untitled, { supportSideBySide: SideBySideEditor.SECONDARY })!.toString(), untitled.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getCanonicalUri(untitled, { supportSideBySide: SideBySideEditor.BOTH })!.toString(), untitled.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getCanonicalUri(untitled, { filterByScheme: Schemas.untitled })!.toString(), untitled.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getCanonicalUri(untitled, { filterByScheme: [Schemas.file, Schemas.untitled] })!.toString(), untitled.resource.toString());
		assert.ok(!EditorResourceAccessor.getCanonicalUri(untitled, { filterByScheme: Schemas.file }));

		assert.strictEqual(EditorResourceAccessor.getOriginalUri(untitled)!.toString(), untitled.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getOriginalUri(untitled, { supportSideBySide: SideBySideEditor.PRIMARY })!.toString(), untitled.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getOriginalUri(untitled, { supportSideBySide: SideBySideEditor.SECONDARY })!.toString(), untitled.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getOriginalUri(untitled, { supportSideBySide: SideBySideEditor.BOTH })!.toString(), untitled.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getOriginalUri(untitled, { filterByScheme: Schemas.untitled })!.toString(), untitled.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getOriginalUri(untitled, { filterByScheme: [Schemas.file, Schemas.untitled] })!.toString(), untitled.resource.toString());
		assert.ok(!EditorResourceAccessor.getOriginalUri(untitled, { filterByScheme: Schemas.file }));

		const file = new TestEditorInput(URI.file('/some/path.txt'), 'editorResourceFileTest');

		assert.strictEqual(EditorResourceAccessor.getCanonicalUri(file)!.toString(), file.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getCanonicalUri(file, { supportSideBySide: SideBySideEditor.PRIMARY })!.toString(), file.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getCanonicalUri(file, { supportSideBySide: SideBySideEditor.SECONDARY })!.toString(), file.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getCanonicalUri(file, { supportSideBySide: SideBySideEditor.BOTH })!.toString(), file.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getCanonicalUri(file, { filterByScheme: Schemas.file })!.toString(), file.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getCanonicalUri(file, { filterByScheme: [Schemas.file, Schemas.untitled] })!.toString(), file.resource.toString());
		assert.ok(!EditorResourceAccessor.getCanonicalUri(file, { filterByScheme: Schemas.untitled }));

		assert.strictEqual(EditorResourceAccessor.getOriginalUri(file)!.toString(), file.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getOriginalUri(file, { supportSideBySide: SideBySideEditor.PRIMARY })!.toString(), file.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getOriginalUri(file, { supportSideBySide: SideBySideEditor.SECONDARY })!.toString(), file.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getOriginalUri(file, { supportSideBySide: SideBySideEditor.BOTH })!.toString(), file.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getOriginalUri(file, { filterByScheme: Schemas.file })!.toString(), file.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getOriginalUri(file, { filterByScheme: [Schemas.file, Schemas.untitled] })!.toString(), file.resource.toString());
		assert.ok(!EditorResourceAccessor.getOriginalUri(file, { filterByScheme: Schemas.untitled }));

		const diffEditorInput = instantiationService.createInstance(DiffEditorInput, 'name', 'description', untitled, file, undefined);

		assert.ok(!EditorResourceAccessor.getCanonicalUri(diffEditorInput));
		assert.ok(!EditorResourceAccessor.getCanonicalUri(diffEditorInput, { filterByScheme: Schemas.file }));

		assert.strictEqual(EditorResourceAccessor.getCanonicalUri(diffEditorInput, { supportSideBySide: SideBySideEditor.PRIMARY })!.toString(), file.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getCanonicalUri(diffEditorInput, { supportSideBySide: SideBySideEditor.PRIMARY, filterByScheme: Schemas.file })!.toString(), file.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getCanonicalUri(diffEditorInput, { supportSideBySide: SideBySideEditor.PRIMARY, filterByScheme: [Schemas.file, Schemas.untitled] })!.toString(), file.resource.toString());

		assert.strictEqual(EditorResourceAccessor.getCanonicalUri(diffEditorInput, { supportSideBySide: SideBySideEditor.SECONDARY })!.toString(), untitled.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getCanonicalUri(diffEditorInput, { supportSideBySide: SideBySideEditor.SECONDARY, filterByScheme: Schemas.untitled })!.toString(), untitled.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getCanonicalUri(diffEditorInput, { supportSideBySide: SideBySideEditor.SECONDARY, filterByScheme: [Schemas.file, Schemas.untitled] })!.toString(), untitled.resource.toString());

		assert.strictEqual((EditorResourceAccessor.getCanonicalUri(diffEditorInput, { supportSideBySide: SideBySideEditor.BOTH }) as { primary: URI, secondary: URI }).primary.toString(), file.resource.toString());
		assert.strictEqual((EditorResourceAccessor.getCanonicalUri(diffEditorInput, { supportSideBySide: SideBySideEditor.BOTH, filterByScheme: Schemas.file }) as { primary: URI, secondary: URI }).primary.toString(), file.resource.toString());
		assert.strictEqual((EditorResourceAccessor.getCanonicalUri(diffEditorInput, { supportSideBySide: SideBySideEditor.BOTH, filterByScheme: [Schemas.file, Schemas.untitled] }) as { primary: URI, secondary: URI }).primary.toString(), file.resource.toString());

		assert.strictEqual((EditorResourceAccessor.getCanonicalUri(diffEditorInput, { supportSideBySide: SideBySideEditor.BOTH }) as { primary: URI, secondary: URI }).secondary.toString(), untitled.resource.toString());
		assert.strictEqual((EditorResourceAccessor.getCanonicalUri(diffEditorInput, { supportSideBySide: SideBySideEditor.BOTH, filterByScheme: Schemas.untitled }) as { primary: URI, secondary: URI }).secondary.toString(), untitled.resource.toString());
		assert.strictEqual((EditorResourceAccessor.getCanonicalUri(diffEditorInput, { supportSideBySide: SideBySideEditor.BOTH, filterByScheme: [Schemas.file, Schemas.untitled] }) as { primary: URI, secondary: URI }).secondary.toString(), untitled.resource.toString());

		assert.ok(!EditorResourceAccessor.getOriginalUri(diffEditorInput));
		assert.ok(!EditorResourceAccessor.getOriginalUri(diffEditorInput, { filterByScheme: Schemas.file }));

		assert.strictEqual(EditorResourceAccessor.getOriginalUri(diffEditorInput, { supportSideBySide: SideBySideEditor.PRIMARY })!.toString(), file.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getOriginalUri(diffEditorInput, { supportSideBySide: SideBySideEditor.PRIMARY, filterByScheme: Schemas.file })!.toString(), file.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getOriginalUri(diffEditorInput, { supportSideBySide: SideBySideEditor.PRIMARY, filterByScheme: [Schemas.file, Schemas.untitled] })!.toString(), file.resource.toString());

		assert.strictEqual(EditorResourceAccessor.getOriginalUri(diffEditorInput, { supportSideBySide: SideBySideEditor.SECONDARY })!.toString(), untitled.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getOriginalUri(diffEditorInput, { supportSideBySide: SideBySideEditor.SECONDARY, filterByScheme: Schemas.untitled })!.toString(), untitled.resource.toString());
		assert.strictEqual(EditorResourceAccessor.getOriginalUri(diffEditorInput, { supportSideBySide: SideBySideEditor.SECONDARY, filterByScheme: [Schemas.file, Schemas.untitled] })!.toString(), untitled.resource.toString());

		assert.strictEqual((EditorResourceAccessor.getOriginalUri(diffEditorInput, { supportSideBySide: SideBySideEditor.BOTH }) as { primary: URI, secondary: URI }).primary.toString(), file.resource.toString());
		assert.strictEqual((EditorResourceAccessor.getOriginalUri(diffEditorInput, { supportSideBySide: SideBySideEditor.BOTH, filterByScheme: Schemas.file }) as { primary: URI, secondary: URI }).primary.toString(), file.resource.toString());
		assert.strictEqual((EditorResourceAccessor.getOriginalUri(diffEditorInput, { supportSideBySide: SideBySideEditor.BOTH, filterByScheme: [Schemas.file, Schemas.untitled] }) as { primary: URI, secondary: URI }).primary.toString(), file.resource.toString());

		assert.strictEqual((EditorResourceAccessor.getOriginalUri(diffEditorInput, { supportSideBySide: SideBySideEditor.BOTH }) as { primary: URI, secondary: URI }).secondary.toString(), untitled.resource.toString());
		assert.strictEqual((EditorResourceAccessor.getOriginalUri(diffEditorInput, { supportSideBySide: SideBySideEditor.BOTH, filterByScheme: Schemas.untitled }) as { primary: URI, secondary: URI }).secondary.toString(), untitled.resource.toString());
		assert.strictEqual((EditorResourceAccessor.getOriginalUri(diffEditorInput, { supportSideBySide: SideBySideEditor.BOTH, filterByScheme: [Schemas.file, Schemas.untitled] }) as { primary: URI, secondary: URI }).secondary.toString(), untitled.resource.toString());


		const resource = URI.file('/some/path.txt');
		const preferredResource = URI.file('/some/PATH.txt');
		const fileWithPreferredResource = new TestEditorInputWithPreferredResource(URI.file('/some/path.txt'), URI.file('/some/PATH.txt'), 'editorResourceFileTest');

		assert.strictEqual(EditorResourceAccessor.getCanonicalUri(fileWithPreferredResource)?.toString(), resource.toString());
		assert.strictEqual(EditorResourceAccessor.getOriginalUri(fileWithPreferredResource)?.toString(), preferredResource.toString());
	});

	test('isEditorIdentifier', () => {
		assert.strictEqual(isEditorIdentifier(undefined), false);
		assert.strictEqual(isEditorIdentifier('undefined'), false);

		const testInput1 = new TestFileEditorInput(URI.file('resource1'), 'testTypeId');
		assert.strictEqual(isEditorIdentifier(testInput1), false);
		assert.strictEqual(isEditorIdentifier({ editor: testInput1, groupId: 3 }), true);
	});

	test('whenEditorClosed (single editor)', async function () {
		return testWhenEditorClosed(false, false, toResource.call(this, '/path/index.txt'));
	});

	test('whenEditorClosed (multiple editor)', async function () {
		return testWhenEditorClosed(false, false, toResource.call(this, '/path/index.txt'), toResource.call(this, '/test.html'));
	});

	test('whenEditorClosed (single editor, diff editor)', async function () {
		return testWhenEditorClosed(true, false, toResource.call(this, '/path/index.txt'));
	});

	test('whenEditorClosed (multiple editor, diff editor)', async function () {
		return testWhenEditorClosed(true, false, toResource.call(this, '/path/index.txt'), toResource.call(this, '/test.html'));
	});

	test('whenEditorClosed (single custom editor)', async function () {
		return testWhenEditorClosed(false, true, toResource.call(this, '/path/index.txt'));
	});

	test('whenEditorClosed (multiple custom editor)', async function () {
		return testWhenEditorClosed(false, true, toResource.call(this, '/path/index.txt'), toResource.call(this, '/test.html'));
	});

	async function testWhenEditorClosed(sideBySide: boolean, custom: boolean, ...resources: URI[]): Promise<void> {
		const accessor = await createServices();

		for (const resource of resources) {
			if (custom) {
				await accessor.editorService.openEditor(new TestFileEditorInput(resource, 'testTypeId'), { pinned: true });
			} else if (sideBySide) {
				await accessor.editorService.openEditor(new SideBySideEditorInput('testSideBySideEditor', undefined, new TestFileEditorInput(resource, 'testTypeId'), new TestFileEditorInput(resource, 'testTypeId')), { pinned: true });
			} else {
				await accessor.editorService.openEditor({ resource, options: { pinned: true } });
			}
		}

		const closedPromise = accessor.instantitionService.invokeFunction(accessor => whenEditorClosed(accessor, resources));

		accessor.editorGroupService.activeGroup.closeAllEditors();

		await closedPromise;
	}
});
