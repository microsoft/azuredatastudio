/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { bufferToStream, VSBuffer } from 'vs/base/common/buffer';
import { Schemas } from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { FileWorkingCopyManager, IFileWorkingCopyManager } from 'vs/workbench/services/workingCopy/common/fileWorkingCopyManager';
import { WorkingCopyCapabilities } from 'vs/workbench/services/workingCopy/common/workingCopy';
import { TestStoredFileWorkingCopyModel, TestStoredFileWorkingCopyModelFactory } from 'vs/workbench/services/workingCopy/test/browser/storedFileWorkingCopy.test';
import { TestUntitledFileWorkingCopyModel, TestUntitledFileWorkingCopyModelFactory } from 'vs/workbench/services/workingCopy/test/browser/untitledFileWorkingCopy.test';
import { TestInMemoryFileSystemProvider, TestServiceAccessor, workbenchInstantiationService } from 'vs/workbench/test/browser/workbenchTestServices';

suite('UntitledFileWorkingCopyManager', () => {

	let instantiationService: IInstantiationService;
	let accessor: TestServiceAccessor;

	let manager: IFileWorkingCopyManager<TestStoredFileWorkingCopyModel, TestUntitledFileWorkingCopyModel>;

	setup(() => {
		instantiationService = workbenchInstantiationService();
		accessor = instantiationService.createInstance(TestServiceAccessor);

		accessor.fileService.registerProvider(Schemas.file, new TestInMemoryFileSystemProvider());
		accessor.fileService.registerProvider(Schemas.vscodeRemote, new TestInMemoryFileSystemProvider());

		manager = new FileWorkingCopyManager(
			'testUntitledFileWorkingCopyType',
			new TestStoredFileWorkingCopyModelFactory(),
			new TestUntitledFileWorkingCopyModelFactory(),
			accessor.fileService, accessor.lifecycleService, accessor.labelService, accessor.logService,
			accessor.workingCopyFileService, accessor.workingCopyBackupService, accessor.uriIdentityService, accessor.fileDialogService,
			accessor.textFileService, accessor.filesConfigurationService, accessor.workingCopyService, accessor.notificationService,
			accessor.workingCopyEditorService, accessor.editorService, accessor.elevatedFileService, accessor.pathService,
			accessor.environmentService, accessor.dialogService
		);
	});

	teardown(() => {
		manager.dispose();
	});

	test('basics', async () => {
		let createCounter = 0;
		manager.untitled.onDidCreate(e => {
			createCounter++;
		});

		let disposeCounter = 0;
		manager.untitled.onWillDispose(e => {
			disposeCounter++;
		});

		let dirtyCounter = 0;
		manager.untitled.onDidChangeDirty(e => {
			dirtyCounter++;
		});

		assert.strictEqual(accessor.workingCopyService.workingCopies.length, 0);
		assert.strictEqual(manager.untitled.workingCopies.length, 0);

		assert.strictEqual(manager.untitled.get(URI.file('/some/invalidPath')), undefined);
		assert.strictEqual(manager.untitled.get(URI.file('/some/invalidPath').with({ scheme: Schemas.untitled })), undefined);

		const workingCopy1 = await manager.untitled.resolve();
		const workingCopy2 = await manager.untitled.resolve();

		assert.strictEqual(workingCopy1.typeId, 'testUntitledFileWorkingCopyType');
		assert.strictEqual(workingCopy1.resource.scheme, Schemas.untitled);

		assert.strictEqual(createCounter, 2);

		assert.strictEqual(manager.untitled.get(workingCopy1.resource), workingCopy1);
		assert.strictEqual(manager.untitled.get(workingCopy2.resource), workingCopy2);

		assert.strictEqual(accessor.workingCopyService.workingCopies.length, 2);
		assert.strictEqual(manager.untitled.workingCopies.length, 2);

		assert.notStrictEqual(workingCopy1.resource.toString(), workingCopy2.resource.toString());

		for (const workingCopy of [workingCopy1, workingCopy2]) {
			assert.strictEqual(workingCopy.capabilities, WorkingCopyCapabilities.Untitled);
			assert.strictEqual(workingCopy.isDirty(), false);
			assert.ok(workingCopy.model);
		}

		workingCopy1.model?.updateContents('Hello World');

		assert.strictEqual(workingCopy1.isDirty(), true);
		assert.strictEqual(dirtyCounter, 1);

		workingCopy1.model?.updateContents(''); // change to empty clears dirty flag
		assert.strictEqual(workingCopy1.isDirty(), false);
		assert.strictEqual(dirtyCounter, 2);

		workingCopy2.model?.fireContentChangeEvent({ isEmpty: false });
		assert.strictEqual(workingCopy2.isDirty(), true);
		assert.strictEqual(dirtyCounter, 3);

		workingCopy1.dispose();

		assert.strictEqual(manager.untitled.workingCopies.length, 1);
		assert.strictEqual(manager.untitled.get(workingCopy1.resource), undefined);

		workingCopy2.dispose();

		assert.strictEqual(manager.untitled.workingCopies.length, 0);
		assert.strictEqual(manager.untitled.get(workingCopy2.resource), undefined);

		assert.strictEqual(disposeCounter, 2);
	});

	test('resolve - with initial value', async () => {
		let dirtyCounter = 0;
		manager.untitled.onDidChangeDirty(e => {
			dirtyCounter++;
		});

		const workingCopy = await manager.untitled.resolve({ contents: bufferToStream(VSBuffer.fromString('Hello World')) });

		assert.strictEqual(workingCopy.isDirty(), true);
		assert.strictEqual(dirtyCounter, 1);
		assert.strictEqual(workingCopy.model?.contents, 'Hello World');

		workingCopy.dispose();
	});

	test('resolve - existing', async () => {
		let createCounter = 0;
		manager.untitled.onDidCreate(e => {
			createCounter++;
		});

		const workingCopy1 = await manager.untitled.resolve();
		assert.strictEqual(createCounter, 1);

		const workingCopy2 = await manager.untitled.resolve({ untitledResource: workingCopy1.resource });
		assert.strictEqual(workingCopy1, workingCopy2);
		assert.strictEqual(createCounter, 1);

		const workingCopy3 = await manager.untitled.resolve({ untitledResource: URI.file('/invalid/untitled') });
		assert.strictEqual(workingCopy3.resource.scheme, Schemas.untitled);

		workingCopy1.dispose();
		workingCopy2.dispose();
		workingCopy3.dispose();
	});

	test('resolve - untitled resource used for new working copy', async () => {
		const invalidUntitledResource = URI.file('my/untitled.txt');
		const validUntitledResource = invalidUntitledResource.with({ scheme: Schemas.untitled });

		const workingCopy1 = await manager.untitled.resolve({ untitledResource: invalidUntitledResource });
		assert.notStrictEqual(workingCopy1.resource.toString(), invalidUntitledResource.toString());

		const workingCopy2 = await manager.untitled.resolve({ untitledResource: validUntitledResource });
		assert.strictEqual(workingCopy2.resource.toString(), validUntitledResource.toString());

		workingCopy1.dispose();
		workingCopy2.dispose();
	});

	test('resolve - with associated resource', async () => {
		const workingCopy = await manager.untitled.resolve({ associatedResource: { path: '/some/associated.txt' } });

		assert.strictEqual(workingCopy.hasAssociatedFilePath, true);
		assert.strictEqual(workingCopy.resource.path, '/some/associated.txt');

		workingCopy.dispose();
	});

	test('save - without associated resource', async () => {
		const workingCopy = await manager.untitled.resolve();
		workingCopy.model?.updateContents('Simple Save');

		accessor.fileDialogService.setPickFileToSave(URI.file('simple/file.txt'));

		const result = await workingCopy.save();
		assert.ok(result);

		assert.strictEqual(manager.untitled.get(workingCopy.resource), undefined);

		workingCopy.dispose();
	});

	test('save - with associated resource', async () => {
		const workingCopy = await manager.untitled.resolve({ associatedResource: { path: '/some/associated.txt' } });
		workingCopy.model?.updateContents('Simple Save with associated resource');

		accessor.fileService.notExistsSet.set(URI.from({ scheme: Schemas.vscodeRemote, path: '/some/associated.txt' }), true);

		const result = await workingCopy.save();
		assert.ok(result);

		assert.strictEqual(manager.untitled.get(workingCopy.resource), undefined);

		workingCopy.dispose();
	});

	test('save - with associated resource (asks to overwrite)', async () => {
		const workingCopy = await manager.untitled.resolve({ associatedResource: { path: '/some/associated.txt' } });
		workingCopy.model?.updateContents('Simple Save with associated resource');

		let result = await workingCopy.save();
		assert.ok(!result); // not confirmed

		assert.strictEqual(manager.untitled.get(workingCopy.resource), workingCopy);

		accessor.dialogService.setConfirmResult({ confirmed: true });

		result = await workingCopy.save();
		assert.ok(result); // confirmed

		assert.strictEqual(manager.untitled.get(workingCopy.resource), undefined);

		workingCopy.dispose();
	});

	test('destroy', async () => {
		assert.strictEqual(accessor.workingCopyService.workingCopies.length, 0);

		await manager.untitled.resolve();
		await manager.untitled.resolve();
		await manager.untitled.resolve();

		assert.strictEqual(accessor.workingCopyService.workingCopies.length, 3);
		assert.strictEqual(manager.untitled.workingCopies.length, 3);

		await manager.untitled.destroy();

		assert.strictEqual(accessor.workingCopyService.workingCopies.length, 0);
		assert.strictEqual(manager.untitled.workingCopies.length, 0);
	});
});
