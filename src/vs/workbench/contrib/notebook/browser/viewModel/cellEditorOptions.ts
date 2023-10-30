/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from 'vs/base/common/event';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { deepClone } from 'vs/base/common/objects';
import { IEditorOptions } from 'vs/editor/common/config/editorOptions';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IBaseCellEditorOptions, INotebookEditorDelegate } from 'vs/workbench/contrib/notebook/browser/notebookBrowser';
import { NotebookOptions } from 'vs/workbench/contrib/notebook/browser/notebookOptions';

export class BaseCellEditorOptions extends Disposable implements IBaseCellEditorOptions {
	private static fixedEditorOptions: IEditorOptions = {
		scrollBeyondLastLine: false,
		scrollbar: {
			verticalScrollbarSize: 14,
			horizontal: 'auto',
			useShadows: true,
			verticalHasArrows: false,
			horizontalHasArrows: false,
			alwaysConsumeMouseWheel: false
		},
		renderLineHighlightOnlyWhenFocus: true,
		overviewRulerLanes: 0,
		lineDecorationsWidth: 0,
		folding: true,
		fixedOverflowWidgets: true,
		minimap: { enabled: false },
		renderValidationDecorations: 'on',
		lineNumbersMinChars: 3
	};

	private _localDisposableStore = this._register(new DisposableStore());
	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange: Event<void> = this._onDidChange.event;
	private _value: IEditorOptions;

	get value(): Readonly<IEditorOptions> {
		return this._value;
	}

	constructor(readonly notebookEditor: INotebookEditorDelegate, readonly notebookOptions: NotebookOptions, readonly configurationService: IConfigurationService, readonly language: string) {
		super();
		this._register(configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('editor') || e.affectsConfiguration('notebook')) {
				this._recomputeOptions();
			}
		}));

		this._register(notebookOptions.onDidChangeOptions(e => {
			if (e.cellStatusBarVisibility || e.editorTopPadding || e.editorOptionsCustomizations) {
				this._recomputeOptions();
			}
		}));

		this._register(this.notebookEditor.onDidChangeModel(() => {
			this._localDisposableStore.clear();

			if (this.notebookEditor.hasModel()) {
				this._localDisposableStore.add(this.notebookEditor.onDidChangeOptions(() => {
					this._recomputeOptions();
				}));

				this._recomputeOptions();
			}
		}));

		if (this.notebookEditor.hasModel()) {
			this._localDisposableStore.add(this.notebookEditor.onDidChangeOptions(() => {
				this._recomputeOptions();
			}));
		}

		this._value = this._computeEditorOptions();
	}

	private _recomputeOptions(): void {
		this._value = this._computeEditorOptions();
		this._onDidChange.fire();
	}

	private _computeEditorOptions() {
		const editorOptions = deepClone(this.configurationService.getValue<IEditorOptions>('editor', { overrideIdentifier: this.language }));
		const layoutConfig = this.notebookOptions.getLayoutConfiguration();
		const editorOptionsOverrideRaw = layoutConfig.editorOptionsCustomizations ?? {};
		const editorOptionsOverride: { [key: string]: any } = {};
		for (const key in editorOptionsOverrideRaw) {
			if (key.indexOf('editor.') === 0) {
				editorOptionsOverride[key.substring(7)] = editorOptionsOverrideRaw[key];
			}
		}
		const computed = Object.freeze({
			...editorOptions,
			...BaseCellEditorOptions.fixedEditorOptions,
			...editorOptionsOverride,
			...{ padding: { top: 12, bottom: 12 } },
			readOnly: this.notebookEditor.isReadOnly
		});

		return computed;
	}
}
