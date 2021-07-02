/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from 'vs/base/common/event';
import { createDecorator, refineServiceDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IExtension, IScannedExtension, ExtensionType, ITranslatedScannedExtension, IExtensionManifest } from 'vs/platform/extensions/common/extensions';
import { IExtensionManagementService, IGalleryExtension, IExtensionIdentifier, ILocalExtension, InstallOptions } from 'vs/platform/extensionManagement/common/extensionManagement';
import { URI } from 'vs/base/common/uri';
import { IWorkspace, IWorkspaceFolder } from 'vs/platform/workspace/common/workspace'; // {{SQL CARBON EDIT}}
import { ExtensionRecommendationReason } from 'vs/workbench/services/extensionRecommendations/common/extensionRecommendations';

export interface IExtensionManagementServer {
	id: string;
	label: string;
	extensionManagementService: IExtensionManagementService;
}

export const IExtensionManagementServerService = createDecorator<IExtensionManagementServerService>('extensionManagementServerService');
export interface IExtensionManagementServerService {
	readonly _serviceBrand: undefined;
	readonly localExtensionManagementServer: IExtensionManagementServer | null;
	readonly remoteExtensionManagementServer: IExtensionManagementServer | null;
	readonly webExtensionManagementServer: IExtensionManagementServer | null;
	getExtensionManagementServer(extension: IExtension): IExtensionManagementServer | null;
}

export const IWorkbenchExtensionManagementService = refineServiceDecorator<IExtensionManagementService, IWorkbenchExtensionManagementService>(IExtensionManagementService);
export interface IWorkbenchExtensionManagementService extends IExtensionManagementService {
	readonly _serviceBrand: undefined;
	installExtensions(extensions: IGalleryExtension[], installOptions?: InstallOptions): Promise<ILocalExtension[]>;
	updateFromGallery(gallery: IGalleryExtension, extension: ILocalExtension): Promise<ILocalExtension>;
	getExtensionManagementServerToInstall(manifest: IExtensionManifest): IExtensionManagementServer | null
}

export const enum EnablementState {
	DisabledByTrustRequirement,
	DisabledByExtensionKind,
	DisabledByEnvironment,
	DisabledByVirtualWorkspace,
	DisabledGlobally,
	DisabledWorkspace,
	EnabledGlobally,
	EnabledWorkspace
}

export const IWorkbenchExtensionEnablementService = createDecorator<IWorkbenchExtensionEnablementService>('extensionEnablementService');

export interface IWorkbenchExtensionEnablementService {
	readonly _serviceBrand: undefined;

	/**
	 * Event to listen on for extension enablement changes
	 */
	readonly onEnablementChanged: Event<readonly IExtension[]>;

	/**
	 * Returns the enablement state for the given extension
	 */
	getEnablementState(extension: IExtension): EnablementState;

	/**
	 * Returns `true` if the enablement can be changed.
	 */
	canChangeEnablement(extension: IExtension): boolean;

	/**
	 * Returns `true` if the enablement can be changed.
	 */
	canChangeWorkspaceEnablement(extension: IExtension): boolean;

	/**
	 * Returns `true` if the given extension identifier is enabled.
	 */
	isEnabled(extension: IExtension): boolean;

	/**
	 * Returns `true` if the given extension identifier is disabled globally.
	 * Extensions can be disabled globally or in workspace or both.
	 * If an extension is disabled in both then enablement state shows only workspace.
	 * This will
	 */
	isDisabledGlobally(extension: IExtension): boolean;

	/**
	 * Enable or disable the given extension.
	 * if `workspace` is `true` then enablement is done for workspace, otherwise globally.
	 *
	 * Returns a promise that resolves to boolean value.
	 * if resolves to `true` then requires restart for the change to take effect.
	 *
	 * Throws error if enablement is requested for workspace and there is no workspace
	 */
	setEnablement(extensions: IExtension[], state: EnablementState): Promise<boolean[]>;

	/**
	 * Updates the enablement state of the extensions that require workspace trust when
	 * workspace trust changes.
	 */
	updateEnablementByWorkspaceTrustRequirement(): Promise<void>;
}

export interface IExtensionsConfigContent {
	recommendations: string[];
	unwantedRecommendations: string[];
}

export type RecommendationChangeNotification = {
	extensionId: string,
	isRecommended: boolean
};

export type DynamicRecommendation = 'dynamic';
export type ConfigRecommendation = 'config';
export type ExecutableRecommendation = 'executable';
export type CachedRecommendation = 'cached';
export type ApplicationRecommendation = 'application';
export type ExperimentalRecommendation = 'experimental';
export type ExtensionRecommendationSource = IWorkspace | IWorkspaceFolder | URI | DynamicRecommendation | ExecutableRecommendation | CachedRecommendation | ApplicationRecommendation | ExperimentalRecommendation | ConfigRecommendation;

export interface IExtensionRecommendation {
	extensionId: string;
	sources: ExtensionRecommendationSource[];
}

export interface IExtensionRecommendationReason {
	reasonId: ExtensionRecommendationReason;
	reasonText: string;
}

export const IWebExtensionsScannerService = createDecorator<IWebExtensionsScannerService>('IWebExtensionsScannerService');
export interface IWebExtensionsScannerService {
	readonly _serviceBrand: undefined;
	scanExtensions(type?: ExtensionType): Promise<IScannedExtension[]>;
	scanAndTranslateExtensions(type?: ExtensionType): Promise<ITranslatedScannedExtension[]>;
	scanAndTranslateSingleExtension(extensionLocation: URI, extensionType: ExtensionType): Promise<ITranslatedScannedExtension | null>;
	canAddExtension(galleryExtension: IGalleryExtension): boolean;
	addExtension(galleryExtension: IGalleryExtension): Promise<IScannedExtension>;
	removeExtension(identifier: IExtensionIdentifier, version?: string): Promise<void>;
}
