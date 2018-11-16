/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { EditorAction, IActionOptions, IEditorCommandMenuOptions } from 'vs/editor/browser/editorExtensions';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { TPromise } from 'vs/base/common/winjs.base';
import { MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import URI from 'vs/base/common/uri';

export interface IQueryEditorCommandMenuOptions extends IEditorCommandMenuOptions {
	iconDark?: string;
	iconLight?: string;
}

export interface IQueryActionOptions extends IActionOptions {
	menuOpts?: IQueryEditorCommandMenuOptions;
}

/**
 * Action class that query-based Actions will extend. This base class automatically handles activating and
 * deactivating the button when a SQL file is opened.
 */
export abstract class QueryEditorAction extends EditorAction {

	constructor(private opts: IQueryActionOptions) {
		super(opts);
	}

	public register(): void {

		if (this.opts.menuOpts) {
			MenuRegistry.appendMenuItem(MenuId.EditorActionBar, {
				command: {
					id: this.id,
					title: this.label,
					iconLocation: {
						dark: URI.parse(require.toUrl(`sql/parts/query/editor/media/${this.opts.menuOpts.iconDark}`)),
						light: URI.parse(require.toUrl(`sql/parts/query/editor/media/${this.opts.menuOpts.iconLight}`))
					}
				},
				when: ContextKeyExpr.and(this.precondition, this.opts.menuOpts.when),
				group: this.opts.menuOpts.group,
				order: this.opts.menuOpts.order
			});
		}
		super.register();
	}

	/**
	 * This method is executed when the button is clicked.
	 */
	public abstract run(accessor: ServicesAccessor, editor: ICodeEditor): TPromise<void>;
}
