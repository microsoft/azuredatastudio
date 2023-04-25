/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITextMateService } from 'vs/workbench/services/textMate/browser/textMate';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { AbstractTextMateService } from 'vs/workbench/services/textMate/browser/abstractTextMateService';
import { ILanguageService } from 'vs/editor/common/languages/language';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { ILogService } from 'vs/platform/log/common/log';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { createWebWorker, MonacoWebWorker } from 'vs/editor/browser/services/webWorker';
import { IModelService } from 'vs/editor/common/services/model';
import type { IRawTheme } from 'vscode-textmate';
import { IValidGrammarDefinition } from 'vs/workbench/services/textMate/common/TMScopeRegistry';
import { TextMateWorker } from 'vs/workbench/services/textMate/browser/textMateWorker';
import { ITextModel } from 'vs/editor/common/model';
import { Disposable } from 'vs/base/common/lifecycle';
import { UriComponents, URI } from 'vs/base/common/uri';
import { ContiguousMultilineTokensBuilder } from 'vs/editor/common/tokens/contiguousMultilineTokensBuilder';
import { TMGrammarFactory } from 'vs/workbench/services/textMate/common/TMGrammarFactory';
import { IModelContentChangedEvent } from 'vs/editor/common/textModelEvents';
import { IExtensionResourceLoaderService } from 'vs/workbench/services/extensionResourceLoader/common/extensionResourceLoader';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { IProgressService } from 'vs/platform/progress/common/progress';
import { FileAccess } from 'vs/base/common/network';
import { ILanguageIdCodec } from 'vs/editor/common/languages';
import { ILanguageConfigurationService } from 'vs/editor/common/languages/languageConfigurationRegistry';

const RUN_TEXTMATE_IN_WORKER = false;

class ModelWorkerTextMateTokenizer extends Disposable {

	private readonly _worker: TextMateWorker;
	private readonly _languageIdCodec: ILanguageIdCodec;
	private readonly _model: ITextModel;
	private _isSynced: boolean;
	private _pendingChanges: IModelContentChangedEvent[] = [];

	constructor(worker: TextMateWorker, languageIdCodec: ILanguageIdCodec, model: ITextModel) {
		super();
		this._worker = worker;
		this._languageIdCodec = languageIdCodec;
		this._model = model;
		this._isSynced = false;

		this._register(this._model.onDidChangeAttached(() => this._onDidChangeAttached()));
		this._onDidChangeAttached();

		this._register(this._model.onDidChangeContent((e) => {
			if (this._isSynced) {
				this._worker.acceptModelChanged(this._model.uri.toString(), e);
				this._pendingChanges.push(e);
			}
		}));

		this._register(this._model.onDidChangeLanguage((e) => {
			if (this._isSynced) {
				const languageId = this._model.getLanguageId();
				const encodedLanguageId = this._languageIdCodec.encodeLanguageId(languageId);
				this._worker.acceptModelLanguageChanged(this._model.uri.toString(), languageId, encodedLanguageId);
			}
		}));
	}

	private _onDidChangeAttached(): void {
		if (this._model.isAttachedToEditor()) {
			if (!this._isSynced) {
				this._beginSync();
			}
		} else {
			if (this._isSynced) {
				this._endSync();
			}
		}
	}

	private _beginSync(): void {
		this._isSynced = true;
		const languageId = this._model.getLanguageId();
		const encodedLanguageId = this._languageIdCodec.encodeLanguageId(languageId);
		this._worker.acceptNewModel({
			uri: this._model.uri,
			versionId: this._model.getVersionId(),
			lines: this._model.getLinesContent(),
			EOL: this._model.getEOL(),
			languageId,
			encodedLanguageId
		});
	}

	private _endSync(): void {
		this._isSynced = false;
		this._worker.acceptRemovedModel(this._model.uri.toString());
	}

	public override dispose() {
		super.dispose();
		this._endSync();
	}

	private _confirm(versionId: number): void {
		while (this._pendingChanges.length > 0 && this._pendingChanges[0].versionId <= versionId) {
			this._pendingChanges.shift();
		}
	}

	public setTokens(versionId: number, rawTokens: ArrayBuffer): void {
		this._confirm(versionId);
		const tokens = ContiguousMultilineTokensBuilder.deserialize(new Uint8Array(rawTokens));

		for (let i = 0; i < this._pendingChanges.length; i++) {
			const change = this._pendingChanges[i];
			for (let j = 0; j < tokens.length; j++) {
				for (let k = 0; k < change.changes.length; k++) {
					tokens[j].applyEdit(change.changes[k].range, change.changes[k].text);
				}
			}
		}

		this._model.tokenization.setTokens(tokens);
	}
}

export class TextMateWorkerHost {

	constructor(
		private readonly textMateService: TextMateService,
		@IExtensionResourceLoaderService private readonly _extensionResourceLoaderService: IExtensionResourceLoaderService
	) {
	}

