/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorExtensions } from 'vs/workbench/common/editor';
import { FileEditorInput } from 'vs/workbench/contrib/files/browser/editors/fileEditorInput';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IEditorRegistry, EditorDescriptor } from 'vs/workbench/browser/editor';
import { TextFileEditor } from 'vs/workbench/contrib/files/browser/editors/textFileEditor';

// Register file editor
Registry.as<IEditorRegistry>(EditorExtensions.Editors).registerEditor(
	EditorDescriptor.create(
		TextFileEditor,
		TextFileEditor.ID,
		localize('textFileEditor', "Text File Editor")
	),
	[
		new SyncDescriptor(FileEditorInput)
	]
);
