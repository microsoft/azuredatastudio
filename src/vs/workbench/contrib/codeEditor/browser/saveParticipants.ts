/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vs/base/common/cancellation';
import * as strings from 'vs/base/common/strings';
import { IActiveCodeEditor, isCodeEditor } from 'vs/editor/browser/editorBrowser';
import { ICodeEditorService } from 'vs/editor/browser/services/codeEditorService';
import { trimTrailingWhitespace } from 'vs/editor/common/commands/trimTrailingWhitespaceCommand';
import { EditOperation } from 'vs/editor/common/core/editOperation';
import { Position } from 'vs/editor/common/core/position';
import { Range } from 'vs/editor/common/core/range';
import { Selection } from 'vs/editor/common/core/selection';
import { ITextModel } from 'vs/editor/common/model';
import { CodeActionTriggerType, CodeActionProvider } from 'vs/editor/common/languages';
import { applyCodeAction, ApplyCodeActionReason, getCodeActions } from 'vs/editor/contrib/codeAction/browser/codeAction';
import { CodeActionKind, CodeActionTriggerSource } from 'vs/editor/contrib/codeAction/common/types';
import { formatDocumentRangesWithSelectedProvider, formatDocumentWithSelectedProvider, FormattingMode } from 'vs/editor/contrib/format/browser/format';
import { SnippetController2 } from 'vs/editor/contrib/snippet/browser/snippetController2';
import { localize } from 'vs/nls';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IProgressStep, IProgress, Progress } from 'vs/platform/progress/common/progress';
import { ITextFileService, ITextFileSaveParticipant, ITextFileEditorModel } from 'vs/workbench/services/textfile/common/textfiles';
import { SaveReason } from 'vs/workbench/common/editor';
import { Disposable } from 'vs/base/common/lifecycle';
import { IWorkbenchContribution, Extensions as WorkbenchContributionsExtensions, IWorkbenchContributionsRegistry } from 'vs/workbench/common/contributions';
import { Registry } from 'vs/platform/registry/common/platform';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { getModifiedRanges } from 'vs/workbench/contrib/format/browser/formatModified';
import { ExtensionIdentifier } from 'vs/platform/extensions/common/extensions';
import { ILanguageFeaturesService } from 'vs/editor/common/services/languageFeatures';

export class TrimWhitespaceParticipant implements ITextFileSaveParticipant {

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ICodeEditorService private readonly codeEditorService: ICodeEditorService
	) {
		// Nothing
	}

	async participate(model: ITextFileEditorModel, env: { reason: SaveReason }): Promise<void> {
		if (!model.textEditorModel) {
			return;
		}

		if (this.configurationService.getValue('files.trimTrailingWhitespace', { overrideIdentifier: model.textEditorModel.getLanguageId(), resource: model.resource })) {
			this.doTrimTrailingWhitespace(model.textEditorModel, env.reason === SaveReason.AUTO);
		}
	}

	private doTrimTrailingWhitespace(model: ITextModel, isAutoSaved: boolean): void {
		let prevSelection: Selection[] = [];
		let cursors: Position[] = [];

		const editor = findEditor(model, this.codeEditorService);
		if (editor) {
			// Find `prevSelection` in any case do ensure a good undo stack when pushing the edit
			// Collect active cursors in `cursors` only if `isAutoSaved` to avoid having the cursors jump
			prevSelection = editor.getSelections();
			if (isAutoSaved) {
				cursors = prevSelection.map(s => s.getPosition());
				const snippetsRange = SnippetController2.get(editor)?.getSessionEnclosingRange();
				if (snippetsRange) {
					for (let lineNumber = snippetsRange.startLineNumber; lineNumber <= snippetsRange.endLineNumber; lineNumber++) {
						cursors.push(new Position(lineNumber, model.getLineMaxColumn(lineNumber)));
					}
				}
			}
		}

		const ops = trimTrailingWhitespace(model, cursors);
		if (!ops.length) {
			return; // Nothing to do
		}

		model.pushEditOperations(prevSelection, ops, (_edits) => prevSelection);
	}
}

