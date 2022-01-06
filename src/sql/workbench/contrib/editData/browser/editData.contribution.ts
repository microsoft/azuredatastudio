/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditDataEditor } from 'sql/workbench/contrib/editData/browser/editDataEditor';
import { EditDataInput } from 'sql/workbench/browser/editData/editDataInput';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { EditDataResultsEditor } from 'sql/workbench/contrib/editData/browser/editDataResultsEditor';
import { EditDataResultsInput } from 'sql/workbench/browser/editData/editDataResultsInput';
import { EditorPaneDescriptor, IEditorPaneRegistry } from 'vs/workbench/browser/editor';
import { EditorExtensions } from 'vs/workbench/common/editor';
import { IConfigurationRegistry, Extensions as ConfigExtensions } from 'vs/platform/configuration/common/configurationRegistry';
import { Registry } from 'vs/platform/registry/common/platform';
import { KeybindingsRegistry, KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import * as editDataActions from 'sql/workbench/contrib/editData/browser/editDataActions';
import * as nls from 'vs/nls';

// Editor
const editDataEditorDescriptor = EditorPaneDescriptor.create(
	EditDataEditor,
	EditDataEditor.ID,
	'EditData'
);

const configurationRegistry = <IConfigurationRegistry>Registry.as(ConfigExtensions.Configuration);
configurationRegistry.registerConfiguration({
	'id': 'showEditDataSqlPaneOnStartup',
	'title': nls.localize('showEditDataSqlPaneOnStartup', 'Show Edit Data SQL pane on startup'),
	'type': 'object',
	'properties': {
		'editor.showEditDataSqlPaneOnStartup': {
			'type': 'boolean',
			'default': false,
			'description': nls.localize('showEditDataSqlPaneOnStartup', 'Show Edit Data SQL pane on startup')
		}
	}
});

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane)
	.registerEditorPane(editDataEditorDescriptor, [new SyncDescriptor(EditDataInput)]);

// Editor
const editDataResultsEditorDescriptor = EditorPaneDescriptor.create(
	EditDataResultsEditor,
	EditDataResultsEditor.ID,
	'EditDataResults'
);

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane)
	.registerEditorPane(editDataResultsEditorDescriptor, [new SyncDescriptor(EditDataResultsInput)]);

// Keybinding for toggling the query pane
KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: editDataActions.ShowQueryPaneAction.ID,
	weight: KeybindingWeight.EditorContrib,
	when: undefined,
	primary: undefined,
	handler: accessor => {
		const activeEditDataEditor = accessor.get(IEditorService).activeEditorPane;
		if (activeEditDataEditor instanceof EditDataEditor) {
			activeEditDataEditor.runShowQueryPane();
		}
	}
});
