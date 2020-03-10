/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { OVERRIDE_EDITOR_THEMING_SETTING } from 'sql/workbench/services/notebook/browser/notebookService';
import { registerNotebookThemes } from 'sql/workbench/contrib/notebook/browser/notebookStyles';

export class NotebookThemingContribution extends Disposable implements IWorkbenchContribution {
	private themeParticipant?: IDisposable;
	private overrideEditorThemeSetting?: boolean;

	constructor(@IConfigurationService private readonly configurationService: IConfigurationService) {
		super();
		this.hookNotebookThemesAndConfigListener();
	}

	private hookNotebookThemesAndConfigListener(): void {
		if (this.configurationService) {
			this.updateNotebookThemes();
			this._register(this.configurationService.onDidChangeConfiguration(e => {
				if (e.affectsConfiguration(OVERRIDE_EDITOR_THEMING_SETTING)
					|| e.affectsConfiguration('resultsGrid')) {
					this.updateNotebookThemes();
				}
			}));
		}
	}

	private updateNotebookThemes() {
		let overrideEditorSetting = this.configurationService.getValue<boolean>(OVERRIDE_EDITOR_THEMING_SETTING);
		if (overrideEditorSetting !== this.overrideEditorThemeSetting) {
			// Re-add the participant since this will trigger update of theming rules, can't just
			// update something and ask to change
			if (this.themeParticipant) {
				this.themeParticipant.dispose();
			}
			this.overrideEditorThemeSetting = overrideEditorSetting;
			this.themeParticipant = registerNotebookThemes(overrideEditorSetting, this.configurationService);
		}
	}
}