function findEditor(model: ITextModel, codeEditorService: ICodeEditorService): IActiveCodeEditor | null {
	let candidate: IActiveCodeEditor | null = null;

	if (model.isAttachedToEditor()) {
		for (const editor of codeEditorService.listCodeEditors()) {
			if (editor.hasModel() && editor.getModel() === model) {
				if (editor.hasTextFocus()) {
					return editor; // favour focused editor if there are multiple
				}

				candidate = editor;
			}
		}
	}

	return candidate;
}

export class FinalNewLineParticipant implements ITextFileSaveParticipant {

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ICodeEditorService private readonly codeEditorService: ICodeEditorService
	) {
		// Nothing
	}

	async participate(model: ITextFileEditorModel, _env: { reason: SaveReason }): Promise<void> {
		if (!model.textEditorModel) {
			return;
		}

		if (this.configurationService.getValue('files.insertFinalNewline', { overrideIdentifier: model.textEditorModel.getLanguageId(), resource: model.resource })) {
			this.doInsertFinalNewLine(model.textEditorModel);
		}
	}

	private doInsertFinalNewLine(model: ITextModel): void {
		const lineCount = model.getLineCount();
		const lastLine = model.getLineContent(lineCount);
		const lastLineIsEmptyOrWhitespace = strings.lastNonWhitespaceIndex(lastLine) === -1;

		if (!lineCount || lastLineIsEmptyOrWhitespace) {
			return;
		}

		const edits = [EditOperation.insert(new Position(lineCount, model.getLineMaxColumn(lineCount)), model.getEOL())];
		const editor = findEditor(model, this.codeEditorService);
		if (editor) {
			editor.executeEdits('insertFinalNewLine', edits, editor.getSelections());
		} else {
			model.pushEditOperations([], edits, () => null);
		}
	}
}

export class TrimFinalNewLinesParticipant implements ITextFileSaveParticipant {

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ICodeEditorService private readonly codeEditorService: ICodeEditorService
	) {
		// Nothing
	}

	async participate(model: ITextFileEditorModel, env: { reason: SaveReason }): Promise<void> {
		if (!model.textEditorModel) {
			return;
		}

		if (this.configurationService.getValue('files.trimFinalNewlines', { overrideIdentifier: model.textEditorModel.getLanguageId(), resource: model.resource })) {
			this.doTrimFinalNewLines(model.textEditorModel, env.reason === SaveReason.AUTO);
		}
	}

	/**
	 * returns 0 if the entire file is empty
	 */
	private findLastNonEmptyLine(model: ITextModel): number {
		for (let lineNumber = model.getLineCount(); lineNumber >= 1; lineNumber--) {
			const lineContent = model.getLineContent(lineNumber);
			if (lineContent.length > 0) {
				// this line has content
				return lineNumber;
			}
		}
		// no line has content
		return 0;
	}

	private doTrimFinalNewLines(model: ITextModel, isAutoSaved: boolean): void {
		const lineCount = model.getLineCount();

		// Do not insert new line if file does not end with new line
		if (lineCount === 1) {
			return;
		}

		let prevSelection: Selection[] = [];
		let cannotTouchLineNumber = 0;
		const editor = findEditor(model, this.codeEditorService);
		if (editor) {
			prevSelection = editor.getSelections();
			if (isAutoSaved) {
				for (let i = 0, len = prevSelection.length; i < len; i++) {
					const positionLineNumber = prevSelection[i].positionLineNumber;
					if (positionLineNumber > cannotTouchLineNumber) {
						cannotTouchLineNumber = positionLineNumber;
					}
				}
			}
		}

		const lastNonEmptyLine = this.findLastNonEmptyLine(model);
		const deleteFromLineNumber = Math.max(lastNonEmptyLine + 1, cannotTouchLineNumber + 1);
		const deletionRange = model.validateRange(new Range(deleteFromLineNumber, 1, lineCount, model.getLineMaxColumn(lineCount)));

		if (deletionRange.isEmpty()) {
			return;
		}

		model.pushEditOperations(prevSelection, [EditOperation.delete(deletionRange)], _edits => prevSelection);

		editor?.setSelections(prevSelection);
	}
}

