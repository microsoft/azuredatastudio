/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import URI from 'vs/base/common/uri';
import { TPromise } from 'vs/base/common/winjs.base';
import { Registry } from 'vs/platform/registry/common/platform';
import { ParsedArgs, IEnvironmentService } from 'vs/platform/environment/common/environment';
import { EnvironmentService } from 'vs/platform/environment/node/environmentService';
import { parseArgs } from 'vs/platform/environment/node/argv';
import extfs = require('vs/base/node/extfs');
import uuid = require('vs/base/common/uuid');
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from 'vs/platform/configuration/common/configurationRegistry';
import { WorkspaceService } from 'vs/workbench/services/configuration/node/configurationService';
import { ConfigurationEditingErrorCode } from 'vs/workbench/services/configuration/node/configurationEditingService';
import { FileChangeType, FileChangesEvent, IFileService } from 'vs/platform/files/common/files';
import { IWorkspaceContextService, WorkbenchState, IWorkspaceFoldersChangeEvent } from 'vs/platform/workspace/common/workspace';
import { ConfigurationTarget, IConfigurationService, IConfigurationChangeEvent } from 'vs/platform/configuration/common/configuration';
import { workbenchInstantiationService, TestTextResourceConfigurationService, TestTextFileService, TestLifecycleService, TestEnvironmentService } from 'vs/workbench/test/workbenchTestServices';
import { FileService } from 'vs/workbench/services/files/node/fileService';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { TextModelResolverService } from 'vs/workbench/services/textmodelResolver/common/textModelResolverService';
import { IJSONEditingService } from 'vs/workbench/services/configuration/common/jsonEditing';
import { JSONEditingService } from 'vs/workbench/services/configuration/node/jsonEditingService';
import { IWorkspaceConfigurationService } from 'vs/workbench/services/configuration/common/configuration';
import { IWindowConfiguration } from 'vs/platform/windows/common/windows';
import { mkdirp } from 'vs/base/node/pfs';

class SettingsTestEnvironmentService extends EnvironmentService {

	constructor(args: ParsedArgs, _execPath: string, private customAppSettingsHome) {
		super(args, _execPath);
	}

	get appSettingsPath(): string { return this.customAppSettingsHome; }
}

function setUpFolderWorkspace(folderName: string): TPromise<{ parentDir: string, folderDir: string }> {
	const id = uuid.generateUuid();
	const parentDir = path.join(os.tmpdir(), 'vsctests', id);
	return setUpFolder(folderName, parentDir).then(folderDir => ({ parentDir, folderDir }));
}

function setUpFolder(folderName: string, parentDir: string): TPromise<string> {
	const folderDir = path.join(parentDir, folderName);
	// {{SQL CARBON EDIT}}
	const workspaceSettingsDir = path.join(folderDir, '.sqlops');
	return mkdirp(workspaceSettingsDir, 493).then(() => folderDir);
}

function setUpWorkspace(folders: string[]): TPromise<{ parentDir: string, configPath: string }> {

	const id = uuid.generateUuid();
	const parentDir = path.join(os.tmpdir(), 'vsctests', id);

	return mkdirp(parentDir, 493)
		.then(() => {
			const configPath = path.join(parentDir, 'vsctests.code-workspace');
			const workspace = { folders: folders.map(path => ({ path })) };
			fs.writeFileSync(configPath, JSON.stringify(workspace, null, '\t'));

			return TPromise.join(folders.map(folder => setUpFolder(folder, parentDir)))
				.then(() => ({ parentDir, configPath }));
		});

}


suite('WorkspaceContextService - Folder', () => {
	test('getWorkspace()', () => {
		assert.equal(0, 0);
	});
});
