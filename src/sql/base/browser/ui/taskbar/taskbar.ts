/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/taskbar';
import 'vs/css!./media/icons';
import 'vs/css!sql/media/icons/common-icons';

import { ActionBar } from './actionbar';

import { Builder, $ } from 'sql/base/browser/builder';
import { Action, IActionRunner, IAction } from 'vs/base/common/actions';
import { ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { IContextMenuProvider } from 'vs/base/browser/ui/dropdown/dropdown';
import { IToolBarOptions } from 'vs/base/browser/ui/toolbar/toolbar';

/**
 * A wrapper for the different types of content a QueryTaskbar can display
 */
export interface ITaskbarContent {

	// Display the element created by this IAction
	action?: IAction;

	// Display a pre-created element
	element?: HTMLElement;
}

/**
 * A widget that combines an action bar for actions. This class was needed because we
 * want the ability to use the custom QueryActionBar in order to display other HTML
 * in our taskbar. Based off import ToolBar from vs/base/browser/ui/toolbar/toolbar.
 */
export class Taskbar {
	private options: IToolBarOptions;
	private actionBar: ActionBar;
	private lookupKeybindings: boolean;

	constructor(container: HTMLElement, contextMenuProvider: IContextMenuProvider, options: IToolBarOptions = { orientation: ActionsOrientation.HORIZONTAL }) {
		this.options = options;
		this.lookupKeybindings = typeof this.options.getKeyBinding === 'function' && typeof this.options.getKeyBinding === 'function';

		let element = document.createElement('div');
		element.className = 'monaco-toolbar carbon-taskbar';
		container.appendChild(element);

		this.actionBar = new ActionBar($(element), {
			orientation: options.orientation,
			ariaLabel: options.ariaLabel,
			actionItemProvider: (action: Action) => {
				return options.actionItemProvider ? options.actionItemProvider(action) : null;
			}
		});
	}

	/**
	 * Creates an HTML vertical separator.
	 */
	public static createTaskbarSeparator(): HTMLElement {
		let element = document.createElement('div');
		element.className = 'taskbarSeparator';
		element.innerHTML = ' ';
		return element;
	}

	/**
	 * Creates an HTML spinner.
	 */
	public static createTaskbarSpinner(): HTMLElement {
		let spinnerContainer = document.createElement('div');
		spinnerContainer.className = 'taskbar-progress icon in-progress ';
		spinnerContainer.style.visibility = 'hidden';
		return spinnerContainer;
	}

	/**
	 * Creates an HTML text separator.
	 */
	public static createTaskbarText(inputText: string): HTMLElement {
		let element = document.createElement('div');
		element.className = 'taskbarTextSeparator';
		element.textContent = inputText;
		return element;
	}

	public set actionRunner(actionRunner: IActionRunner) {
		this.actionBar.actionRunner = actionRunner;
	}

	public get actionRunner(): IActionRunner {
		return this.actionBar.actionRunner;
	}

	public set context(context: any) {
		this.actionBar.context = context;
	}

	public getContainer(): Builder {
		return this.actionBar.getContainer();
	}

	public setAriaLabel(label: string): void {
		this.actionBar.setAriaLabel(label);
	}

	public length(): number {
		return this.actionBar.length();
	}

	public pull(index: number) {
		this.actionBar.pull(index);
	}

	/**
	 * Push HTMLElements and icons for IActions into the ActionBar UI. Push IActions into ActionBar's private collection.
	 */
	public setContent(content: ITaskbarContent[]): void {
		let contentToSet: ITaskbarContent[] = content ? content.slice(0) : [];
		this.actionBar.clear();

		for (let item of contentToSet) {
			if (item.action) {
				this.actionBar.pushAction(item.action, { icon: true, label: true, keybinding: this.getKeybindingLabel(item.action) });
			} else if (item.element) {
				this.actionBar.pushElement(item.element);
			}
		}
	}

	private getKeybindingLabel(action: IAction): string {
		const key = this.lookupKeybindings ? this.options.getKeyBinding(action) : void 0;
		return key ? key.getLabel() : '';
	}

	public addAction(primaryAction: IAction): void {
		this.actionBar.pushAction(primaryAction, { icon: true, label: false, keybinding: this.getKeybindingLabel(primaryAction) });
	}

	public addElement(element: HTMLElement): void {
		this.actionBar.pushElement(element);
	}

	public dispose(): void {
		this.actionBar.dispose();
	}

}
