/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { TextFileEditorModel } from 'vs/workbench/services/textfile/common/textFileEditorModel';
import { workbenchInstantiationService, TestServiceAccessor } from 'vs/workbench/test/browser/workbenchTestServices';
import { toResource } from 'vs/base/test/common/utils';
import { TextFileEditorModelManager } from 'vs/workbench/services/textfile/common/textFileEditorModelManager';
import { createTextBufferFactoryFromStream } from 'vs/editor/common/model/textModel';
import { CancellationToken } from 'vs/base/common/cancellation';
import { URI } from 'vs/base/common/uri';
import { bufferToStream, VSBuffer } from 'vs/base/common/buffer';
import { DisposableStore } from 'vs/base/common/lifecycle';

suite('Files - TextFileEditorModel (integration)', () => {

	let disposables: DisposableStore;
	let instantiationService: IInstantiationService;
	let accessor: TestServiceAccessor;
	let content: string;

	setup(() => {
		disposables = new DisposableStore();
		instantiationService = workbenchInstantiationService(undefined, disposables);
		accessor = instantiationService.createInstance(TestServiceAccessor);
		content = accessor.fileService.getContent();
	});

	teardown(() => {
		(<TextFileEditorModelManager>accessor.textFileService.files).dispose();
		accessor.fileService.setContent(content);
		disposables.dispose();
	});

	test('backup and restore (simple)', async function () {
		return testBackupAndRestore(toResource.call(this, '/path/index_async.txt'), toResource.call(this, '/path/index_async2.txt'), 'Some very small file text content.');
	});

	test('backup and restore (large, #121347)', async function () {
		const largeContent = '국어한\n'.repeat(100000);
		return testBackupAndRestore(toResource.call(this, '/path/index_async.txt'), toResource.call(this, '/path/index_async2.txt'), largeContent);
	});

	async function testBackupAndRestore(resourceA: URI, resourceB: URI, contents: string): Promise<void> {
		const originalModel: TextFileEditorModel = instantiationService.createInstance(TextFileEditorModel, resourceA, 'utf8', undefined);
		await originalModel.resolve({
			contents: await createTextBufferFactoryFromStream(await accessor.textFileService.getDecodedStream(resourceA, bufferToStream(VSBuffer.fromString(contents))))
		});

		assert.strictEqual(originalModel.textEditorModel?.getValue(), contents);

		const backup = await originalModel.backup(CancellationToken.None);
		const modelRestoredIdentifier = { typeId: originalModel.typeId, resource: resourceB };
		await accessor.workingCopyBackupService.backup(modelRestoredIdentifier, backup.content);

		const modelRestored: TextFileEditorModel = instantiationService.createInstance(TextFileEditorModel, modelRestoredIdentifier.resource, 'utf8', undefined);
		await modelRestored.resolve();

		assert.strictEqual(modelRestored.textEditorModel?.getValue(), contents);
		assert.strictEqual(modelRestored.isDirty(), true);

		originalModel.dispose();
		modelRestored.dispose();
	}
});
