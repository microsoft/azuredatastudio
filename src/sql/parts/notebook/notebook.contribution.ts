/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorDescriptor, IEditorRegistry, Extensions as EditorExtensions } from 'vs/workbench/browser/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IWorkbenchActionRegistry, Extensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { Action } from 'vs/base/common/actions';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { TPromise } from 'vs/base/common/winjs.base';
import { Schemas } from 'vs/base/common/network';

import { NotebookInput, NotebookInputModel } from 'sql/parts/notebook/notebookInput';
import { NotebookEditor } from 'sql/parts/notebook/notebookEditor';
import URI from 'vs/base/common/uri';


let counter = 0;
import { localize } from 'vs/nls';
import * as types from 'vs/base/common/types';
import * as Constants from 'sql/parts/connection/common/constants';

import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { generateContainerTypeSchemaProperties } from 'sql/platform/dashboard/common/dashboardContainerRegistry';
import { ExtensionsRegistry, IExtensionPointUser } from 'vs/workbench/services/extensions/common/extensionsRegistry';

/**
 * todo: Will remove this code.
 * This is the entry point to open the new Notebook
 */
export class OpenNotebookAction extends Action {

	public static ID = 'OpenNotebookAction';
	public static LABEL = localize('OpenNotebookAction', 'Open Notebook editor');

	constructor(
		id: string,
		label: string,
		@IEditorService private _editorService: IEditorService
	) {
		super(id, label);
	}

	public run(): TPromise<void> {
		return new TPromise<void>((resolve, reject) => {
			let untitledUri = URI.from({ scheme: Schemas.untitled, path: `Untitled-${counter++}`});
			let model = new NotebookInputModel(untitledUri, undefined, false, undefined);
			let input = new NotebookInput('modelViewId', model,);
			this._editorService.openEditor(input, { pinned: true });
		});
	}
}

// Model View editor registration
const viewModelEditorDescriptor = new EditorDescriptor(
	NotebookEditor,
	NotebookEditor.ID,
	'Notebook'
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(viewModelEditorDescriptor, [new SyncDescriptor(NotebookInput)]);

// todo: Will remove this code.
// this is the entry point to open the new Notebook
let actionRegistry = <IWorkbenchActionRegistry>Registry.as(Extensions.WorkbenchActions);
actionRegistry.registerWorkbenchAction(
	new SyncActionDescriptor(
		OpenNotebookAction,
		OpenNotebookAction.ID,
		OpenNotebookAction.LABEL
	),
	OpenNotebookAction.LABEL
);

export interface INotebookTitleContrib {
	id: string;
	container: object;
	provider: string | string[];
	when?: string;
	alwaysShow?: boolean;
	description?: string;
}

const notebookTitleToolbarSchema: IJSONSchema = {
	type: 'object',
	properties: {
		id: {
			type: 'string',
			description: localize('sqlops.extension.contributes.notebook.title.id', "Unique identifier for this tab. Will be passed to the extension for any requests.")
		},
		description: {
			description: localize('sqlops.extension.contributes.notebook.title.description', "Description of this tab that will be shown to the user."),
			type: 'string'
		},
		when: {
			description: localize('sqlops.extension.contributes.tab.when', 'Condition which must be true to show this item'),
			type: 'string'
		},
		provider: {
			description: localize('sqlops.extension.contributes.tab.provider', 'Defines the connection types this tab is compatible with. Defaults to "MSSQL" if not set'),
			type: ['string', 'array']

		},
		container: {
			description: localize('sqlops.extension.contributes.notebook.title.container', "The container that will be displayed in this tab."),
			type: 'object',
			properties: generateContainerTypeSchemaProperties()
		},
		alwaysShow: {
			description: localize('sqlops.extension.contributes.notebook.title.alwaysShow', "Whether or not this tab should always be shown or only when the user adds it."),
			type: 'boolean'
		}
	}
};

const notebookTitleToolbarContributionSchema: IJSONSchema = {
	description: localize('sqlops.extension.contributes.notebook.title', "Contributes a single or multiple tabs for users to add to their dashboard."),
	oneOf: [
		notebookTitleToolbarSchema,
		{
			type: 'array',
			items: notebookTitleToolbarSchema
		}
	]
};

ExtensionsRegistry.registerExtensionPoint<INotebookTitleContrib | INotebookTitleContrib[]>('notebooktoolbar.title', [], notebookTitleToolbarContributionSchema).setHandler(extensions => {
	function handleCommand(tab: INotebookTitleContrib, extension: IExtensionPointUser<any>) {
		let { description, container, provider, when, id, alwaysShow } = tab;

		// If always show is not specified, set it to true by default.
		if (!types.isBoolean(alwaysShow)) {
			alwaysShow = true;
		}
		let publisher = extension.description.publisher;

		if (!description) {
			extension.collector.warn(localize('notebookToolbarTitle.contribution.noDescriptionWarning', 'No description specified to show.'));
		}

		if (!container) {
			extension.collector.error(localize('notebookToolbarTitle.contribution.noContainerError', 'No container specified for extension.'));
			return;
		}

		if (!provider) {
			// Use a default. Consider warning extension developers about this in the future if in development mode
			provider = Constants.mssqlProviderName;
		}

		if (Object.keys(container).length !== 1) {
			extension.collector.error(localize('notebookToolbarTitle.contribution.moreThanOneDashboardContainersError', 'Exactly 1 notebook toolbar container must be defined per space'));
			return;
		}

		let result = true;
		let containerkey = Object.keys(container)[0];
		let containerValue = Object.values(container)[0];

		// dashboardTab.contribution.ts as an example

		// now, add anything to the registry for the notebook title toolbar

		// now, handle the command (although we need to extend past commands here)
	}
});