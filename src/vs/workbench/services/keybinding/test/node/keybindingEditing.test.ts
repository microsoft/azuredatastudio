/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import assert = require('assert');
import os = require('os');
import path = require('path');
import fs = require('fs');
import * as json from 'vs/base/common/json';
import { OS } from 'vs/base/common/platform';
import { USLayoutResolvedKeybinding } from 'vs/platform/keybinding/common/usLayoutResolvedKeybinding';
import { TPromise } from 'vs/base/common/winjs.base';
import { KeyCode, SimpleKeybinding, ChordKeybinding } from 'vs/base/common/keyCodes';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import extfs = require('vs/base/node/extfs');
import { TestTextFileService, TestEditorGroupService, TestLifecycleService, TestBackupFileService, TestContextService, TestTextResourceConfigurationService, TestHashService } from 'vs/workbench/test/workbenchTestServices';
import { IWorkspaceContextService, Workspace, toWorkspaceFolders } from 'vs/platform/workspace/common/workspace';
import uuid = require('vs/base/common/uuid');
import { ConfigurationService } from 'vs/platform/configuration/node/configurationService';
import { FileService } from 'vs/workbench/services/files/node/fileService';
import { IFileService } from 'vs/platform/files/common/files';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IUntitledEditorService, UntitledEditorService } from 'vs/workbench/services/untitled/common/untitledEditorService';
import { ILifecycleService } from 'vs/platform/lifecycle/common/lifecycle';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { NullTelemetryService } from 'vs/platform/telemetry/common/telemetryUtils';
import { IBackupFileService } from 'vs/workbench/services/backup/common/backup';
import { IEditorGroupService } from 'vs/workbench/services/group/common/groupService';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { TextModelResolverService } from 'vs/workbench/services/textmodelResolver/common/textModelResolverService';
import { IModeService } from 'vs/editor/common/services/modeService';
import { ModeServiceImpl } from 'vs/editor/common/services/modeServiceImpl';
import { IModelService } from 'vs/editor/common/services/modelService';
import { ModelServiceImpl } from 'vs/editor/common/services/modelServiceImpl';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { KeybindingsEditingService } from 'vs/workbench/services/keybinding/common/keybindingEditing';
import { IUserFriendlyKeybinding } from 'vs/platform/keybinding/common/keybinding';
import { ResolvedKeybindingItem } from 'vs/platform/keybinding/common/resolvedKeybindingItem';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { IHashService } from 'vs/workbench/services/hash/common/hashService';
import { mkdirp } from 'vs/base/node/pfs';

interface Modifiers {
	metaKey?: boolean;
	ctrlKey?: boolean;
	altKey?: boolean;
	shiftKey?: boolean;
}

suite('Keybindings Editing', () => {
	test('errors cases - parse errors', () => {
	});
});
