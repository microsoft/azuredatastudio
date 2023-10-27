/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { URI } from 'vs/base/common/uri';
import { TextResourceEditorInput } from 'vs/workbench/common/editor/textResourceEditorInput';
import { TextResourceEditorModel } from 'vs/workbench/common/editor/textResourceEditorModel';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { workbenchInstantiationService, TestServiceAccessor } from 'vs/workbench/test/browser/workbenchTestServices';
import { snapshotToString } from 'vs/workbench/services/textfile/common/textfiles';
import { PLAINTEXT_LANGUAGE_ID } from 'vs/editor/common/languages/modesRegistry';
import { DisposableStore } from 'vs/base/common/lifecycle';

suite('TextResourceEditorInput', () => {

	let disposables: DisposableStore;
	let instantiationService: IInstantiationService;
	let accessor: TestServiceAccessor;

	setup(() => {
		disposables = new DisposableStore();
		instantiationService = workbenchInstantiationService(undefined, disposables);
		accessor = instantiationService.createInstance(TestServiceAccessor);
	});

	teardown(() => {
		disposables.dispose();
	});

	test('basics', async () => {
		const resource = URI.from({ scheme: 'inmemory', authority: null!, path: 'thePath' });
		accessor.modelService.createModel('function test() {}', accessor.languageService.createById(PLAINTEXT_LANGUAGE_ID), resource);

		const input = instantiationService.createInstance(TextResourceEditorInput, resource, 'The Name', 'The Description', undefined, undefined);

		const model = await input.resolve();

		assert.ok(model);
		assert.strictEqual(snapshotToString(((model as TextResourceEditorModel).createSnapshot()!)), 'function test() {}');
	});

	test('preferred language (via ctor)', async () => {
		const registration = accessor.languageService.registerLanguage({
			id: 'resource-input-test',
		});

		const resource = URI.from({ scheme: 'inmemory', authority: null!, path: 'thePath' });
		accessor.modelService.createModel('function test() {}', accessor.languageService.createById(PLAINTEXT_LANGUAGE_ID), resource);

		const input = instantiationService.createInstance(TextResourceEditorInput, resource, 'The Name', 'The Description', 'resource-input-test', undefined);

		const model = await input.resolve();
		assert.ok(model);
		assert.strictEqual(model.textEditorModel?.getLanguageId(), 'resource-input-test');

		input.setLanguageId('text');
		assert.strictEqual(model.textEditorModel?.getLanguageId(), PLAINTEXT_LANGUAGE_ID);

		await input.resolve();
		assert.strictEqual(model.textEditorModel?.getLanguageId(), PLAINTEXT_LANGUAGE_ID);
		registration.dispose();
	});

	test('preferred language (via setPreferredLanguageId)', async () => {
		const registration = accessor.languageService.registerLanguage({
			id: 'resource-input-test',
		});

		const resource = URI.from({ scheme: 'inmemory', authority: null!, path: 'thePath' });
		accessor.modelService.createModel('function test() {}', accessor.languageService.createById(PLAINTEXT_LANGUAGE_ID), resource);

		const input = instantiationService.createInstance(TextResourceEditorInput, resource, 'The Name', 'The Description', undefined, undefined);
		input.setPreferredLanguageId('resource-input-test');

		const model = await input.resolve();
		assert.ok(model);
		assert.strictEqual(model.textEditorModel?.getLanguageId(), 'resource-input-test');
		registration.dispose();
	});

	test('preferred contents (via ctor)', async () => {
		const resource = URI.from({ scheme: 'inmemory', authority: null!, path: 'thePath' });
		accessor.modelService.createModel('function test() {}', accessor.languageService.createById(PLAINTEXT_LANGUAGE_ID), resource);

		const input = instantiationService.createInstance(TextResourceEditorInput, resource, 'The Name', 'The Description', undefined, 'My Resource Input Contents');

		const model = await input.resolve();
		assert.ok(model);
		assert.strictEqual(model.textEditorModel?.getValue(), 'My Resource Input Contents');

		model.textEditorModel.setValue('Some other contents');
		assert.strictEqual(model.textEditorModel?.getValue(), 'Some other contents');

		await input.resolve();
		assert.strictEqual(model.textEditorModel?.getValue(), 'Some other contents'); // preferred contents only used once
	});

	test('preferred contents (via setPreferredContents)', async () => {
		const resource = URI.from({ scheme: 'inmemory', authority: null!, path: 'thePath' });
		accessor.modelService.createModel('function test() {}', accessor.languageService.createById(PLAINTEXT_LANGUAGE_ID), resource);

		const input = instantiationService.createInstance(TextResourceEditorInput, resource, 'The Name', 'The Description', undefined, undefined);
		input.setPreferredContents('My Resource Input Contents');

		const model = await input.resolve();
		assert.ok(model);
		assert.strictEqual(model.textEditorModel?.getValue(), 'My Resource Input Contents');

		model.textEditorModel.setValue('Some other contents');
		assert.strictEqual(model.textEditorModel?.getValue(), 'Some other contents');

		await input.resolve();
		assert.strictEqual(model.textEditorModel?.getValue(), 'Some other contents'); // preferred contents only used once
	});
});
