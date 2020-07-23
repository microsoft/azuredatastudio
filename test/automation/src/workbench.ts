/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Explorer } from './explorer';
import { ActivityBar } from './activityBar';
import { QuickAccess } from './quickaccess';
import { QuickInput } from './quickinput';
import { Extensions } from './extensions';
import { Search } from './search';
import { Editor } from './editor';
import { SCM } from './scm';
import { Debug } from './debug';
import { StatusBar } from './statusbar';
import { Problems } from './problems';
import { SettingsEditor } from './settings';
import { KeybindingsEditor } from './keybindings';
import { Editors } from './editors';
import { Code } from './code';
import { Terminal } from './terminal';
import { Notebook } from './notebook';

// {{SQL CARBON EDIT}}
import { ConnectionDialog } from './sql/connectionDialog';
import { Profiler } from './sql/profiler';
import { QueryEditors } from './sql/queryEditors';
import { QueryEditor } from './sql/queryEditor';
import { Notebook as SqlNotebook } from './sql/notebook';
// {{END}}

export interface Commands {
	runCommand(command: string): Promise<any>;
}

export class Workbench {

	readonly quickaccess: QuickAccess;
	readonly quickinput: QuickInput;
	readonly editors: Editors;
	readonly explorer: Explorer;
	readonly activitybar: ActivityBar;
	readonly search: Search;
	readonly extensions: Extensions;
	readonly editor: Editor;
	readonly scm: SCM;
	readonly debug: Debug;
	readonly statusbar: StatusBar;
	readonly problems: Problems;
	readonly settingsEditor: SettingsEditor;
	readonly keybindingsEditor: KeybindingsEditor;
	readonly terminal: Terminal;
	readonly notebook: Notebook;

	// {{SQL CARBON EDIT}}
	readonly connectionDialog: ConnectionDialog;
	readonly profiler: Profiler;
	readonly queryEditors: QueryEditors;
	readonly queryEditor: QueryEditor;
	readonly sqlNotebbok: SqlNotebook;
	// {{END}}

	constructor(code: Code, userDataPath: string) {
		this.editors = new Editors(code);
		this.quickinput = new QuickInput(code);
		this.quickaccess = new QuickAccess(code, this.editors, this.quickinput);
		this.explorer = new Explorer(code, this.editors);
		this.activitybar = new ActivityBar(code);
		this.search = new Search(code);
		this.extensions = new Extensions(code);
		this.editor = new Editor(code, this.quickaccess);
		this.scm = new SCM(code);
		this.debug = new Debug(code, this.quickaccess, this.editors, this.editor);
		this.statusbar = new StatusBar(code);
		this.problems = new Problems(code);
		this.settingsEditor = new SettingsEditor(code, userDataPath, this.editors, this.editor, this.quickaccess);
		this.keybindingsEditor = new KeybindingsEditor(code);
		this.terminal = new Terminal(code, this.quickaccess);
		// {{SQL CARBON EDIT}}
		this.connectionDialog = new ConnectionDialog(code);
		this.profiler = new Profiler(code, this.quickaccess);
		this.queryEditors = new QueryEditors(code, this.editors);
		this.queryEditor = new QueryEditor(code);
		this.sqlNotebbok = new SqlNotebook(code, this.quickaccess, this.quickinput, this.editors);
		// {{END}}
		this.notebook = new Notebook(this.quickaccess, code);
	}
}
