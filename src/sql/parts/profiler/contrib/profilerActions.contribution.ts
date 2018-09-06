/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { ServicesAccessor, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import * as nls from 'vs/nls';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { IEditorService, ACTIVE_GROUP } from 'vs/workbench/services/editor/common/editorService';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import { IObjectExplorerService } from '../../objectExplorer/common/objectExplorerService';
import { ProfilerInput } from 'sql/parts/profiler/editor/profilerInput';
import { TPromise } from 'vs/base/common/winjs.base';
import * as TaskUtilities from 'sql/workbench/common/taskUtilities';
import { IProfilerService } from '../service/interfaces';
import { KeybindingsRegistry, KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { KeyCode, KeyMod } from 'vs/editor/editor.api';
import { ProfilerEditor } from '../editor/profilerEditor';

// Contribute Global Actions
const category = nls.localize('profilerCategory', "Profiler");

const newProfilerSchema: IJSONSchema = {
	description: nls.localize('carbon.actions.newProfiler', 'Open up a new profiler window'),
	type: 'null',
	default: null
};

CommandsRegistry.registerCommand({
	id: 'profiler.newProfiler',
	handler: (accessor: ServicesAccessor) => {
		let editorService: IEditorService = accessor.get(IEditorService);
		let instantiationService: IInstantiationService = accessor.get(IInstantiationService);
		let connectionService: IConnectionManagementService = accessor.get(IConnectionManagementService);
		let objectExplorerService: IObjectExplorerService = accessor.get(IObjectExplorerService);

		let connectionProfile = TaskUtilities.getCurrentGlobalConnection(objectExplorerService, connectionService, editorService);
		let profilerInput = instantiationService.createInstance(ProfilerInput, connectionProfile);
		return editorService.openEditor(profilerInput, { pinned: true }, ACTIVE_GROUP).then(() => TPromise.as(true));
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'profiler.newProfiler',
	weight: KeybindingWeight.BuiltinExtension,
	when: undefined,
	primary: KeyMod.Alt | KeyCode.KEY_P,
	mac: { primary: KeyMod.WinCtrl | KeyMod.Alt | KeyCode.KEY_P },
	handler: CommandsRegistry.getCommand('profiler.newProfiler').handler
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'profiler.toggleStartStop',
	weight: KeybindingWeight.EditorContrib,
	when: undefined,
	primary: KeyMod.Alt | KeyCode.KEY_S,
	mac: { primary: KeyMod.WinCtrl | KeyMod.Alt | KeyCode.KEY_S },
	handler: (accessor: ServicesAccessor) => {
		let profilerService: IProfilerService = accessor.get(IProfilerService);
		let editorService: IEditorService = accessor.get(IEditorService);

		let activeEditor = editorService.activeControl;
		if (activeEditor instanceof ProfilerEditor) {
			let profilerInput = activeEditor.input;
			if (profilerInput.state.isRunning) {
				return profilerService.stopSession(profilerInput.id);
			} else {
				// clear data when profiler is started
				profilerInput.data.clear();
				return profilerService.startSession(profilerInput.id, profilerInput.sessionName);
			}
		}
		return TPromise.as(false);
	}
});
