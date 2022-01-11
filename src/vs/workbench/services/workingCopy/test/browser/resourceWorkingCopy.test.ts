/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Event } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { CancellationToken } from 'vs/base/common/cancellation';
import { TestServiceAccessor, workbenchInstantiationService } from 'vs/workbench/test/browser/workbenchTestServices';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { FileChangesEvent, FileChangeType } from 'vs/platform/files/common/files';
import { IRevertOptions, ISaveOptions } from 'vs/workbench/common/editor';
import { ResourceWorkingCopy } from 'vs/workbench/services/workingCopy/common/resourceWorkingCopy';
import { WorkingCopyCapabilities, IWorkingCopyBackup } from 'vs/workbench/services/workingCopy/common/workingCopy';

suite('ResourceWorkingCopy', function () {

	class TestResourceWorkingCopy extends ResourceWorkingCopy {
		name = 'testName';
		typeId = 'testTypeId';
		capabilities = WorkingCopyCapabilities.None;
		onDidChangeDirty = Event.None;
		onDidChangeContent = Event.None;
		isDirty(): boolean { return false; }
		async backup(token: CancellationToken): Promise<IWorkingCopyBackup> { throw new Error('Method not implemented.'); }
		async save(options?: ISaveOptions): Promise<boolean> { return false; }
		async revert(options?: IRevertOptions): Promise<void> { }

	}

	let resource = URI.file('test/resource');
	let instantiationService: IInstantiationService;
	let accessor: TestServiceAccessor;
	let workingCopy: TestResourceWorkingCopy;

	function createWorkingCopy(uri: URI = resource) {
		return new TestResourceWorkingCopy(uri, accessor.fileService);
	}

	setup(() => {
		instantiationService = workbenchInstantiationService();
		accessor = instantiationService.createInstance(TestServiceAccessor);

		workingCopy = createWorkingCopy();
	});

	teardown(() => {
		workingCopy.dispose();
	});

	test('orphaned tracking', async () => {
		assert.strictEqual(workingCopy.isOrphaned(), false);

		let onDidChangeOrphanedPromise = Event.toPromise(workingCopy.onDidChangeOrphaned);
		accessor.fileService.notExistsSet.set(resource, true);
		accessor.fileService.fireFileChanges(new FileChangesEvent([{ resource, type: FileChangeType.DELETED }], false));

		await onDidChangeOrphanedPromise;
		assert.strictEqual(workingCopy.isOrphaned(), true);

		onDidChangeOrphanedPromise = Event.toPromise(workingCopy.onDidChangeOrphaned);
		accessor.fileService.notExistsSet.delete(resource);
		accessor.fileService.fireFileChanges(new FileChangesEvent([{ resource, type: FileChangeType.ADDED }], false));

		await onDidChangeOrphanedPromise;
		assert.strictEqual(workingCopy.isOrphaned(), false);
	});


	test('dispose, isDisposed', async () => {
		assert.strictEqual(workingCopy.isDisposed(), false);

		let disposedEvent = false;
		workingCopy.onWillDispose(() => {
			disposedEvent = true;
		});

		workingCopy.dispose();

		assert.strictEqual(workingCopy.isDisposed(), true);
		assert.strictEqual(disposedEvent, true);
	});
});
