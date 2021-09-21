/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TableDesignerInput } from 'sql/workbench/browser/editor/tableDesigner/tableDesignerInput';
import { TableDesignerEditor } from 'sql/workbench/contrib/tableDesigner/browser/tableDesignerEditor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorDescriptor, IEditorRegistry } from 'vs/workbench/browser/editor';
import { EditorExtensions } from 'vs/workbench/common/editor';

const tableDesignerDescriptor = EditorDescriptor.create(
	TableDesignerEditor,
	TableDesignerEditor.ID,
	'TableDesignerEditor'
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(tableDesignerDescriptor, [new SyncDescriptor(TableDesignerInput)]);
