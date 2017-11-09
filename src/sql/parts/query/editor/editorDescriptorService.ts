/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorInput, Extensions, IEditorRegistry, IEditorDescriptor } from 'vs/workbench/common/editor';
import { Registry } from 'vs/platform/registry/common/platform';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export interface IEditorDescriptorService {
	getEditor(input: EditorInput): IEditorDescriptor;
}

export class EditorDescriptorService implements IEditorDescriptorService {

	constructor() {
	}

	public getEditor(input: EditorInput): IEditorDescriptor {
		return Registry.as<IEditorRegistry>(Extensions.Editors).getEditor(input);
	}
}

export const SERVICE_ID = 'editorDescriptorService';

export const IEditorDescriptorService  = createDecorator<IEditorDescriptorService >(SERVICE_ID);