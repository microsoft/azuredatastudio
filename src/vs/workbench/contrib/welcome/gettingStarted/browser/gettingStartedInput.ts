/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./gettingStarted';
import { localize } from 'vs/nls';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { URI } from 'vs/base/common/uri';
import { Schemas } from 'vs/base/common/network';
import { IEditorInput, IUntypedEditorInput } from 'vs/workbench/common/editor';

export const gettingStartedInputTypeId = 'workbench.editors.gettingStartedInput';

export class GettingStartedInput extends EditorInput {

	static readonly ID = gettingStartedInputTypeId;
	static readonly RESOURCE = URI.from({ scheme: Schemas.walkThrough, authority: 'vscode_getting_started_page' });

	override get typeId(): string {
		return GettingStartedInput.ID;
	}

	get resource(): URI | undefined {
		return GettingStartedInput.RESOURCE;
	}

	override matches(other: IEditorInput | IUntypedEditorInput): boolean {
		if (super.matches(other)) {
			return true;
		}

		if (other instanceof GettingStartedInput) {
			return other.selectedCategory === this.selectedCategory;
		}
		return false;
	}

	constructor(
		options: { selectedCategory?: string, selectedStep?: string, showTelemetryNotice?: boolean, }
	) {
		super();
		this.selectedCategory = options.selectedCategory;
		this.selectedStep = options.selectedStep;
		this.showTelemetryNotice = !!options.showTelemetryNotice;
	}

	override getName() {
		return localize('welcome', "Welcome");
	}

	selectedCategory: string | undefined;
	selectedStep: string | undefined;
	showTelemetryNotice: boolean;
}
