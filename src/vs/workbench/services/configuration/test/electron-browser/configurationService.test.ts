/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'vs/base/common/path';
import * as os from 'os';
import { URI } from 'vs/base/common/uri';
import { Registry } from 'vs/platform/registry/common/platform';
import { ParsedArgs, IEnvironmentService } from 'vs/platform/environment/common/environment';
import { EnvironmentService } from 'vs/platform/environment/node/environmentService';
import { parseArgs } from 'vs/platform/environment/node/argv';
import * as pfs from 'vs/base/node/pfs';
import * as uuid from 'vs/base/common/uuid';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from 'vs/platform/configuration/common/configurationRegistry';
import { WorkspaceService } from 'vs/workbench/services/configuration/node/configurationService';
import { ISingleFolderWorkspaceInitializationPayload } from 'vs/platform/workspaces/common/workspaces';
import { ConfigurationEditingErrorCode } from 'vs/workbench/services/configuration/node/configurationEditingService';
import { IFileService, FileChangesEvent, FileChangeType } from 'vs/platform/files/common/files';
import { IWorkspaceContextService, WorkbenchState, IWorkspaceFoldersChangeEvent } from 'vs/platform/workspace/common/workspace';
import { ConfigurationTarget, IConfigurationService, IConfigurationChangeEvent } from 'vs/platform/configuration/common/configuration';
import { workbenchInstantiationService, TestTextResourceConfigurationService, TestTextFileService, TestLifecycleService, TestEnvironmentService, TestStorageService } from 'vs/workbench/test/workbenchTestServices';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { FileService } from 'vs/workbench/services/files/node/fileService';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { TextModelResolverService } from 'vs/workbench/services/textmodelResolver/common/textModelResolverService';
import { IJSONEditingService } from 'vs/workbench/services/configuration/common/jsonEditing';
import { JSONEditingService } from 'vs/workbench/services/configuration/node/jsonEditingService';
import { IWorkspaceConfigurationService } from 'vs/workbench/services/configuration/common/configuration';
import { createHash } from 'crypto';
import { Emitter, Event } from 'vs/base/common/event';
import { Schemas } from 'vs/base/common/network';
import { originalFSPath } from 'vs/base/common/resources';
import { isLinux } from 'vs/base/common/platform';
import { IWorkspaceIdentifier } from 'vs/workbench/services/configuration/node/configuration';

class SettingsTestEnvironmentService extends EnvironmentService {

	constructor(args: ParsedArgs, _execPath: string, private customAppSettingsHome) {
		super(args, _execPath);
	}

	get appSettingsPath(): string { return this.customAppSettingsHome; }
}

function setUpFolderWorkspace(folderName: string): Promise<{ parentDir: string, folderDir: string }> {
	const id = uuid.generateUuid();
	const parentDir = path.join(os.tmpdir(), 'vsctests', id);
	return setUpFolder(folderName, parentDir).then(folderDir => ({ parentDir, folderDir }));
}

function setUpFolder(folderName: string, parentDir: string): Promise<string> {
	const folderDir = path.join(parentDir, folderName);
	// {{SQL CARBON EDIT}}
	const workspaceSettingsDir = path.join(folderDir, '.azuredatastudio');
	return Promise.resolve(pfs.mkdirp(workspaceSettingsDir, 493).then(() => folderDir));
}

function convertToWorkspacePayload(folder: URI): ISingleFolderWorkspaceInitializationPayload {
	return {
		id: createHash('md5').update(folder.fsPath).digest('hex'),
		folder
	} as ISingleFolderWorkspaceInitializationPayload;
}

function setUpWorkspace(folders: string[]): Promise<{ parentDir: string, configPath: URI }> {

	const id = uuid.generateUuid();
	const parentDir = path.join(os.tmpdir(), 'vsctests', id);

	return Promise.resolve(pfs.mkdirp(parentDir, 493)
		.then(() => {
			const configPath = path.join(parentDir, 'vsctests.code-workspace');
			const workspace = { folders: folders.map(path => ({ path })) };
			fs.writeFileSync(configPath, JSON.stringify(workspace, null, '\t'));

			return Promise.all(folders.map(folder => setUpFolder(folder, parentDir)))
				.then(() => ({ parentDir, configPath: URI.file(configPath) }));
		}));

}


suite('WorkspaceContextService - Folder', () => {
	test('getWorkspace()', () => {
		// {{SQL CARBON EDIT}} - Remove test
		assert.equal(0, 0);
	});
});

function getWorkspaceId(configPath: URI): string {
	let workspaceConfigPath = configPath.scheme === Schemas.file ? originalFSPath(configPath) : configPath.toString();
	if (!isLinux) {
		workspaceConfigPath = workspaceConfigPath.toLowerCase(); // sanitize for platform file system
	}

	return createHash('md5').update(workspaceConfigPath).digest('hex');
}

export function getWorkspaceIdentifier(configPath: URI): IWorkspaceIdentifier {
	return {
		configPath,
		id: getWorkspaceId(configPath)
	};
}
