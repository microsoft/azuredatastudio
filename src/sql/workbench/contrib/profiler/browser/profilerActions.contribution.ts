/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { ServicesAccessor, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEditorService, ACTIVE_GROUP } from 'vs/workbench/services/editor/common/editorService';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ProfilerInput } from 'sql/workbench/browser/editor/profiler/profilerInput';
import * as TaskUtilities from 'sql/workbench/browser/taskUtilities';
import { IProfilerService, ProfilingSessionType } from 'sql/workbench/services/profiler/browser/interfaces';
import { KeybindingsRegistry, KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { ProfilerEditor } from 'sql/workbench/contrib/profiler/browser/profilerEditor';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { IConnectionDialogService } from 'sql/workbench/services/connection/common/connectionDialogService';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { IFileDialogService } from 'vs/platform/dialogs/common/dialogs';
import { IFileService } from 'vs/platform/files/common/files';
import { ILogService } from 'vs/platform/log/common/log';

CommandsRegistry.registerCommand({
	id: 'profiler.newProfiler',
	handler: (accessor: ServicesAccessor, ...args: any[]) => {
		let connectionProfile: ConnectionProfile = undefined;
		let instantiationService: IInstantiationService = accessor.get(IInstantiationService);
		let editorService: IEditorService = accessor.get(IEditorService);
		let connectionService: IConnectionManagementService = accessor.get(IConnectionManagementService);
		let objectExplorerService: IObjectExplorerService = accessor.get(IObjectExplorerService);
		let connectionDialogService: IConnectionDialogService = accessor.get(IConnectionDialogService);
		let capabilitiesService: ICapabilitiesService = accessor.get(ICapabilitiesService);
		let logService: ILogService = accessor.get(ILogService);

		// If a context is available if invoked from the context menu, we will use the connection profiler of the server node
		if (args[0]?.connectionProfile) {
			connectionProfile = ConnectionProfile.fromIConnectionProfile(capabilitiesService, args[0].connectionProfile);
		} else if (args[0]?.$treeItem.payload) {
			// Because this is contributed from core it doesn't go through the argument processor that extension commands do
			// so we just pull out the payload directly
			connectionProfile = ConnectionProfile.fromIConnectionProfile(capabilitiesService, args[0].$treeItem.payload);
		}
		else {
			// No context available, we will try to get the current global active connection
			connectionProfile = TaskUtilities.getCurrentGlobalConnection(objectExplorerService, connectionService, editorService, logService) as ConnectionProfile;
		}

		let promise;
		if (connectionProfile) {
			promise = connectionService.connectIfNotConnected(connectionProfile, 'connection', true);
		} else {
			// if still no luck, we will open the Connection dialog and let user connect to a server
			promise = connectionDialogService.openDialogAndWait(connectionService, { connectionType: 0, showDashboard: false, providers: [mssqlProviderName] }).then((profile) => {
				connectionProfile = profile as ConnectionProfile;
			});
		}

		return promise.then(() => {
			if (!connectionProfile) {
				connectionProfile = TaskUtilities.getCurrentGlobalConnection(objectExplorerService, connectionService, editorService, logService) as ConnectionProfile;
			}

			if (connectionProfile && connectionProfile.providerName === mssqlProviderName) {
				let profilerInput = instantiationService.createInstance(ProfilerInput, connectionProfile, undefined);
				editorService.openEditor(profilerInput, { pinned: true }, ACTIVE_GROUP).then(() => Promise.resolve(true));
			}
		});
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'profiler.newProfiler',
	weight: KeybindingWeight.BuiltinExtension,
	when: undefined,
	primary: KeyMod.Alt | KeyCode.KeyP,
	mac: { primary: KeyMod.WinCtrl | KeyMod.Alt | KeyCode.KeyP },
	handler: CommandsRegistry.getCommand('profiler.newProfiler').handler
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'profiler.toggleStartStop',
	weight: KeybindingWeight.EditorContrib,
	when: undefined,
	primary: KeyMod.Alt | KeyCode.KeyS,
	mac: { primary: KeyMod.WinCtrl | KeyMod.Alt | KeyCode.KeyS },
	handler: (accessor: ServicesAccessor) => {
		let profilerService: IProfilerService = accessor.get(IProfilerService);
		let editorService: IEditorService = accessor.get(IEditorService);

		let activeEditor = editorService.activeEditorPane;
		if (activeEditor instanceof ProfilerEditor) {
			let profilerInput = activeEditor.input;
			if (profilerInput.state.isRunning) {
				return profilerService.stopSession(profilerInput.id);
			} else {
				// clear data when profiler is started
				profilerInput.data.clear();
				return profilerService.startSession(profilerInput.id, profilerInput.sessionName, ProfilingSessionType.RemoteSession);
			}
		}
		return Promise.resolve(false);
	}
});

CommandsRegistry.registerCommand({
	id: 'profiler.openFile',
	handler: async (accessor: ServicesAccessor, ...args: any[]) => {
		const editorService: IEditorService = accessor.get(IEditorService);
		const fileDialogService: IFileDialogService = accessor.get(IFileDialogService);
		const profilerService: IProfilerService = accessor.get(IProfilerService);
		const instantiationService: IInstantiationService = accessor.get(IInstantiationService);
		const fileService: IFileService = accessor.get(IFileService);

		const result = await profilerService.openFile(fileDialogService, editorService, instantiationService, fileService);

		return result;
	}
});
