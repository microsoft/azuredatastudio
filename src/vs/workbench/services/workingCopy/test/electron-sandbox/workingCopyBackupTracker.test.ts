/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { isMacintosh, isWindows } from 'vs/base/common/platform';
import { join } from 'vs/base/common/path';
import { URI } from 'vs/base/common/uri';
import { hash } from 'vs/base/common/hash';
import { NativeWorkingCopyBackupTracker } from 'vs/workbench/services/workingCopy/electron-sandbox/workingCopyBackupTracker';
import { TextFileEditorModelManager } from 'vs/workbench/services/textfile/common/textFileEditorModelManager';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { EditorPart } from 'vs/workbench/browser/parts/editor/editorPart';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { EditorService } from 'vs/workbench/services/editor/browser/editorService';
import { IWorkingCopyBackupService } from 'vs/workbench/services/workingCopy/common/workingCopyBackup';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { toResource } from 'vs/base/test/common/utils';
import { IFilesConfigurationService } from 'vs/workbench/services/filesConfiguration/common/filesConfigurationService';
import { IWorkingCopyService } from 'vs/workbench/services/workingCopy/common/workingCopyService';
import { ILogService } from 'vs/platform/log/common/log';
import { HotExitConfiguration } from 'vs/platform/files/common/files';
import { ShutdownReason, ILifecycleService } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { IFileDialogService, ConfirmResult, IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { INativeHostService } from 'vs/platform/native/common/native';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { createEditorPart, registerTestFileEditor, TestBeforeShutdownEvent, TestEnvironmentService, TestFilesConfigurationService, TestFileService } from 'vs/workbench/test/browser/workbenchTestServices';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { TestWorkspace, Workspace } from 'vs/platform/workspace/test/common/testWorkspace';
import { IProgressService } from 'vs/platform/progress/common/progress';
import { IWorkingCopyEditorService } from 'vs/workbench/services/workingCopy/common/workingCopyEditorService';
import { TestContextService, TestWorkingCopy } from 'vs/workbench/test/common/workbenchTestServices';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IWorkingCopyBackup, WorkingCopyCapabilities } from 'vs/workbench/services/workingCopy/common/workingCopy';
import { Event, Emitter } from 'vs/base/common/event';
import { generateUuid } from 'vs/base/common/uuid';
import { Schemas } from 'vs/base/common/network';
import { joinPath } from 'vs/base/common/resources';
import { VSBuffer } from 'vs/base/common/buffer';
import { TestServiceAccessor, workbenchInstantiationService } from 'vs/workbench/test/electron-sandbox/workbenchTestServices';
import { UriIdentityService } from 'vs/platform/uriIdentity/common/uriIdentityService';

