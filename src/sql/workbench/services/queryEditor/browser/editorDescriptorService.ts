/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorInput } from 'vs/workbench/common/editor';
import { IEditorDescriptor, IEditorRegistry, Extensions } from 'vs/workbench/browser/editor';

import { Registry } from 'vs/platform/registry/common/platform';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export interface IEditorDescriptorService {
	_serviceBrand: undefined;

	getEditor(input: EditorInput): IEditorDescriptor | undefined;
}

export class EditorDescriptorService implements IEditorDescriptorService {
	public _serviceBrand: undefined;

	constructor() {
	}

	public getEditor(input: EditorInput): IEditorDescriptor | undefined {
		return Registry.as<IEditorRegistry>(Extensions.Editors).getEditor(input);
	}
}

export const SERVICE_ID = 'editorDescriptorService';

export const IEditorDescriptorService = createDecorator<IEditorDescriptorService>(SERVICE_ID);
