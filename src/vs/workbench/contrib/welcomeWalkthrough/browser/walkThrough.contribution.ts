/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { WalkThroughInput } from 'vs/workbench/contrib/welcomeWalkthrough/browser/walkThroughInput';
import { WalkThroughPart } from 'vs/workbench/contrib/welcomeWalkthrough/browser/walkThroughPart';
import { WalkThroughArrowUp, WalkThroughArrowDown, WalkThroughPageUp, WalkThroughPageDown } from 'vs/workbench/contrib/welcomeWalkthrough/browser/walkThroughActions';
import { WalkThroughSnippetContentProvider } from 'vs/workbench/contrib/welcomeWalkthrough/common/walkThroughContentProvider';
import { EditorWalkThroughAction, EditorWalkThroughInputSerializer } from 'vs/workbench/contrib/welcomeWalkthrough/browser/editor/editorWalkThrough';
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorExtensions, IEditorFactoryRegistry } from 'vs/workbench/common/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { registerAction2 } from 'vs/platform/actions/common/actions';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { IEditorPaneRegistry, EditorPaneDescriptor } from 'vs/workbench/browser/editor';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { KeybindingsRegistry } from 'vs/platform/keybinding/common/keybindingsRegistry';

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane)
	.registerEditorPane(EditorPaneDescriptor.create(
		WalkThroughPart,
		WalkThroughPart.ID,
		localize('walkThrough.editor.label', "Playground"),
	),
		[new SyncDescriptor(WalkThroughInput)]);

registerAction2(EditorWalkThroughAction);

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(EditorWalkThroughInputSerializer.ID, EditorWalkThroughInputSerializer);

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(WalkThroughSnippetContentProvider, LifecyclePhase.Ready /* cannot be on a later phase because an editor might need this on startup */);

KeybindingsRegistry.registerCommandAndKeybindingRule(WalkThroughArrowUp);

KeybindingsRegistry.registerCommandAndKeybindingRule(WalkThroughArrowDown);

KeybindingsRegistry.registerCommandAndKeybindingRule(WalkThroughPageUp);

KeybindingsRegistry.registerCommandAndKeybindingRule(WalkThroughPageDown);

/*MenuRegistry.appendMenuItem(MenuId.MenubarHelpMenu, { {{SQL CARBON EDIT}} remove menu item
	group: '1_welcome',
	command: {
		id: 'workbench.action.showInteractivePlayground',
		title: localize({ key: 'miPlayground', comment: ['&& denotes a mnemonic'] }, "Editor Playgrou&&nd")
	},
	order: 3
});*/
