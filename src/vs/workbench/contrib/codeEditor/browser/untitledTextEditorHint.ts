/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from 'vs/base/browser/dom';
import { dispose, IDisposable } from 'vs/base/common/lifecycle';
import { ContentWidgetPositionPreference, ICodeEditor, IContentWidget, IContentWidgetPosition } from 'vs/editor/browser/editorBrowser';
import { localize } from 'vs/nls';
import { registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { inputPlaceholderForeground, textLinkForeground } from 'vs/platform/theme/common/colorRegistry';
import { ChangeModeAction } from 'vs/workbench/browser/parts/editor/editorStatus';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { PLAINTEXT_MODE_ID } from 'vs/editor/common/modes/modesRegistry';
import { IEditorContribution } from 'vs/editor/common/editorCommon';
import { Schemas } from 'vs/base/common/network';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ITASExperimentService } from 'vs/workbench/services/experiment/common/experimentService';
import { ConfigurationChangedEvent, EditorOption } from 'vs/editor/common/config/editorOptions';
import { registerEditorContribution } from 'vs/editor/browser/editorExtensions';

const $ = dom.$;

const untitledTextEditorHintSetting = 'workbench.editor.untitled.hint';
export class UntitledTextEditorHintContribution implements IEditorContribution {

	public static readonly ID = 'editor.contrib.untitledTextEditorHint';

	private toDispose: IDisposable[];
	private untitledTextHintContentWidget: UntitledTextEditorHintContentWidget | undefined;
	private experimentTreatment: 'text' | 'hidden' | undefined;

	constructor(
		private editor: ICodeEditor,
		@ICommandService private readonly commandService: ICommandService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ITASExperimentService private readonly experimentService: ITASExperimentService

	) {
		this.toDispose = [];
		this.toDispose.push(this.editor.onDidChangeModel(() => this.update()));
		this.toDispose.push(this.editor.onDidChangeModelLanguage(() => this.update()));
		this.toDispose.push(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(untitledTextEditorHintSetting)) {
				this.update();
			}
		}));
		this.experimentService.getTreatment<'text' | 'hidden'>('untitledhint').then(treatment => {
			this.experimentTreatment = treatment;
			this.update();
		});
	}

	private update(): void {
		this.untitledTextHintContentWidget?.dispose();
		const configValue = this.configurationService.getValue<'text' | 'hidden' | 'default'>(untitledTextEditorHintSetting);
		const untitledHintMode = configValue === 'default' ? (this.experimentTreatment || 'text') : configValue;

		const model = this.editor.getModel();

		if (model && model.uri.scheme === Schemas.untitled && model.getModeId() === PLAINTEXT_MODE_ID && untitledHintMode === 'text') {
			this.untitledTextHintContentWidget = new UntitledTextEditorHintContentWidget(this.editor, this.commandService, this.configurationService);
		}
	}

	dispose(): void {
		dispose(this.toDispose);
		this.untitledTextHintContentWidget?.dispose();
	}
}

class UntitledTextEditorHintContentWidget implements IContentWidget {

	private static readonly ID = 'editor.widget.untitledHint';

	private domNode: HTMLElement | undefined;
	private toDispose: IDisposable[];

	constructor(
		private readonly editor: ICodeEditor,
		private readonly commandService: ICommandService,
		private readonly configurationService: IConfigurationService,
	) {
		this.toDispose = [];
		this.toDispose.push(editor.onDidChangeModelContent(() => this.onDidChangeModelContent()));
		this.toDispose.push(this.editor.onDidChangeConfiguration((e: ConfigurationChangedEvent) => {
			if (this.domNode && e.hasChanged(EditorOption.fontInfo)) {
				this.editor.applyFontInfo(this.domNode);
			}
		}));
		this.onDidChangeModelContent();
	}

	private onDidChangeModelContent(): void {
		if (this.editor.getValue() === '') {
			this.editor.addContentWidget(this);
		} else {
			this.editor.removeContentWidget(this);
		}
	}

	getId(): string {
		return UntitledTextEditorHintContentWidget.ID;
	}

	// Select a language to get started. Start typing to dismiss, or don't show this again.
	getDomNode(): HTMLElement {
		if (!this.domNode) {
			this.domNode = $('.untitled-hint');
			this.domNode.style.width = 'max-content';
			const language = $('a.language-mode');
			language.style.cursor = 'pointer';
			language.innerText = localize('selectAlanguage2', "Select a language");
			this.domNode.appendChild(language);
			const toGetStarted = $('span');
			toGetStarted.innerText = localize('toGetStarted', " to get started. Start typing to dismiss, or ",);
			this.domNode.appendChild(toGetStarted);

			const dontShow = $('a');
			dontShow.style.cursor = 'pointer';
			dontShow.innerText = localize('dontshow', "don't show");
			this.domNode.appendChild(dontShow);

			const thisAgain = $('span');
			thisAgain.innerText = localize('thisAgain', " this again.");
			this.domNode.appendChild(thisAgain);

			this.toDispose.push(dom.addDisposableListener(language, 'click', async e => {
				e.stopPropagation();
				// Need to focus editor before so current editor becomes active and the command is properly executed
				this.editor.focus();
				await this.commandService.executeCommand(ChangeModeAction.ID, { from: 'hint' });
				this.editor.focus();
			}));

			this.toDispose.push(dom.addDisposableListener(dontShow, 'click', () => {
				this.configurationService.updateValue(untitledTextEditorHintSetting, 'hidden');
				this.dispose();
				this.editor.focus();
			}));

			this.toDispose.push(dom.addDisposableListener(this.domNode, 'click', () => {
				this.editor.focus();
			}));

			this.domNode.style.fontStyle = 'italic';
			this.domNode.style.paddingLeft = '4px';
			this.editor.applyFontInfo(this.domNode);
		}

		return this.domNode;
	}

	getPosition(): IContentWidgetPosition | null {
		return {
			position: { lineNumber: 1, column: 1 },
			preference: [ContentWidgetPositionPreference.EXACT]
		};
	}

	dispose(): void {
		this.editor.removeContentWidget(this);
		dispose(this.toDispose);
	}
}

registerThemingParticipant((theme, collector) => {
	const inputPlaceholderForegroundColor = theme.getColor(inputPlaceholderForeground);
	if (inputPlaceholderForegroundColor) {
		collector.addRule(`.monaco-editor .contentWidgets .untitled-hint { color: ${inputPlaceholderForegroundColor}; }`);
	}
	const textLinkForegroundColor = theme.getColor(textLinkForeground);
	if (textLinkForegroundColor) {
		collector.addRule(`.monaco-editor .contentWidgets .untitled-hint a { color: ${textLinkForegroundColor}; }`);
	}
});

registerEditorContribution(UntitledTextEditorHintContribution.ID, UntitledTextEditorHintContribution);
