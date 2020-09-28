/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/taskbar';
import 'vs/css!./media/icons';

import { ActionBar } from './actionbar';

import { IActionRunner, IAction, IActionViewItem } from 'vs/base/common/actions';
import { ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { IToolBarOptions } from 'vs/base/browser/ui/toolbar/toolbar';
import { OverflowActionBar } from 'sql/base/browser/ui/taskbar/overflowActionbar';

/**
 * A wrapper for the different types of content a QueryTaskbar can display
 */
export interface ITaskbarContent {

	// Display the element created by this IAction
	action?: IAction;

	// Display a pre-created element
	element?: HTMLElement;
}

export interface ITaskbarOptions extends IToolBarOptions {
	collapseOverflow?: boolean
}

/**
 * A widget that combines an action bar for actions. This class was needed because we
 * want the ability to use the custom QueryActionBar in order to display other HTML
 * in our taskbar. Based off import ToolBar from vs/base/browser/ui/toolbar/toolbar.
 */
export class Taskbar {
	private options: IToolBarOptions;
	private actionBar: ActionBar;

	constructor(container: HTMLElement, options: ITaskbarOptions = { orientation: ActionsOrientation.HORIZONTAL }) {
		this.options = options;

		let element = document.createElement('div');
		element.className = 'monaco-toolbar carbon-taskbar';
		container.appendChild(element);

		if (options.collapseOverflow) {
			this.actionBar = new OverflowActionBar(
				element,
				{
					orientation: options.orientation,
					ariaLabel: options.ariaLabel,
					actionViewItemProvider: (action: IAction): IActionViewItem | undefined => {
						return options.actionViewItemProvider ? options.actionViewItemProvider(action) : undefined;
					}
				}
			);
		} else {
			this.actionBar = new ActionBar(
				element,
				{
					orientation: options.orientation,
					ariaLabel: options.ariaLabel,
					actionViewItemProvider: (action: IAction): IActionViewItem | undefined => {
						return options.actionViewItemProvider ? options.actionViewItemProvider(action) : undefined;
					}
				}
			);
		}
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
		spinnerContainer.className = 'taskbar-progress codicon in-progress ';
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

	public getContainer(): HTMLElement {
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
		const key = this.options.getKeyBinding ? this.options.getKeyBinding(action) : undefined;
		const label = key ? key.getLabel() : undefined;
		return label || '';
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
