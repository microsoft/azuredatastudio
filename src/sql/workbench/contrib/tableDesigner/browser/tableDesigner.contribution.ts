/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TableDesignerInput } from 'sql/workbench/browser/editor/tableDesigner/tableDesignerInput';
import { TableDesignerEditor } from 'sql/workbench/contrib/tableDesigner/browser/tableDesignerEditor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorPaneDescriptor, IEditorPaneRegistry } from 'vs/workbench/browser/editor';
import { EditorExtensions } from 'vs/workbench/common/editor';

const tableDesignerDescriptor = EditorPaneDescriptor.create(
	TableDesignerEditor,
	TableDesignerEditor.ID,
	'TableDesignerEditor'
);

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane)
	.registerEditorPane(tableDesignerDescriptor, [new SyncDescriptor(TableDesignerInput)]);
