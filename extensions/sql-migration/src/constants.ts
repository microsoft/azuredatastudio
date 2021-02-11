/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as loc from './models/strings';

export const WIZARD_INPUT_COMPONENT_WIDTH = '400px';

export interface IconPath {
	dark: string;
	light: string;
}

export class IconPathHelper {
	private static context: vscode.ExtensionContext;

	public static copy: IconPath;
	public static refresh: IconPath;

	public static setExtensionContext(context: vscode.ExtensionContext) {
		IconPathHelper.context = context;
		IconPathHelper.copy = {
			light: IconPathHelper.context.asAbsolutePath('images/copy.svg'),
			dark: IconPathHelper.context.asAbsolutePath('images/copy.svg')
		};
		IconPathHelper.refresh = {
			light: context.asAbsolutePath('images/refresh.svg'),
			dark: context.asAbsolutePath('images/refresh.svg')
		};

	}
}

export class NotebookPathHelper {
	private static context: vscode.ExtensionContext;

	public static inlineMigrationNotebook: MigrationNotebookInfo;
	public static sqlAssessmentNotebook: MigrationNotebookInfo;

	public static setExtensionContext(context: vscode.ExtensionContext) {
		NotebookPathHelper.context = context;
		NotebookPathHelper.inlineMigrationNotebook = {
			label: loc.NOTEBOOK_INLINE_MIGRATION_TITLE,
			notebookPath: NotebookPathHelper.context.asAbsolutePath('notebooks/Inline_Migration_Notebook.ipynb')
		};
		NotebookPathHelper.sqlAssessmentNotebook = {
			label: loc.NOTEBOOK_SQL_MIGRATION_ASSESSMENT_TITLE,
			notebookPath: NotebookPathHelper.context.asAbsolutePath('notebooks/SQL_Assessment_Notebook.ipynb')
		};
	}

	public static getAllMigrationNotebooks(): MigrationNotebookInfo[] {
		return [
			NotebookPathHelper.inlineMigrationNotebook,
			NotebookPathHelper.sqlAssessmentNotebook
		];
	}
}

export interface MigrationNotebookInfo {
	label: string;
	notebookPath: string
}
