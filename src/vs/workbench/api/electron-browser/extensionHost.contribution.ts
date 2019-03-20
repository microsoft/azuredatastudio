/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { Registry } from 'vs/platform/registry/common/platform';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';

// --- other interested parties
import { JSONValidationExtensionPoint } from 'vs/workbench/api/common/jsonValidationExtensionPoint';
import { ColorExtensionPoint } from 'vs/workbench/services/themes/common/colorExtensionPoint';
import { LanguageConfigurationFileHandler } from 'vs/workbench/contrib/codeEditor/browser/languageConfigurationExtensionPoint';

// --- mainThread participants
import 'vs/workbench/api/node/apiCommands';
import '../browser/mainThreadClipboard';
import '../browser/mainThreadCommands';
import '../browser/mainThreadConfiguration';
// {{SQL CARBON EDIT}}
// import '../browser/mainThreadDebugService';
import '../browser/mainThreadDecorations';
import '../browser/mainThreadDiagnostics';
import '../browser/mainThreadDialogs';
import '../browser/mainThreadDocumentContentProviders';
import '../browser/mainThreadErrors';
import '../browser/mainThreadFileSystem';
import '../browser/mainThreadFileSystemEventService';
import '../browser/mainThreadMessageService';
import '../browser/mainThreadOutputService';
import '../browser/mainThreadProgress';
import '../browser/mainThreadQuickOpen';
import '../browser/mainThreadSaveParticipant';
import '../browser/mainThreadSCM';
import '../browser/mainThreadSearch';
import '../browser/mainThreadStatusBar';
import '../browser/mainThreadStorage';
import './mainThreadComments';
import './mainThreadConsole';
import './mainThreadDocuments';
import './mainThreadDocumentsAndEditors';
import './mainThreadEditor';
import './mainThreadEditors';
import './mainThreadExtensionService';
import './mainThreadHeapService';
import './mainThreadLanguageFeatures';
import '../browser/mainThreadLanguages';
import '../browser/mainThreadLogService';
import './mainThreadTask';
import '../browser/mainThreadTelemetry';
import '../browser/mainThreadTerminalService';
import '../browser/mainThreadTreeViews';
import './mainThreadUrls';
import './mainThreadWebview';
import '../browser/mainThreadWindow';
import '../browser/mainThreadWorkspace';

export class ExtensionPoints implements IWorkbenchContribution {

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		// Classes that handle extension points...
		this.instantiationService.createInstance(JSONValidationExtensionPoint);
		this.instantiationService.createInstance(ColorExtensionPoint);
		this.instantiationService.createInstance(LanguageConfigurationFileHandler);
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(ExtensionPoints, LifecyclePhase.Starting);
