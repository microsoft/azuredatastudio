/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { URI } from 'vs/base/common/uri';
import { EditorInputCapabilities, IUntypedEditorInput } from 'vs/workbench/common/editor';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';

export class RuntimeExtensionsInput extends EditorInput {

	static readonly ID = 'workbench.runtimeExtensions.input';

	override get typeId(): string {
		return RuntimeExtensionsInput.ID;
	}

	override get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.Readonly | EditorInputCapabilities.Singleton;
	}

	static _instance: RuntimeExtensionsInput;
	static get instance() {
		if (!RuntimeExtensionsInput._instance || RuntimeExtensionsInput._instance.isDisposed()) {
			RuntimeExtensionsInput._instance = new RuntimeExtensionsInput();
		}

		return RuntimeExtensionsInput._instance;
	}

	readonly resource = URI.from({
		scheme: 'runtime-extensions',
		path: 'default'
	});

	override getName(): string {
		return nls.localize('extensionsInputName', "Running Extensions");
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		if (super.matches(other)) {
			return true;
		}
		return other instanceof RuntimeExtensionsInput;
	}
}