class FormatOnSaveParticipant implements ITextFileSaveParticipant {

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ICodeEditorService private readonly codeEditorService: ICodeEditorService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		// Nothing
	}

	async participate(model: ITextFileEditorModel, env: { reason: SaveReason }, progress: IProgress<IProgressStep>, token: CancellationToken): Promise<void> {
		if (!model.textEditorModel) {
			return;
		}
		if (env.reason === SaveReason.AUTO) {
			return undefined;
		}

		const textEditorModel = model.textEditorModel;
		const overrides = { overrideIdentifier: textEditorModel.getLanguageId(), resource: textEditorModel.uri };

		const nestedProgress = new Progress<{ displayName?: string; extensionId?: ExtensionIdentifier }>(provider => {
			progress.report({
				message: localize(
					{ key: 'formatting2', comment: ['[configure]({1}) is a link. Only translate `configure`. Do not change brackets and parentheses or {1}'] },
					"Running '{0}' Formatter ([configure]({1})).",
					provider.displayName || provider.extensionId && provider.extensionId.value || '???',
					'command:workbench.action.openSettings?%5B%22editor.formatOnSave%22%5D'
				)
			});
		});

		const enabled = this.configurationService.getValue<boolean>('editor.formatOnSave', overrides);
		if (!enabled) {
			return undefined;
		}

		const editorOrModel = findEditor(textEditorModel, this.codeEditorService) || textEditorModel;
		const mode = this.configurationService.getValue<'file' | 'modifications' | 'modificationsIfAvailable'>('editor.formatOnSaveMode', overrides);

		if (mode === 'file') {
			await this.instantiationService.invokeFunction(formatDocumentWithSelectedProvider, editorOrModel, FormattingMode.Silent, nestedProgress, token);

		} else {
			const ranges = await this.instantiationService.invokeFunction(getModifiedRanges, isCodeEditor(editorOrModel) ? editorOrModel.getModel() : editorOrModel);
			if (ranges === null && mode === 'modificationsIfAvailable') {
				// no SCM, fallback to formatting the whole file iff wanted
				await this.instantiationService.invokeFunction(formatDocumentWithSelectedProvider, editorOrModel, FormattingMode.Silent, nestedProgress, token);

			} else if (ranges) {
				// formatted modified ranges
				await this.instantiationService.invokeFunction(formatDocumentRangesWithSelectedProvider, editorOrModel, ranges, FormattingMode.Silent, nestedProgress, token);
			}
		}
	}
}

