import * as vscode from 'vscode';
import TextEditor from './text-editor';
import {QuickPickItem, TextEditor as VsTextEditor} from 'vscode';

export default class WindowAdaptor {
    private window: typeof vscode.window;

    constructor(window: typeof vscode.window) {
        this.window = window;
    }

    get visibleTextEditors(): TextEditor[] {
        return this.window.visibleTextEditors.map((editor: VsTextEditor) => new TextEditor(editor));
    }

    async showQuickPick<T extends QuickPickItem>(items: T[]): Promise<T[] | undefined> {
        // @ts-ignore
        return this.window.showQuickPick(items, {canPickMany: true});
    }

    async showInformationMessage(message: string): Promise<string | undefined> {
        return this.window.showInformationMessage(message);
    }
}
