/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import { IWorkspace, IWorkspaceFolder } from 'vs/platform/workspace/common/workspace';

export interface IExtensionsConfigContent {
	recommendations: string[];
	unwantedRecommendations: string[];
}

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