	async readFile(_resource: UriComponents): Promise<string> {
		const resource = URI.revive(_resource);
		return this._extensionResourceLoaderService.readExtensionResource(resource);
	}

	async setTokens(_resource: UriComponents, versionId: number, tokens: Uint8Array): Promise<void> {
		const resource = URI.revive(_resource);
		this.textMateService.setTokens(resource, versionId, tokens);
	}
}

export class TextMateService extends AbstractTextMateService {

	private _worker: MonacoWebWorker<TextMateWorker> | null;
	private _workerProxy: TextMateWorker | null;
	private _tokenizers: { [uri: string]: ModelWorkerTextMateTokenizer };

	constructor(
		@ILanguageService languageService: ILanguageService,
		@IWorkbenchThemeService themeService: IWorkbenchThemeService,
		@IExtensionResourceLoaderService extensionResourceLoaderService: IExtensionResourceLoaderService,
		@INotificationService notificationService: INotificationService,
		@ILogService logService: ILogService,
		@IConfigurationService configurationService: IConfigurationService,
		@IProgressService progressService: IProgressService,
		@IModelService private readonly _modelService: IModelService,
		@IWorkbenchEnvironmentService private readonly _environmentService: IWorkbenchEnvironmentService,
		@ILanguageConfigurationService private readonly _languageConfigurationService: ILanguageConfigurationService,
	) {
		super(languageService, themeService, extensionResourceLoaderService, notificationService, logService, configurationService, progressService);
		this._worker = null;
		this._workerProxy = null;
		this._tokenizers = Object.create(null);
		this._register(this._modelService.onModelAdded(model => this._onModelAdded(model)));
		this._register(this._modelService.onModelRemoved(model => this._onModelRemoved(model)));
		this._modelService.getModels().forEach((model) => this._onModelAdded(model));
	}

	private _onModelAdded(model: ITextModel): void {
		if (!this._workerProxy) {
			return;
		}
		if (model.isTooLargeForSyncing()) {
			return;
		}
		const key = model.uri.toString();
		const tokenizer = new ModelWorkerTextMateTokenizer(this._workerProxy, this._languageService.languageIdCodec, model);
		this._tokenizers[key] = tokenizer;
	}

	private _onModelRemoved(model: ITextModel): void {
		const key = model.uri.toString();
		if (this._tokenizers[key]) {
			this._tokenizers[key].dispose();
			delete this._tokenizers[key];
		}
	}

	protected async _loadVSCodeOnigurumWASM(): Promise<Response | ArrayBuffer> {
		const response = await fetch(this._environmentService.isBuilt
			? FileAccess.asBrowserUri('../../../../../../node_modules.asar.unpacked/vscode-oniguruma/release/onig.wasm', require).toString(true)
			: FileAccess.asBrowserUri('../../../../../../node_modules/vscode-oniguruma/release/onig.wasm', require).toString(true));
		return response;
	}

	protected override _onDidCreateGrammarFactory(grammarDefinitions: IValidGrammarDefinition[]): void {
		this._killWorker();

		if (RUN_TEXTMATE_IN_WORKER) {
			const workerHost = new TextMateWorkerHost(this, this._extensionResourceLoaderService);
			const worker = createWebWorker<TextMateWorker>(this._modelService, this._languageConfigurationService, {
				createData: {
					grammarDefinitions
				},
				label: 'textMateWorker',
				moduleId: 'vs/workbench/services/textMate/browser/textMateWorker',
				host: workerHost
			});

			this._worker = worker;
			worker.getProxy().then((proxy) => {
				if (this._worker !== worker) {
					// disposed in the meantime
					return;
				}
				this._workerProxy = proxy;
				if (this._currentTheme && this._currentTokenColorMap) {
					this._workerProxy.acceptTheme(this._currentTheme, this._currentTokenColorMap);
				}
				this._modelService.getModels().forEach((model) => this._onModelAdded(model));
			});
		}
	}

	protected override _doUpdateTheme(grammarFactory: TMGrammarFactory | null, theme: IRawTheme, colorMap: string[]): void {
		super._doUpdateTheme(grammarFactory, theme, colorMap);
		if (this._currentTheme && this._currentTokenColorMap && this._workerProxy) {
			this._workerProxy.acceptTheme(this._currentTheme, this._currentTokenColorMap);
		}
	}

	protected override _onDidDisposeGrammarFactory(): void {
		this._killWorker();
	}

	private _killWorker(): void {
		for (const key of Object.keys(this._tokenizers)) {
			this._tokenizers[key].dispose();
		}
		this._tokenizers = Object.create(null);

		if (this._worker) {
			this._worker.dispose();
			this._worker = null;
		}
		this._workerProxy = null;
	}

	setTokens(resource: URI, versionId: number, tokens: ArrayBuffer): void {
		const key = resource.toString();
		if (!this._tokenizers[key]) {
			return;
		}
		this._tokenizers[key].setTokens(versionId, tokens);
	}
}

registerSingleton(ITextMateService, TextMateService);
