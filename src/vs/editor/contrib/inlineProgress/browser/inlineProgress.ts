/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from 'vs/base/browser/dom';
import { CancelablePromise, disposableTimeout } from 'vs/base/common/async';
import { Codicon } from 'vs/base/common/codicons';
import { Disposable, MutableDisposable } from 'vs/base/common/lifecycle';
import { noBreakWhitespace } from 'vs/base/common/strings';
import { ThemeIcon } from 'vs/base/common/themables';
import 'vs/css!./inlineProgressWidget';
import { ContentWidgetPositionPreference, ICodeEditor, IContentWidget, IContentWidgetPosition } from 'vs/editor/browser/editorBrowser';
import { EditorOption } from 'vs/editor/common/config/editorOptions';
import { IPosition } from 'vs/editor/common/core/position';
import { Range } from 'vs/editor/common/core/range';
import { IEditorDecorationsCollection } from 'vs/editor/common/editorCommon';
import { TrackedRangeStickiness } from 'vs/editor/common/model';
import { ModelDecorationOptions } from 'vs/editor/common/model/textModel';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

const inlineProgressDecoration = ModelDecorationOptions.register({
	description: 'inline-progress-widget',
	stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
	showIfCollapsed: true,
	after: {
		content: noBreakWhitespace,
		inlineClassName: 'inline-editor-progress-decoration',
		inlineClassNameAffectsLetterSpacing: true,
	}
});


class InlineProgressWidget extends Disposable implements IContentWidget {
	private static readonly baseId = 'editor.widget.inlineProgressWidget';

	allowEditorOverflow = false;
	suppressMouseDown = true;

	private domNode!: HTMLElement;

	constructor(
		private readonly typeId: string,
		private readonly editor: ICodeEditor,
		private readonly range: Range,
		title: string,
		private readonly delegate: InlineProgressDelegate,
	) {
		super();

		this.create(title);

		this.editor.addContentWidget(this);
		this.editor.layoutContentWidget(this);
	}

	private create(title: string): void {
		this.domNode = dom.$('.inline-progress-widget');
		this.domNode.role = 'button';
		this.domNode.title = title;

		const iconElement = dom.$('span.icon');
		this.domNode.append(iconElement);

		iconElement.classList.add(...ThemeIcon.asClassNameArray(Codicon.loading), 'codicon-modifier-spin');

		const updateSize = () => {
			const lineHeight = this.editor.getOption(EditorOption.lineHeight);
			this.domNode.style.height = `${lineHeight}px`;
			this.domNode.style.width = `${Math.ceil(0.8 * lineHeight)}px`;
		};
		updateSize();

		this._register(this.editor.onDidChangeConfiguration(c => {
			if (c.hasChanged(EditorOption.fontSize) || c.hasChanged(EditorOption.lineHeight)) {
				updateSize();
			}
		}));

		this._register(dom.addDisposableListener(this.domNode, dom.EventType.CLICK, e => {
			this.delegate.cancel();
		}));
	}

	getId(): string {
		return InlineProgressWidget.baseId + '.' + this.typeId;
	}

	getDomNode(): HTMLElement {
		return this.domNode;
	}

	getPosition(): IContentWidgetPosition | null {
		return {
			position: { lineNumber: this.range.startLineNumber, column: this.range.startColumn },
			preference: [ContentWidgetPositionPreference.EXACT]
		};
	}

	override dispose(): void {
		super.dispose();
		this.editor.removeContentWidget(this);
	}
}

interface InlineProgressDelegate {
	cancel(): void;
}

export class InlineProgressManager extends Disposable {

	/** Delay before showing the progress widget */
	private readonly _showDelay = 500; // ms
	private readonly _showPromise = this._register(new MutableDisposable());

	private readonly _currentDecorations: IEditorDecorationsCollection;
	private readonly _currentWidget = new MutableDisposable<InlineProgressWidget>();

	private _operationIdPool = 0;
	private _currentOperation?: number;

	constructor(
		readonly id: string,
		private readonly _editor: ICodeEditor,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
	) {
		super();

		this._currentDecorations = _editor.createDecorationsCollection();
	}

	public async showWhile<R>(position: IPosition, title: string, promise: CancelablePromise<R>): Promise<R> {
		const operationId = this._operationIdPool++;
		this._currentOperation = operationId;

		this.clear();

		this._showPromise.value = disposableTimeout(() => {
			const range = Range.fromPositions(position);
			const decorationIds = this._currentDecorations.set([{
				range: range,
				options: inlineProgressDecoration,
			}]);

			if (decorationIds.length > 0) {
				this._currentWidget.value = this._instantiationService.createInstance(InlineProgressWidget, this.id, this._editor, range, title, promise);
			}
		}, this._showDelay);

		try {
			return await promise;
		} finally {
			if (this._currentOperation === operationId) {
				this.clear();
				this._currentOperation = undefined;
			}
		}
	}

	private clear() {
		this._showPromise.clear();
		this._currentDecorations.clear();
		this._currentWidget.clear();
	}
}