suite('WorkingCopyBackupTracker (native)', function () {

	class TestWorkingCopyBackupTracker extends NativeWorkingCopyBackupTracker {

		constructor(
			@IWorkingCopyBackupService workingCopyBackupService: IWorkingCopyBackupService,
			@IFilesConfigurationService filesConfigurationService: IFilesConfigurationService,
			@IWorkingCopyService workingCopyService: IWorkingCopyService,
			@ILifecycleService lifecycleService: ILifecycleService,
			@IFileDialogService fileDialogService: IFileDialogService,
			@IDialogService dialogService: IDialogService,
			@IWorkspaceContextService contextService: IWorkspaceContextService,
			@INativeHostService nativeHostService: INativeHostService,
			@ILogService logService: ILogService,
			@IEditorService editorService: IEditorService,
			@IEnvironmentService environmentService: IEnvironmentService,
			@IProgressService progressService: IProgressService,
			@IWorkingCopyEditorService workingCopyEditorService: IWorkingCopyEditorService,
			@IEditorGroupsService editorGroupService: IEditorGroupsService
		) {
			super(workingCopyBackupService, filesConfigurationService, workingCopyService, lifecycleService, fileDialogService, dialogService, contextService, nativeHostService, logService, environmentService, progressService, workingCopyEditorService, editorService, editorGroupService);
		}

		protected override getBackupScheduleDelay(): number {
			return 10; // Reduce timeout for tests
		}

		waitForReady(): Promise<void> {
			return super.whenReady;
		}

		get pendingBackupOperationCount(): number { return this.pendingBackupOperations.size; }

		override dispose() {
			super.dispose();

			for (const [_, disposable] of this.pendingBackupOperations) {
				disposable.dispose();
			}
		}

		private readonly _onDidResume = this._register(new Emitter<void>());
		readonly onDidResume = this._onDidResume.event;

		private readonly _onDidSuspend = this._register(new Emitter<void>());
		readonly onDidSuspend = this._onDidSuspend.event;

		protected override suspendBackupOperations(): { resume: () => void } {
			const { resume } = super.suspendBackupOperations();

			this._onDidSuspend.fire();

			return {
				resume: () => {
					resume();

					this._onDidResume.fire();
				}
			};
		}
	}

	let testDir: URI;
	let backupHome: URI;
	let workspaceBackupPath: URI;

	let accessor: TestServiceAccessor;
	let disposables: DisposableStore;

	setup(async () => {
		disposables = new DisposableStore();

		testDir = URI.file(join(generateUuid(), 'vsctests', 'workingcopybackuptracker')).with({ scheme: Schemas.inMemory });
		backupHome = joinPath(testDir, 'Backups');
		const workspacesJsonPath = joinPath(backupHome, 'workspaces.json');

		const workspaceResource = URI.file(isWindows ? 'c:\\workspace' : '/workspace').with({ scheme: Schemas.inMemory });
		workspaceBackupPath = joinPath(backupHome, hash(workspaceResource.toString()).toString(16));

		const instantiationService = workbenchInstantiationService(undefined, disposables);
		accessor = instantiationService.createInstance(TestServiceAccessor);
		disposables.add((<TextFileEditorModelManager>accessor.textFileService.files));

		disposables.add(registerTestFileEditor());

		await accessor.fileService.createFolder(backupHome);
		await accessor.fileService.createFolder(workspaceBackupPath);

		return accessor.fileService.writeFile(workspacesJsonPath, VSBuffer.fromString(''));
	});

	teardown(async () => {
		disposables.dispose();
	});

	async function createTracker(autoSaveEnabled = false): Promise<{ accessor: TestServiceAccessor; part: EditorPart; tracker: TestWorkingCopyBackupTracker; instantiationService: IInstantiationService; cleanup: () => Promise<void> }> {
		const instantiationService = workbenchInstantiationService(undefined, disposables);

		const configurationService = new TestConfigurationService();
		if (autoSaveEnabled) {
			configurationService.setUserConfiguration('files', { autoSave: 'afterDelay', autoSaveDelay: 1 });
		}
		instantiationService.stub(IConfigurationService, configurationService);

		instantiationService.stub(IFilesConfigurationService, new TestFilesConfigurationService(
			<IContextKeyService>instantiationService.createInstance(MockContextKeyService),
			configurationService,
			new TestContextService(TestWorkspace),
			TestEnvironmentService,
			new UriIdentityService(new TestFileService()),
			new TestFileService()
		));

		const part = await createEditorPart(instantiationService, disposables);
		instantiationService.stub(IEditorGroupsService, part);

		const editorService: EditorService = instantiationService.createInstance(EditorService);
		instantiationService.stub(IEditorService, editorService);

		accessor = instantiationService.createInstance(TestServiceAccessor);

		const tracker = instantiationService.createInstance(TestWorkingCopyBackupTracker);

		const cleanup = async () => {
			// File changes could also schedule some backup operations so we need to wait for them before finishing the test
			await accessor.workingCopyBackupService.waitForAllBackups();

			part.dispose();
			tracker.dispose();
		};

		return { accessor, part, tracker, instantiationService, cleanup };
	}

	test('Track backups (file, auto save off)', function () {
		return trackBackupsTest(toResource.call(this, '/path/index.txt'), false);
	});

	test('Track backups (file, auto save on)', function () {
		return trackBackupsTest(toResource.call(this, '/path/index.txt'), true);
	});

	async function trackBackupsTest(resource: URI, autoSave: boolean) {
		const { accessor, cleanup } = await createTracker(autoSave);

		await accessor.editorService.openEditor({ resource, options: { pinned: true } });

		const fileModel = accessor.textFileService.files.get(resource);
		assert.ok(fileModel);
		fileModel.textEditorModel?.setValue('Super Good');

		await accessor.workingCopyBackupService.joinBackupResource();

		assert.strictEqual(accessor.workingCopyBackupService.hasBackupSync(fileModel), true);

		fileModel.dispose();

		await accessor.workingCopyBackupService.joinDiscardBackup();

		assert.strictEqual(accessor.workingCopyBackupService.hasBackupSync(fileModel), false);

		await cleanup();
	}

	test('onWillShutdown - no veto if no dirty files', async function () {
		const { accessor, cleanup } = await createTracker();

		const resource = toResource.call(this, '/path/index.txt');
		await accessor.editorService.openEditor({ resource, options: { pinned: true } });

		const event = new TestBeforeShutdownEvent();
		accessor.lifecycleService.fireBeforeShutdown(event);

		const veto = await event.value;
		assert.ok(!veto);

		await cleanup();
	});

	test('onWillShutdown - veto if user cancels (hot.exit: off)', async function () {
		const { accessor, cleanup } = await createTracker();

		const resource = toResource.call(this, '/path/index.txt');
		await accessor.editorService.openEditor({ resource, options: { pinned: true } });

		const model = accessor.textFileService.files.get(resource);

		accessor.fileDialogService.setConfirmResult(ConfirmResult.CANCEL);
		accessor.filesConfigurationService.testOnFilesConfigurationChange({ files: { hotExit: 'off' } });

		await model?.resolve();
		model?.textEditorModel?.setValue('foo');
		assert.strictEqual(accessor.workingCopyService.dirtyCount, 1);

		const event = new TestBeforeShutdownEvent();
		accessor.lifecycleService.fireBeforeShutdown(event);

		const veto = await event.value;
		assert.ok(veto);

		await cleanup();
	});

	test('onWillShutdown - no veto if auto save is on', async function () {
		const { accessor, cleanup } = await createTracker(true /* auto save enabled */);

		const resource = toResource.call(this, '/path/index.txt');
		await accessor.editorService.openEditor({ resource, options: { pinned: true } });

		const model = accessor.textFileService.files.get(resource);

		await model?.resolve();
		model?.textEditorModel?.setValue('foo');
		assert.strictEqual(accessor.workingCopyService.dirtyCount, 1);

		const event = new TestBeforeShutdownEvent();
		accessor.lifecycleService.fireBeforeShutdown(event);

		const veto = await event.value;
		assert.ok(!veto);

		assert.strictEqual(accessor.workingCopyService.dirtyCount, 0);

		await cleanup();
	});

	test('onWillShutdown - no veto and backups cleaned up if user does not want to save (hot.exit: off)', async function () {
		const { accessor, cleanup } = await createTracker();

		const resource = toResource.call(this, '/path/index.txt');
		await accessor.editorService.openEditor({ resource, options: { pinned: true } });

		const model = accessor.textFileService.files.get(resource);

		accessor.fileDialogService.setConfirmResult(ConfirmResult.DONT_SAVE);
		accessor.filesConfigurationService.testOnFilesConfigurationChange({ files: { hotExit: 'off' } });

		await model?.resolve();
		model?.textEditorModel?.setValue('foo');
		assert.strictEqual(accessor.workingCopyService.dirtyCount, 1);
		const event = new TestBeforeShutdownEvent();
		accessor.lifecycleService.fireBeforeShutdown(event);

		const veto = await event.value;
		assert.ok(!veto);
		assert.ok(accessor.workingCopyBackupService.discardedBackups.length > 0);

		await cleanup();
	});

	test('onWillShutdown - no backups discarded when shutdown without dirty but tracker not ready', async function () {
		const { accessor, cleanup } = await createTracker();

		const event = new TestBeforeShutdownEvent();
		accessor.lifecycleService.fireBeforeShutdown(event);

		const veto = await event.value;
		assert.ok(!veto);
		assert.ok(!accessor.workingCopyBackupService.discardedAllBackups);

		await cleanup();
	});

	test('onWillShutdown - backups discarded when shutdown without dirty', async function () {
		const { accessor, tracker, cleanup } = await createTracker();

		await tracker.waitForReady();

		const event = new TestBeforeShutdownEvent();
		accessor.lifecycleService.fireBeforeShutdown(event);

		const veto = await event.value;
		assert.ok(!veto);
		assert.ok(accessor.workingCopyBackupService.discardedAllBackups);

		await cleanup();
	});

	test('onWillShutdown - save (hot.exit: off)', async function () {
		const { accessor, cleanup } = await createTracker();

		const resource = toResource.call(this, '/path/index.txt');
		await accessor.editorService.openEditor({ resource, options: { pinned: true } });

		const model = accessor.textFileService.files.get(resource);

		accessor.fileDialogService.setConfirmResult(ConfirmResult.SAVE);
		accessor.filesConfigurationService.testOnFilesConfigurationChange({ files: { hotExit: 'off' } });

		await model?.resolve();
		model?.textEditorModel?.setValue('foo');
		assert.strictEqual(accessor.workingCopyService.dirtyCount, 1);
		const event = new TestBeforeShutdownEvent();
		accessor.lifecycleService.fireBeforeShutdown(event);

		const veto = await event.value;
		assert.ok(!veto);
		assert.ok(!model?.isDirty());

		await cleanup();
	});

	test('onWillShutdown - veto if backup fails', async function () {
		const { accessor, cleanup } = await createTracker();

		class TestBackupWorkingCopy extends TestWorkingCopy {

			constructor(resource: URI) {
				super(resource);

				accessor.workingCopyService.registerWorkingCopy(this);
			}

			override async backup(token: CancellationToken): Promise<IWorkingCopyBackup> {
				throw new Error('unable to backup');
			}
		}

		const resource = toResource.call(this, '/path/custom.txt');
		const customWorkingCopy = new TestBackupWorkingCopy(resource);
		customWorkingCopy.setDirty(true);

		const event = new TestBeforeShutdownEvent();
		event.reason = ShutdownReason.QUIT;
		accessor.lifecycleService.fireBeforeShutdown(event);

		const veto = await event.value;
		assert.ok(veto);

		const finalVeto = await event.finalValue?.();
		assert.ok(finalVeto); // assert the tracker uses the internal finalVeto API

		await cleanup();
	});

	test('onWillShutdown - scratchpads - veto if backup fails', async function () {
		const { accessor, cleanup } = await createTracker();

		class TestBackupWorkingCopy extends TestWorkingCopy {

			constructor(resource: URI) {
				super(resource);

				accessor.workingCopyService.registerWorkingCopy(this);
			}

			override capabilities = WorkingCopyCapabilities.Untitled | WorkingCopyCapabilities.Scratchpad;

			override async backup(token: CancellationToken): Promise<IWorkingCopyBackup> {
				throw new Error('unable to backup');
			}

			override isDirty(): boolean {
				return false;
			}

			override isModified(): boolean {
				return true;
			}
		}

		const resource = toResource.call(this, '/path/custom.txt');
		new TestBackupWorkingCopy(resource);

		const event = new TestBeforeShutdownEvent();
		event.reason = ShutdownReason.QUIT;
		accessor.lifecycleService.fireBeforeShutdown(event);

		const veto = await event.value;
		assert.ok(veto);

		const finalVeto = await event.finalValue?.();
		assert.ok(finalVeto); // assert the tracker uses the internal finalVeto API

		await cleanup();
	});

	test('onWillShutdown - pending backup operations canceled and tracker suspended/resumsed', async function () {
		const { accessor, tracker, cleanup } = await createTracker();

		const resource = toResource.call(this, '/path/index.txt');
		await accessor.editorService.openEditor({ resource, options: { pinned: true } });

		const model = accessor.textFileService.files.get(resource);

		await model?.resolve();
		model?.textEditorModel?.setValue('foo');
		assert.strictEqual(accessor.workingCopyService.dirtyCount, 1);
		assert.strictEqual(tracker.pendingBackupOperationCount, 1);

		const onSuspend = Event.toPromise(tracker.onDidSuspend);

		const event = new TestBeforeShutdownEvent();
		event.reason = ShutdownReason.QUIT;
		accessor.lifecycleService.fireBeforeShutdown(event);

		await onSuspend;

		assert.strictEqual(tracker.pendingBackupOperationCount, 0);

		// Ops are suspended during shutdown!
		model?.textEditorModel?.setValue('bar');
		assert.strictEqual(accessor.workingCopyService.dirtyCount, 1);
		assert.strictEqual(tracker.pendingBackupOperationCount, 0);

		const onResume = Event.toPromise(tracker.onDidResume);
		await event.value;

		// Ops are resumed after shutdown!
		model?.textEditorModel?.setValue('foo');
		await onResume;
		assert.strictEqual(tracker.pendingBackupOperationCount, 1);

		await cleanup();
	});

	suite('Hot Exit', () => {
		suite('"onExit" setting', () => {
			test('should hot exit on non-Mac (reason: CLOSE, windows: single, workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.CLOSE, false, true, !!isMacintosh);
			});
			test('should hot exit on non-Mac (reason: CLOSE, windows: single, empty workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.CLOSE, false, false, !!isMacintosh);
			});
			test('should NOT hot exit (reason: CLOSE, windows: multiple, workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.CLOSE, true, true, true);
			});
			test('should NOT hot exit (reason: CLOSE, windows: multiple, empty workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.CLOSE, true, false, true);
			});
			test('should hot exit (reason: QUIT, windows: single, workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.QUIT, false, true, false);
			});
			test('should hot exit (reason: QUIT, windows: single, empty workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.QUIT, false, false, false);
			});
			test('should hot exit (reason: QUIT, windows: multiple, workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.QUIT, true, true, false);
			});
			test('should hot exit (reason: QUIT, windows: multiple, empty workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.QUIT, true, false, false);
			});
			test('should hot exit (reason: RELOAD, windows: single, workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.RELOAD, false, true, false);
			});
			test('should hot exit (reason: RELOAD, windows: single, empty workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.RELOAD, false, false, false);
			});
			test('should hot exit (reason: RELOAD, windows: multiple, workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.RELOAD, true, true, false);
			});
			test('should hot exit (reason: RELOAD, windows: multiple, empty workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.RELOAD, true, false, false);
			});
			test('should NOT hot exit (reason: LOAD, windows: single, workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.LOAD, false, true, true);
			});
			test('should NOT hot exit (reason: LOAD, windows: single, empty workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.LOAD, false, false, true);
			});
			test('should NOT hot exit (reason: LOAD, windows: multiple, workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.LOAD, true, true, true);
			});
			test('should NOT hot exit (reason: LOAD, windows: multiple, empty workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.LOAD, true, false, true);
			});
		});

		suite('"onExitAndWindowClose" setting', () => {
			test('should hot exit (reason: CLOSE, windows: single, workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.CLOSE, false, true, false);
			});
			test('should hot exit (reason: CLOSE, windows: single, empty workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.CLOSE, false, false, !!isMacintosh);
			});
			test('should hot exit (reason: CLOSE, windows: multiple, workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.CLOSE, true, true, false);
			});
			test('should NOT hot exit (reason: CLOSE, windows: multiple, empty workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.CLOSE, true, false, true);
			});
			test('should hot exit (reason: QUIT, windows: single, workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.QUIT, false, true, false);
			});
			test('should hot exit (reason: QUIT, windows: single, empty workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.QUIT, false, false, false);
			});
			test('should hot exit (reason: QUIT, windows: multiple, workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.QUIT, true, true, false);
			});
			test('should hot exit (reason: QUIT, windows: multiple, empty workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.QUIT, true, false, false);
			});
			test('should hot exit (reason: RELOAD, windows: single, workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.RELOAD, false, true, false);
			});
			test('should hot exit (reason: RELOAD, windows: single, empty workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.RELOAD, false, false, false);
			});
			test('should hot exit (reason: RELOAD, windows: multiple, workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.RELOAD, true, true, false);
			});
			test('should hot exit (reason: RELOAD, windows: multiple, empty workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.RELOAD, true, false, false);
			});
			test('should hot exit (reason: LOAD, windows: single, workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.LOAD, false, true, false);
			});
			test('should NOT hot exit (reason: LOAD, windows: single, empty workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.LOAD, false, false, true);
			});
			test('should hot exit (reason: LOAD, windows: multiple, workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.LOAD, true, true, false);
			});
			test('should NOT hot exit (reason: LOAD, windows: multiple, empty workspace)', function () {
				return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.LOAD, true, false, true);
			});
		});

		suite('"onExit" setting - scratchpad', () => {
			test('should hot exit (reason: CLOSE, windows: single, workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.CLOSE, false, true, false);
			});
			test('should hot exit (reason: CLOSE, windows: single, empty workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.CLOSE, false, false, !!isMacintosh);
			});
			test('should hot exit (reason: CLOSE, windows: multiple, workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.CLOSE, true, true, false);
			});
			test('should NOT hot exit (reason: CLOSE, windows: multiple, empty workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.CLOSE, true, false, true);
			});
			test('should hot exit (reason: QUIT, windows: single, workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.QUIT, false, true, false);
			});
			test('should hot exit (reason: QUIT, windows: single, empty workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.QUIT, false, false, false);
			});
			test('should hot exit (reason: QUIT, windows: multiple, workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.QUIT, true, true, false);
			});
			test('should hot exit (reason: QUIT, windows: multiple, empty workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.QUIT, true, false, false);
			});
			test('should hot exit (reason: RELOAD, windows: single, workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.RELOAD, false, true, false);
			});
			test('should hot exit (reason: RELOAD, windows: single, empty workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.RELOAD, false, false, false);
			});
			test('should hot exit (reason: RELOAD, windows: multiple, workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.RELOAD, true, true, false);
			});
			test('should hot exit (reason: RELOAD, windows: multiple, empty workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.RELOAD, true, false, false);
			});
			test('should hot exit (reason: LOAD, windows: single, workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.LOAD, false, true, false);
			});
			test('should NOT hot exit (reason: LOAD, windows: single, empty workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.LOAD, false, false, true);
			});
			test('should hot exit (reason: LOAD, windows: multiple, workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.LOAD, true, true, false);
			});
			test('should NOT hot exit (reason: LOAD, windows: multiple, empty workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.LOAD, true, false, true);
			});
		});

		suite('"onExitAndWindowClose" setting - scratchpad', () => {
			test('should hot exit (reason: CLOSE, windows: single, workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.CLOSE, false, true, false);
			});
			test('should hot exit (reason: CLOSE, windows: single, empty workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.CLOSE, false, false, !!isMacintosh);
			});
			test('should hot exit (reason: CLOSE, windows: multiple, workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.CLOSE, true, true, false);
			});
			test('should NOT hot exit (reason: CLOSE, windows: multiple, empty workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.CLOSE, true, false, true);
			});
			test('should hot exit (reason: QUIT, windows: single, workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.QUIT, false, true, false);
			});
			test('should hot exit (reason: QUIT, windows: single, empty workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.QUIT, false, false, false);
			});
			test('should hot exit (reason: QUIT, windows: multiple, workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.QUIT, true, true, false);
			});
			test('should hot exit (reason: QUIT, windows: multiple, empty workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.QUIT, true, false, false);
			});
			test('should hot exit (reason: RELOAD, windows: single, workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.RELOAD, false, true, false);
			});
			test('should hot exit (reason: RELOAD, windows: single, empty workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.RELOAD, false, false, false);
			});
			test('should hot exit (reason: RELOAD, windows: multiple, workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.RELOAD, true, true, false);
			});
			test('should hot exit (reason: RELOAD, windows: multiple, empty workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.RELOAD, true, false, false);
			});
			test('should hot exit (reason: LOAD, windows: single, workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.LOAD, false, true, false);
			});
			test('should NOT hot exit (reason: LOAD, windows: single, empty workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.LOAD, false, false, true);
			});
			test('should hot exit (reason: LOAD, windows: multiple, workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.LOAD, true, true, false);
			});
			test('should NOT hot exit (reason: LOAD, windows: multiple, empty workspace)', function () {
				return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.LOAD, true, false, true);
			});
		});


		async function hotExitTest(this: any, setting: string, shutdownReason: ShutdownReason, multipleWindows: boolean, workspace: boolean, shouldVeto: boolean): Promise<void> {
			const { accessor, cleanup } = await createTracker();

			const resource = toResource.call(this, '/path/index.txt');
			await accessor.editorService.openEditor({ resource, options: { pinned: true } });

			const model = accessor.textFileService.files.get(resource);

			// Set hot exit config
			accessor.filesConfigurationService.testOnFilesConfigurationChange({ files: { hotExit: setting } });

			// Set empty workspace if required
			if (!workspace) {
				accessor.contextService.setWorkspace(new Workspace('empty:1508317022751'));
			}

			// Set multiple windows if required
			if (multipleWindows) {
				accessor.nativeHostService.windowCount = Promise.resolve(2);
			}

			// Set cancel to force a veto if hot exit does not trigger
			accessor.fileDialogService.setConfirmResult(ConfirmResult.CANCEL);

			await model?.resolve();
			model?.textEditorModel?.setValue('foo');
			assert.strictEqual(accessor.workingCopyService.dirtyCount, 1);

			const event = new TestBeforeShutdownEvent();
			event.reason = shutdownReason;
			accessor.lifecycleService.fireBeforeShutdown(event);

			const veto = await event.value;
			assert.ok(typeof event.finalValue === 'function'); // assert the tracker uses the internal finalVeto API
			assert.strictEqual(accessor.workingCopyBackupService.discardedBackups.length, 0); // When hot exit is set, backups should never be cleaned since the confirm result is cancel
			assert.strictEqual(veto, shouldVeto);

			await cleanup();
		}

		async function scratchpadHotExitTest(this: any, setting: string, shutdownReason: ShutdownReason, multipleWindows: boolean, workspace: boolean, shouldVeto: boolean): Promise<void> {
			const { accessor, cleanup } = await createTracker();

			class TestBackupWorkingCopy extends TestWorkingCopy {

				constructor(resource: URI) {
					super(resource);

					accessor.workingCopyService.registerWorkingCopy(this);
				}

				override capabilities = WorkingCopyCapabilities.Untitled | WorkingCopyCapabilities.Scratchpad;

				override isDirty(): boolean {
					return false;
				}

				override isModified(): boolean {
					return true;
				}
			}

			// Set hot exit config
			accessor.filesConfigurationService.testOnFilesConfigurationChange({ files: { hotExit: setting } });

			// Set empty workspace if required
			if (!workspace) {
				accessor.contextService.setWorkspace(new Workspace('empty:1508317022751'));
			}

			// Set multiple windows if required
			if (multipleWindows) {
				accessor.nativeHostService.windowCount = Promise.resolve(2);
			}

			// Set cancel to force a veto if hot exit does not trigger
			accessor.fileDialogService.setConfirmResult(ConfirmResult.CANCEL);

			const resource = toResource.call(this, '/path/custom.txt');
			new TestBackupWorkingCopy(resource);

			const event = new TestBeforeShutdownEvent();
			event.reason = shutdownReason;
			accessor.lifecycleService.fireBeforeShutdown(event);

			const veto = await event.value;
			assert.ok(typeof event.finalValue === 'function'); // assert the tracker uses the internal finalVeto API
			assert.strictEqual(accessor.workingCopyBackupService.discardedBackups.length, 0); // When hot exit is set, backups should never be cleaned since the confirm result is cancel
			assert.strictEqual(veto, shouldVeto);

			await cleanup();
		}
	});
});
