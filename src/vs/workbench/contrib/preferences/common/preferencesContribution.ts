/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DisposableStore, dispose, IDisposable } from 'vs/base/common/lifecycle';
import { isEqual } from 'vs/base/common/resources';
import { URI } from 'vs/base/common/uri';
import { ITextModel } from 'vs/editor/common/model';
import { IModelService } from 'vs/editor/common/services/modelService';
import { IModeService } from 'vs/editor/common/services/modeService';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import * as nls from 'vs/nls';
import { ConfigurationTarget, IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ConfigurationScope, Extensions, IConfigurationRegistry } from 'vs/platform/configuration/common/configurationRegistry';
import { IEditorOptions } from 'vs/platform/editor/common/editor';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import * as JSONContributionRegistry from 'vs/platform/jsonschemas/common/jsonContributionRegistry';
import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkspaceContextService, WorkbenchState } from 'vs/platform/workspace/common/workspace';
import { workbenchConfigurationNodeBase } from 'vs/workbench/common/configuration';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IEditorInputWithOptions } from 'vs/workbench/common/editor';
import { IEditorGroup } from 'vs/workbench/services/editor/common/editorGroupsService';
import { ContributedEditorPriority, IEditorOverrideService } from 'vs/workbench/services/editor/common/editorOverrideService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { FOLDER_SETTINGS_PATH, IPreferencesService, USE_SPLIT_JSON_SETTING } from 'vs/workbench/services/preferences/common/preferences';
import { PreferencesEditorInput } from 'vs/workbench/services/preferences/common/preferencesEditorInput';

const schemaRegistry = Registry.as<JSONContributionRegistry.IJSONContributionRegistry>(JSONContributionRegistry.Extensions.JSONContribution);

export class PreferencesContribution implements IWorkbenchContribution {
	private editorOpeningListener: IDisposable | undefined;
	private settingsListener: IDisposable;

	constructor(
		@IModelService private readonly modelService: IModelService,
		@ITextModelService private readonly textModelResolverService: ITextModelService,
		@IPreferencesService private readonly preferencesService: IPreferencesService,
		@IModeService private readonly modeService: IModeService,
		@IEnvironmentService private readonly environmentService: IEnvironmentService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IEditorOverrideService private readonly editorOverrideService: IEditorOverrideService,
		@IEditorService private readonly editorService: IEditorService,
	) {
		this.settingsListener = this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(USE_SPLIT_JSON_SETTING)) {
				this.handleSettingsEditorOverride();
			}
		});
		this.handleSettingsEditorOverride();

		this.start();
	}

	private handleSettingsEditorOverride(): void {

		// dispose any old listener we had
		dispose(this.editorOpeningListener);

		// install editor opening listener unless user has disabled this
		if (!!this.configurationService.getValue(USE_SPLIT_JSON_SETTING)) {
			this.editorOpeningListener = this.editorOverrideService.registerEditor(
				'**/settings.json',
				{
					id: PreferencesEditorInput.ID,
					describes: editor => editor instanceof PreferencesEditorInput,
					detail: 'Split Settings Editor (deprecated)',
					label: 'label',
					priority: ContributedEditorPriority.builtin,
				},
				{},
				(resource: URI, options: IEditorOptions | undefined, group: IEditorGroup): IEditorInputWithOptions => {
					// Global User Settings File
					if (isEqual(resource, this.environmentService.settingsResource)) {
						return { editor: this.preferencesService.getCurrentOrNewSplitJsonEditorInput(ConfigurationTarget.USER_LOCAL, resource, group), options };
					}

					// Single Folder Workspace Settings File
					const state = this.workspaceService.getWorkbenchState();
					if (state === WorkbenchState.FOLDER) {
						const folders = this.workspaceService.getWorkspace().folders;
						if (isEqual(resource, folders[0].toResource(FOLDER_SETTINGS_PATH))) {
							return { editor: this.preferencesService.getCurrentOrNewSplitJsonEditorInput(ConfigurationTarget.WORKSPACE, resource, group), options };
						}
					}

					// Multi Folder Workspace Settings File
					else if (state === WorkbenchState.WORKSPACE) {
						const folders = this.workspaceService.getWorkspace().folders;
						for (const folder of folders) {
							if (isEqual(resource, folder.toResource(FOLDER_SETTINGS_PATH))) {
								return { editor: this.preferencesService.getCurrentOrNewSplitJsonEditorInput(ConfigurationTarget.WORKSPACE_FOLDER, resource, group), options };
							}
						}
					}

					return { editor: this.editorService.createEditorInput({ resource }), options };
				}
			);
		}
	}

	private start(): void {

		this.textModelResolverService.registerTextModelContentProvider('vscode', {
			provideTextContent: (uri: URI): Promise<ITextModel | null> | null => {
				if (uri.scheme !== 'vscode') {
					return null;
				}
				if (uri.authority === 'schemas') {
					const schemaModel = this.getSchemaModel(uri);
					if (schemaModel) {
						return Promise.resolve(schemaModel);
					}
				}
				return this.preferencesService.resolveModel(uri);
			}
		});
	}

	private getSchemaModel(uri: URI): ITextModel | null {
		let schema = schemaRegistry.getSchemaContributions().schemas[uri.toString()];
		if (schema) {
			const modelContent = JSON.stringify(schema);
			const languageSelection = this.modeService.create('jsonc');
			const model = this.modelService.createModel(modelContent, languageSelection, uri);
			const disposables = new DisposableStore();
			disposables.add(schemaRegistry.onDidChangeSchema(schemaUri => {
				if (schemaUri === uri.toString()) {
					schema = schemaRegistry.getSchemaContributions().schemas[uri.toString()];
					model.setValue(JSON.stringify(schema));
				}
			}));
			disposables.add(model.onWillDispose(() => disposables.dispose()));

			return model;
		}
		return null;
	}

	dispose(): void {
		dispose(this.editorOpeningListener);
		dispose(this.settingsListener);
	}
}

const registry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
registry.registerConfiguration({
	...workbenchConfigurationNodeBase,
	'properties': {
		'workbench.settings.enableNaturalLanguageSearch': {
			'type': 'boolean',
			'description': nls.localize('enableNaturalLanguageSettingsSearch', "Controls whether to enable the natural language search mode for settings. The natural language search is provided by a Microsoft online service."),
			'default': true,
			'scope': ConfigurationScope.WINDOW,
			'tags': ['usesOnlineServices']
		},
		'workbench.settings.settingsSearchTocBehavior': {
			'type': 'string',
			'enum': ['hide', 'filter'],
			'enumDescriptions': [
				nls.localize('settingsSearchTocBehavior.hide', "Hide the Table of Contents while searching."),
				nls.localize('settingsSearchTocBehavior.filter', "Filter the Table of Contents to just categories that have matching settings. Clicking a category will filter the results to that category."),
			],
			'description': nls.localize('settingsSearchTocBehavior', "Controls the behavior of the settings editor Table of Contents while searching."),
			'default': 'filter',
			'scope': ConfigurationScope.WINDOW
		},
	}
});
