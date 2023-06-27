/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEditorSerializer } from 'vs/workbench/common/editor';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { ISerializedTerminalEditorInput, ITerminalEditorService, ITerminalInstance } from 'vs/workbench/contrib/terminal/browser/terminal';
import { TerminalEditorInput } from 'vs/workbench/contrib/terminal/browser/terminalEditorInput';

export class TerminalInputSerializer implements IEditorSerializer {
	constructor(
		@ITerminalEditorService private readonly _terminalEditorService: ITerminalEditorService
	) { }

	public canSerialize(editorInput: TerminalEditorInput): boolean {
		return !!editorInput.terminalInstance?.persistentProcessId;
	}

	public serialize(editorInput: TerminalEditorInput): string | undefined {
		if (!editorInput.terminalInstance?.persistentProcessId || !editorInput.terminalInstance.shouldPersist) {
			return undefined; // {{SQL CARBON EDIT}} strict-nulls
		}
		const term = JSON.stringify(this._toJson(editorInput.terminalInstance));
		return term;
	}

	public deserialize(instantiationService: IInstantiationService, serializedEditorInput: string): EditorInput | undefined {
		const terminalInstance = JSON.parse(serializedEditorInput);
		return this._terminalEditorService.reviveInput(terminalInstance);
	}

	private _toJson(instance: ITerminalInstance): ISerializedTerminalEditorInput {
		return {
			id: instance.persistentProcessId!,
			pid: instance.processId || 0,
			title: instance.title,
			titleSource: instance.titleSource,
			cwd: '',
			icon: instance.icon,
			color: instance.color,
			hasChildProcesses: instance.hasChildProcesses,
			isFeatureTerminal: instance.shellLaunchConfig.isFeatureTerminal,
			hideFromUser: instance.shellLaunchConfig.hideFromUser,
			reconnectionProperties: instance.shellLaunchConfig.reconnectionProperties,
			shellIntegrationNonce: instance.shellIntegrationNonce
		};
	}
}
