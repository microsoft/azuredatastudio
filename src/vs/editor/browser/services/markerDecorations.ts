/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMarkerDecorationsService } from 'vs/editor/common/services/markersDecorationService';
import { registerEditorContribution } from 'vs/editor/browser/editorExtensions';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { IEditorContribution } from 'vs/editor/common/editorCommon';

export class MarkerDecorationsContribution implements IEditorContribution {

	public static readonly ID: string = 'editor.contrib.markerDecorations';

	constructor(
		_editor: ICodeEditor,
		@IMarkerDecorationsService _markerDecorationsService: IMarkerDecorationsService
	) {
		// Doesn't do anything, just requires `IMarkerDecorationsService` to make sure it gets instantiated
	}

	dispose(): void {
	}
}

registerEditorContribution(MarkerDecorationsContribution.ID, MarkerDecorationsContribution);
