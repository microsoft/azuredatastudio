/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as glob from 'vs/base/common/glob';
import { IDisposable } from 'vs/base/common/lifecycle';
import { Schemas } from 'vs/base/common/network';
import { posix } from 'vs/base/common/path';
import { basename } from 'vs/base/common/resources';
import { URI } from 'vs/base/common/uri';
import { localize } from 'vs/nls';
import { workbenchConfigurationNodeBase } from 'vs/workbench/common/configuration';
import { Extensions as ConfigurationExtensions, IConfigurationNode, IConfigurationRegistry } from 'vs/platform/configuration/common/configurationRegistry';
import { IResourceEditorInput, ITextResourceEditorInput } from 'vs/platform/editor/common/editor';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Registry } from 'vs/platform/registry/common/platform';
import { IEditorInputWithOptions, IEditorInputWithOptionsAndGroup, IResourceDiffEditorInput, IUntitledTextResourceEditorInput, IUntypedEditorInput } from 'vs/workbench/common/editor';
import { IEditorGroup } from 'vs/workbench/services/editor/common/editorGroupsService';
import { PreferredGroup } from 'vs/workbench/services/editor/common/editorService';

export const IEditorResolverService = createDecorator<IEditorResolverService>('editorResolverService');

//#region Editor Associations

// Static values for registered editors

export type EditorAssociation = {
	readonly viewType: string;
	readonly filenamePattern?: string;
};

export type EditorAssociations = readonly EditorAssociation[];

export const editorsAssociationsSettingId = 'workbench.editorAssociations';

const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);

const editorAssociationsConfigurationNode: IConfigurationNode = {
	...workbenchConfigurationNodeBase,
	properties: {
		'workbench.editorAssociations': {
			type: 'object',
			markdownDescription: localize('editor.editorAssociations', "Configure glob patterns to editors (e.g. `\"*.hex\": \"hexEditor.hexEdit\"`). These have precedence over the default behavior."),
			additionalProperties: {
				type: 'string'
			}
		}
	}
};

export interface IEditorType {
	readonly id: string;
	readonly displayName: string;
	readonly providerDisplayName: string;
}

configurationRegistry.registerConfiguration(editorAssociationsConfigurationNode);
//#endregion

//#region EditorResolverService types
export enum RegisteredEditorPriority {
	builtin = 'builtin',
	option = 'option',
	exclusive = 'exclusive',
	default = 'default'
}

/**
 * If we didn't resolve an editor dictates what to do with the opening state
 * ABORT = Do not continue with opening the editor
 * NONE = Continue as if the resolution has been disabled as the service could not resolve one
 */
export const enum ResolvedStatus {
	ABORT = 1,
	NONE = 2,
}

export type ResolvedEditor = IEditorInputWithOptionsAndGroup | ResolvedStatus;

export type RegisteredEditorOptions = {
	/**
	 * If your editor cannot be opened in multiple groups for the same resource
	 */
	singlePerResource?: boolean | (() => boolean);
	/**
	 * If your editor supports diffs
	 */
	canHandleDiff?: boolean | (() => boolean);

	/**
	 * Whether or not you can support opening the given resource.
	 * If omitted we assume you can open everything
	 */
	canSupportResource?: (resource: URI) => boolean;
};

export type RegisteredEditorInfo = {
	id: string;
	label: string;
	detail?: string;
	priority: RegisteredEditorPriority;
};

type EditorInputFactoryResult = IEditorInputWithOptions | Promise<IEditorInputWithOptions>;

export type EditorInputFactoryFunction = (editorInput: IResourceEditorInput | ITextResourceEditorInput, group: IEditorGroup) => EditorInputFactoryResult;

export type UntitledEditorInputFactoryFunction = (untitledEditorInput: IUntitledTextResourceEditorInput, group: IEditorGroup) => EditorInputFactoryResult;

export type DiffEditorInputFactoryFunction = (diffEditorInput: IResourceDiffEditorInput, group: IEditorGroup) => EditorInputFactoryResult;

export interface IEditorResolverService {
	readonly _serviceBrand: undefined;
	/**
	 * Given a resource finds the editor associations that match it from the user's settings
	 * @param resource The resource to match
	 * @return The matching associations
	 */
	getAssociationsForResource(resource: URI): EditorAssociations;

	/**
	 * Updates the user's association to include a specific editor ID as a default for the given glob pattern
	 * @param globPattern The glob pattern (must be a string as settings don't support relative glob)
	 * @param editorID The ID of the editor to make a user default
	 */
	updateUserAssociations(globPattern: string, editorID: string): void;

	/**
	 * Registers a specific editor.
	 * @param globPattern The glob pattern for this registration
	 * @param editorInfo Information about the registration
	 * @param options Specific options which apply to this registration
	 * @param createEditorInput The factory method for creating inputs
	 */
	registerEditor(
		globPattern: string | glob.IRelativePattern,
		editorInfo: RegisteredEditorInfo,
		options: RegisteredEditorOptions,
		createEditorInput: EditorInputFactoryFunction,
		createUntitledEditorInput?: UntitledEditorInputFactoryFunction | undefined,
		createDiffEditorInput?: DiffEditorInputFactoryFunction
	): IDisposable;

	/**
	 * Given an editor resolves it to the suitable IEditorInputWithOptionsAndGroup based on user extensions, settings, and built-in editors
	 * @param editor The editor to resolve
	 * @param preferredGroup The group you want to open the editor in
	 * @returns An IEditorInputWithOptionsAndGroup if there is an available editor or a status of how to proceed
	 */
	resolveEditor(editor: IEditorInputWithOptions | IUntypedEditorInput, preferredGroup: PreferredGroup | undefined): Promise<ResolvedEditor>;

	/**
	 * Given a resource returns all the editor ids that match that resource. If there is exclusive editor we return an empty array
	 * @param resource The resource
	 * @returns A list of editor ids
	 */
	getEditorIds(resource: URI): string[];
}

//#endregion

//#region Util functions
export function priorityToRank(priority: RegisteredEditorPriority): number {
	switch (priority) {
		case RegisteredEditorPriority.exclusive:
			return 5;
		case RegisteredEditorPriority.default:
			return 4;
		case RegisteredEditorPriority.builtin:
			return 3;
		// Text editor is priority 2
		case RegisteredEditorPriority.option:
		default:
			return 1;
	}
}

export function globMatchesResource(globPattern: string | glob.IRelativePattern, resource: URI): boolean {
	const excludedSchemes = new Set([
		Schemas.extension,
		Schemas.webviewPanel,
		Schemas.vscodeWorkspaceTrust,
		Schemas.walkThrough,
		Schemas.vscodeSettings
	]);
	// We want to say that the above schemes match no glob patterns
	if (excludedSchemes.has(resource.scheme)) {
		return false;
	}
	const matchOnPath = typeof globPattern === 'string' && globPattern.indexOf(posix.sep) >= 0;
	const target = matchOnPath ? `${resource.scheme}:${resource.path}` : basename(resource);
	return glob.match(typeof globPattern === 'string' ? globPattern.toLowerCase() : globPattern, target.toLowerCase());
}
//#endregion
