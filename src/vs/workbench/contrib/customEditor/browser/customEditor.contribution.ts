/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Schemas } from 'vs/base/common/network';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorDescriptor, Extensions as EditorExtensions, IEditorRegistry } from 'vs/workbench/browser/editor';
import { Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry } from 'vs/workbench/common/contributions';
import { Extensions as EditorInputExtensions, IEditorInputFactoryRegistry } from 'vs/workbench/common/editor';
import { customEditorInputFactory, CustomEditorInputFactory } from 'vs/workbench/contrib/customEditor/browser/customEditorInputFactory';
import { ICustomEditorService } from 'vs/workbench/contrib/customEditor/common/customEditor';
import { WebviewEditor } from 'vs/workbench/contrib/webviewPanel/browser/webviewEditor';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { CustomEditorInput } from './customEditorInput';
import { CustomEditorContribution, CustomEditorService } from './customEditors';

registerSingleton(ICustomEditorService, CustomEditorService);

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(CustomEditorContribution, LifecyclePhase.Starting);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(
		EditorDescriptor.create(
			WebviewEditor,
			WebviewEditor.ID,
			'Webview Editor',
		), [
		new SyncDescriptor(CustomEditorInput)
	]);

Registry.as<IEditorInputFactoryRegistry>(EditorInputExtensions.EditorInputFactories)
	.registerEditorInputFactory(
		CustomEditorInputFactory.ID,
		CustomEditorInputFactory);

Registry.as<IEditorInputFactoryRegistry>(EditorInputExtensions.EditorInputFactories)
	.registerCustomEditorInputFactory(Schemas.vscodeCustomEditor, customEditorInputFactory);
