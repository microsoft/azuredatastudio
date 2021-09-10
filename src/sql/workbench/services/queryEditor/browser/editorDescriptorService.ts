/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorExtensions } from 'vs/workbench/common/editor';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { IEditorPaneDescriptor, IEditorPaneRegistry } from 'vs/workbench/browser/editor';

import { Registry } from 'vs/platform/registry/common/platform';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export interface IEditorDescriptorService {
	_serviceBrand: undefined;

	getEditor(input: EditorInput): IEditorPaneDescriptor | undefined;
}

export class EditorDescriptorService implements IEditorDescriptorService {
	public _serviceBrand: undefined;

	constructor() {
	}

	public getEditor(input: EditorInput): IEditorPaneDescriptor | undefined {
		return Registry.as<IEditorPaneRegistry>(EditorExtensions.Editors).getEditorPane(input);
	}
}

export const SERVICE_ID = 'editorDescriptorService';

export const IEditorDescriptorService = createDecorator<IEditorDescriptorService>(SERVICE_ID);
