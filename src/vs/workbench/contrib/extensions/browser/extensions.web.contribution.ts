/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IExtensionRecommendationsService } from 'vs/workbench/services/extensionManagement/common/extensionManagement';
import { ExtensionRecommendationsService } from 'vs/workbench/contrib/extensions/browser/extensionRecommendationsService';

// Singletons
registerSingleton(IExtensionRecommendationsService, ExtensionRecommendationsService);

