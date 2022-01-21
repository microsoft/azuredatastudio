/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { URI } from 'vs/base/common/uri';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { workbenchInstantiationService } from 'vs/workbench/test/browser/workbenchTestServices';
import { IDialogService, IFileDialogService, IOpenDialogOptions, ISaveDialogOptions } from 'vs/platform/dialogs/common/dialogs';
import { Schemas } from 'vs/base/common/network';
import { BrowserWorkspaceEditingService } from 'vs/workbench/services/workspaces/browser/workspaceEditingService';
import { IWorkspaceEditingService } from 'vs/workbench/services/workspaces/common/workspaceEditing';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IPathService } from 'vs/workbench/services/path/common/pathService';
import { FileDialogService } from 'vs/workbench/services/dialogs/electron-sandbox/fileDialogService';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { mock } from 'vs/base/test/common/mock';
import { BrowserWorkbenchEnvironmentService } from 'vs/workbench/services/environment/browser/environmentService';
import { IModeService } from 'vs/editor/common/services/modeService';
import { IFileService } from 'vs/platform/files/common/files';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ILabelService } from 'vs/platform/label/common/label';
import { INativeHostService } from 'vs/platform/native/electron-sandbox/native';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IWorkspacesService } from 'vs/platform/workspaces/common/workspaces';
import { IHistoryService } from 'vs/workbench/services/history/common/history';
import { IHostService } from 'vs/workbench/services/host/browser/host';
import { SimpleFileDialog } from 'vs/workbench/services/dialogs/browser/simpleFileDialog';

class TestFileDialogService extends FileDialogService {
	constructor(
		private simple: SimpleFileDialog,
		@IHostService hostService: IHostService,
		@IWorkspaceContextService contextService: IWorkspaceContextService,
		@IHistoryService historyService: IHistoryService,
		@IWorkbenchEnvironmentService environmentService: IWorkbenchEnvironmentService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IConfigurationService configurationService: IConfigurationService,
		@IFileService fileService: IFileService,
		@IOpenerService openerService: IOpenerService,
		@INativeHostService nativeHostService: INativeHostService,
		@IDialogService dialogService: IDialogService,
		@IModeService modeService: IModeService,
		@IWorkspacesService workspacesService: IWorkspacesService,
		@ILabelService labelService: ILabelService,
		@IPathService pathService: IPathService
	) {
		super(hostService, contextService, historyService, environmentService, instantiationService, configurationService, fileService,
			openerService, nativeHostService, dialogService, modeService, workspacesService, labelService, pathService);
	}

	protected override getSimpleFileDialog() {
		if (this.simple) {
			return this.simple;
		} else {
			return super.getSimpleFileDialog();
		}
	}
}

suite('FileDialogService', function () {

	let instantiationService: TestInstantiationService;
	const testFile: URI = URI.file('/test/file');

	setup(async function () {
		instantiationService = <TestInstantiationService>workbenchInstantiationService();
		const configurationService = new TestConfigurationService();
		await configurationService.setUserConfiguration('files', { simpleDialog: { enable: true } });
		instantiationService.stub(IConfigurationService, configurationService);

	});

	test('Local - open/save workspaces availableFilesystems', async function () {
		class TestSimpleFileDialog {
			async showOpenDialog(options: IOpenDialogOptions): Promise<URI | undefined> {
				assert.strictEqual(options.availableFileSystems?.length, 1);
				assert.strictEqual(options.availableFileSystems[0], Schemas.file);
				return testFile;
			}
			async showSaveDialog(options: ISaveDialogOptions): Promise<URI | undefined> {
				assert.strictEqual(options.availableFileSystems?.length, 1);
				assert.strictEqual(options.availableFileSystems[0], Schemas.file);
				return testFile;
			}
		}

		const dialogService = instantiationService.createInstance(TestFileDialogService, new TestSimpleFileDialog());
		instantiationService.set(IFileDialogService, dialogService);
		const workspaceService: IWorkspaceEditingService = instantiationService.createInstance(BrowserWorkspaceEditingService);
		assert.strictEqual((await workspaceService.pickNewWorkspacePath())?.path.startsWith(testFile.path), true);
		assert.strictEqual(await dialogService.pickWorkspaceAndOpen({}), undefined);
	});

	test('Virtual - open/save workspaces availableFilesystems', async function () {
		class TestSimpleFileDialog {
			async showOpenDialog(options: IOpenDialogOptions): Promise<URI | undefined> {
				assert.strictEqual(options.availableFileSystems?.length, 1);
				assert.strictEqual(options.availableFileSystems[0], Schemas.file);
				return testFile;
			}
			async showSaveDialog(options: ISaveDialogOptions): Promise<URI | undefined> {
				assert.strictEqual(options.availableFileSystems?.length, 1);
				assert.strictEqual(options.availableFileSystems[0], Schemas.file);
				return testFile;
			}
		}

		instantiationService.stub(IPathService, new class {
			defaultUriScheme: string = 'vscode-virtual-test';
			userHome = async () => URI.file('/user/home');
		});
		const dialogService = instantiationService.createInstance(TestFileDialogService, new TestSimpleFileDialog());
		instantiationService.set(IFileDialogService, dialogService);
		const workspaceService: IWorkspaceEditingService = instantiationService.createInstance(BrowserWorkspaceEditingService);
		assert.strictEqual((await workspaceService.pickNewWorkspacePath())?.path.startsWith(testFile.path), true);
		assert.strictEqual(await dialogService.pickWorkspaceAndOpen({}), undefined);
	});

	test('Remote - open/save workspaces availableFilesystems', async function () {
		class TestSimpleFileDialog {
			async showOpenDialog(options: IOpenDialogOptions): Promise<URI | undefined> {
				assert.strictEqual(options.availableFileSystems?.length, 2);
				assert.strictEqual(options.availableFileSystems[0], Schemas.vscodeRemote);
				assert.strictEqual(options.availableFileSystems[1], Schemas.file);
				return testFile;
			}
			async showSaveDialog(options: ISaveDialogOptions): Promise<URI | undefined> {
				assert.strictEqual(options.availableFileSystems?.length, 2);
				assert.strictEqual(options.availableFileSystems[0], Schemas.vscodeRemote);
				assert.strictEqual(options.availableFileSystems[1], Schemas.file);
				return testFile;
			}
		}

		instantiationService.set(IWorkbenchEnvironmentService, new class extends mock<BrowserWorkbenchEnvironmentService>() {
			override get remoteAuthority() {
				return 'testRemote';
			}
		});
		instantiationService.stub(IPathService, new class {
			defaultUriScheme: string = Schemas.vscodeRemote;
			userHome = async () => URI.file('/user/home');
		});
		const dialogService = instantiationService.createInstance(TestFileDialogService, new TestSimpleFileDialog());
		instantiationService.set(IFileDialogService, dialogService);
		const workspaceService: IWorkspaceEditingService = instantiationService.createInstance(BrowserWorkspaceEditingService);
		assert.strictEqual((await workspaceService.pickNewWorkspacePath())?.path.startsWith(testFile.path), true);
		assert.strictEqual(await dialogService.pickWorkspaceAndOpen({}), undefined);
	});
});
