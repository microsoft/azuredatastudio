/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Schemas } from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';
import { localize } from 'vs/nls';
import { EditorInputCapabilities, IUntypedEditorInput } from 'vs/workbench/common/editor';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';

export class WorkspaceTrustEditorInput extends EditorInput {
	static readonly ID: string = 'workbench.input.workspaceTrust';

	override get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.Readonly | EditorInputCapabilities.Singleton;
	}

	override get typeId(): string {
		return WorkspaceTrustEditorInput.ID;
	}

	readonly resource: URI = URI.from({
		scheme: Schemas.vscodeWorkspaceTrust,
		path: `workspaceTrustEditor`
	});

	override matches(otherInput: EditorInput | IUntypedEditorInput): boolean {
		return super.matches(otherInput) || otherInput instanceof WorkspaceTrustEditorInput;
	}

	override getName(): string {
		return localize('workspaceTrustEditorInputName', "Workspace Trust");
	}
}
