/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./messageController';
import * as nls from 'vs/nls';
import { TimeoutTimer } from 'vs/base/common/async';
import { KeyCode } from 'vs/base/common/keyCodes';
import { IDisposable, Disposable, DisposableStore, MutableDisposable } from 'vs/base/common/lifecycle';
import { alert } from 'vs/base/browser/ui/aria/aria';
import { Range } from 'vs/editor/common/core/range';
import * as editorCommon from 'vs/editor/common/editorCommon';
import { registerEditorContribution, EditorCommand, registerEditorCommand } from 'vs/editor/browser/editorExtensions';
import { ICodeEditor, IContentWidget, IContentWidgetPosition, ContentWidgetPositionPreference } from 'vs/editor/browser/editorBrowser';
import { IContextKeyService, RawContextKey, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { IPosition } from 'vs/editor/common/core/position';
import { registerThemingParticipant, HIGH_CONTRAST } from 'vs/platform/theme/common/themeService';
import { inputValidationInfoBorder, inputValidationInfoBackground, inputValidationInfoForeground } from 'vs/platform/theme/common/colorRegistry';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';

export class MessageController extends Disposable implements editorCommon.IEditorContribution {

	private static readonly _id = 'editor.contrib.messageController';

	static MESSAGE_VISIBLE = new RawContextKey<boolean>('messageVisible', false);

	static get(editor: ICodeEditor): MessageController {
		return editor.getContribution<MessageController>(MessageController._id);
	}

	private readonly closeTimeout = 3000; // close after 3s

	getId(): string {
		return MessageController._id;
	}

	private readonly _editor: ICodeEditor;
	private readonly _visible: IContextKey<boolean>;
	private readonly _messageWidget = this._register(new MutableDisposable<MessageWidget>());
	private readonly _messageListeners = this._register(new DisposableStore());

	constructor(
		editor: ICodeEditor,
		@IContextKeyService contextKeyService: IContextKeyService
	) {
		super();
		this._editor = editor;
		this._visible = MessageController.MESSAGE_VISIBLE.bindTo(contextKeyService);
		this._register(this._editor.onDidAttemptReadOnlyEdit(() => this._onDidAttemptReadOnlyEdit()));
	}

	dispose(): void {
		super.dispose();
		this._visible.reset();
	}

	isVisible() {
		return this._visible.get();
	}

	showMessage(message: string, position: IPosition): void {

		alert(message);

		this._visible.set(true);
		this._messageWidget.clear();
		this._messageListeners.clear();
		this._messageWidget.value = new MessageWidget(this._editor, position, message);

		// close on blur, cursor, model change, dispose
		this._messageListeners.add(this._editor.onDidBlurEditorText(() => this.closeMessage()));
		this._messageListeners.add(this._editor.onDidChangeCursorPosition(() => this.closeMessage()));
		this._messageListeners.add(this._editor.onDidDispose(() => this.closeMessage()));
		this._messageListeners.add(this._editor.onDidChangeModel(() => this.closeMessage()));

		this._messageListeners.add(new TimeoutTimer(() => this.closeMessage(), this.closeTimeout));

		// close on mouse move
		let bounds: Range;
		this._messageListeners.add(this._editor.onMouseMove(e => {
			// outside the text area
			if (!e.target.position) {
				return;
			}

			if (!bounds) {
				// define bounding box around position and first mouse occurance
				bounds = new Range(position.lineNumber - 3, 1, e.target.position.lineNumber + 3, 1);
			} else if (!bounds.containsPosition(e.target.position)) {
				// check if position is still in bounds
				this.closeMessage();
			}
		}));
	}

	closeMessage(): void {
		this._visible.reset();
		this._messageListeners.clear();
		if (this._messageWidget.value) {
			this._messageListeners.add(MessageWidget.fadeOut(this._messageWidget.value));
		}
	}

	private _onDidAttemptReadOnlyEdit(): void {
		if (this._editor.hasModel()) {
			this.showMessage(nls.localize('editor.readonly', "Cannot edit in read-only editor"), this._editor.getPosition());
		}
	}
}

const MessageCommand = EditorCommand.bindToContribution<MessageController>(MessageController.get);


registerEditorCommand(new MessageCommand({
	id: 'leaveEditorMessage',
	precondition: MessageController.MESSAGE_VISIBLE,
	handler: c => c.closeMessage(),
	kbOpts: {
		weight: KeybindingWeight.EditorContrib + 30,
		primary: KeyCode.Escape
	}
}));

class MessageWidget implements IContentWidget {

	// Editor.IContentWidget.allowEditorOverflow
	readonly allowEditorOverflow = true;
	readonly suppressMouseDown = false;

	private readonly _editor: ICodeEditor;
	private readonly _position: IPosition;
	private readonly _domNode: HTMLDivElement;

	static fadeOut(messageWidget: MessageWidget): IDisposable {
		let handle: any;
		const dispose = () => {
			messageWidget.dispose();
			clearTimeout(handle);
			messageWidget.getDomNode().removeEventListener('animationend', dispose);
		};
		handle = setTimeout(dispose, 110);
		messageWidget.getDomNode().addEventListener('animationend', dispose);
		messageWidget.getDomNode().classList.add('fadeOut');
		return { dispose };
	}

	constructor(editor: ICodeEditor, { lineNumber, column }: IPosition, text: string) {

		this._editor = editor;
		this._editor.revealLinesInCenterIfOutsideViewport(lineNumber, lineNumber, editorCommon.ScrollType.Smooth);
		this._position = { lineNumber, column: column - 1 };

		this._domNode = document.createElement('div');
		this._domNode.classList.add('monaco-editor-overlaymessage');

		const message = document.createElement('div');
		message.classList.add('message');
		message.textContent = text;
		this._domNode.appendChild(message);

		const anchor = document.createElement('div');
		anchor.classList.add('anchor');
		this._domNode.appendChild(anchor);

		this._editor.addContentWidget(this);
		this._domNode.classList.add('fadeIn');
	}

	dispose() {
		this._editor.removeContentWidget(this);
	}

	getId(): string {
		return 'messageoverlay';
	}

	getDomNode(): HTMLElement {
		return this._domNode;
	}

	getPosition(): IContentWidgetPosition {
		return { position: this._position, preference: [ContentWidgetPositionPreference.ABOVE] };
	}
}

registerEditorContribution(MessageController);

registerThemingParticipant((theme, collector) => {
	const border = theme.getColor(inputValidationInfoBorder);
	if (border) {
		let borderWidth = theme.type === HIGH_CONTRAST ? 2 : 1;
		collector.addRule(`.monaco-editor .monaco-editor-overlaymessage .anchor { border-top-color: ${border}; }`);
		collector.addRule(`.monaco-editor .monaco-editor-overlaymessage .message { border: ${borderWidth}px solid ${border}; }`);
	}
	const background = theme.getColor(inputValidationInfoBackground);
	if (background) {
		collector.addRule(`.monaco-editor .monaco-editor-overlaymessage .message { background-color: ${background}; }`);
	}
	const foreground = theme.getColor(inputValidationInfoForeground);
	if (foreground) {
		collector.addRule(`.monaco-editor .monaco-editor-overlaymessage .message { color: ${foreground}; }`);
	}
});
