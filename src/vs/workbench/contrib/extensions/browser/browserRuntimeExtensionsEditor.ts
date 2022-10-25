/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import { IExtensionHostProfile } from 'vs/workbench/services/extensions/common/extensions';
import { ExtensionIdentifier } from 'vs/platform/extensions/common/extensions';
import { AbstractRuntimeExtensionsEditor, IRuntimeExtension } from 'vs/workbench/contrib/extensions/browser/abstractRuntimeExtensionsEditor';

export class RuntimeExtensionsEditor extends AbstractRuntimeExtensionsEditor {

	protected _getProfileInfo(): IExtensionHostProfile | null {
		return null;
	}

	protected _getUnresponsiveProfile(extensionId: ExtensionIdentifier): IExtensionHostProfile | undefined {
		return undefined;
	}

	protected _createSlowExtensionAction(element: IRuntimeExtension): Action | null {
		return null;
	}

	protected _createReportExtensionIssueAction(element: IRuntimeExtension): Action | null {
		return null;
	}

	protected _createSaveExtensionHostProfileAction(): Action | null {
		return null;
	}

	protected _createProfileAction(): Action | null {
		return null;
	}
}