class CodeActionOnSaveParticipant implements ITextFileSaveParticipant {

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILanguageFeaturesService private readonly languageFeaturesService: ILanguageFeaturesService,
	) { }

	async participate(model: ITextFileEditorModel, env: { reason: SaveReason }, progress: IProgress<IProgressStep>, token: CancellationToken): Promise<void> {
		if (!model.textEditorModel) {
			return;
		}

		// Do not run code actions on auto save
		if (env.reason !== SaveReason.EXPLICIT) {
			return undefined;
		}

		const textEditorModel = model.textEditorModel;

		const settingsOverrides = { overrideIdentifier: textEditorModel.getLanguageId(), resource: model.resource };
		const setting = this.configurationService.getValue<{ [kind: string]: boolean } | string[]>('editor.codeActionsOnSave', settingsOverrides);
		if (!setting) {
			return undefined;
		}

		const settingItems: string[] = Array.isArray(setting)
			? setting
			: Object.keys(setting).filter(x => setting[x]);

		const codeActionsOnSave = this.createCodeActionsOnSave(settingItems);

		if (!Array.isArray(setting)) {
			codeActionsOnSave.sort((a, b) => {
				if (CodeActionKind.SourceFixAll.contains(a)) {
					if (CodeActionKind.SourceFixAll.contains(b)) {
						return 0;
					}
					return -1;
				}
				if (CodeActionKind.SourceFixAll.contains(b)) {
					return 1;
				}
				return 0;
			});
		}

		if (!codeActionsOnSave.length) {
			return undefined;
		}

		const excludedActions = Array.isArray(setting)
			? []
			: Object.keys(setting)
				.filter(x => setting[x] === false)
				.map(x => new CodeActionKind(x));

		progress.report({ message: localize('codeaction', "Quick Fixes") });
		await this.applyOnSaveActions(textEditorModel, codeActionsOnSave, excludedActions, progress, token);
	}

	private createCodeActionsOnSave(settingItems: readonly string[]): CodeActionKind[] {
		const kinds = settingItems.map(x => new CodeActionKind(x));

		// Remove subsets
		return kinds.filter(kind => {
			return kinds.every(otherKind => otherKind.equals(kind) || !otherKind.contains(kind));
		});
	}

	private async applyOnSaveActions(model: ITextModel, codeActionsOnSave: readonly CodeActionKind[], excludes: readonly CodeActionKind[], progress: IProgress<IProgressStep>, token: CancellationToken): Promise<void> {

		const getActionProgress = new class implements IProgress<CodeActionProvider> {
			private _names = new Set<string>();
			private _report(): void {
				progress.report({
					message: localize(
						{ key: 'codeaction.get2', comment: ['[configure]({1}) is a link. Only translate `configure`. Do not change brackets and parentheses or {1}'] },
						"Getting code actions from '{0}' ([configure]({1})).",
						[...this._names].map(name => `'${name}'`).join(', '),
						'command:workbench.action.openSettings?%5B%22editor.codeActionsOnSave%22%5D'
					)
				});
			}
			report(provider: CodeActionProvider) {
				if (provider.displayName && !this._names.has(provider.displayName)) {
					this._names.add(provider.displayName);
					this._report();
				}
			}
		};

		for (const codeActionKind of codeActionsOnSave) {
			const actionsToRun = await this.getActionsToRun(model, codeActionKind, excludes, getActionProgress, token);
			if (token.isCancellationRequested) {
				actionsToRun.dispose();
				return;
			}

			try {
				for (const action of actionsToRun.validActions) {
					progress.report({ message: localize('codeAction.apply', "Applying code action '{0}'.", action.action.title) });
					await this.instantiationService.invokeFunction(applyCodeAction, action, ApplyCodeActionReason.OnSave, {}, token);
					if (token.isCancellationRequested) {
						return;
					}
				}
			} catch {
				// Failure to apply a code action should not block other on save actions
			} finally {
				actionsToRun.dispose();
			}
		}
	}

	private getActionsToRun(model: ITextModel, codeActionKind: CodeActionKind, excludes: readonly CodeActionKind[], progress: IProgress<CodeActionProvider>, token: CancellationToken) {
		return getCodeActions(this.languageFeaturesService.codeActionProvider, model, model.getFullModelRange(), {
			type: CodeActionTriggerType.Auto,
			triggerAction: CodeActionTriggerSource.OnSave,
			filter: { include: codeActionKind, excludes: excludes, includeSourceActions: true },
		}, progress, token);
	}
}

export class SaveParticipantsContribution extends Disposable implements IWorkbenchContribution {

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ITextFileService private readonly textFileService: ITextFileService
	) {
		super();

		this.registerSaveParticipants();
	}

	private registerSaveParticipants(): void {
		this._register(this.textFileService.files.addSaveParticipant(this.instantiationService.createInstance(TrimWhitespaceParticipant)));
		this._register(this.textFileService.files.addSaveParticipant(this.instantiationService.createInstance(CodeActionOnSaveParticipant)));
		this._register(this.textFileService.files.addSaveParticipant(this.instantiationService.createInstance(FormatOnSaveParticipant)));
		this._register(this.textFileService.files.addSaveParticipant(this.instantiationService.createInstance(FinalNewLineParticipant)));
		this._register(this.textFileService.files.addSaveParticipant(this.instantiationService.createInstance(TrimFinalNewLinesParticipant)));
	}
}

const workbenchContributionsRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchContributionsExtensions.Workbench);
workbenchContributionsRegistry.registerWorkbenchContribution(SaveParticipantsContribution, LifecyclePhase.Restored);
