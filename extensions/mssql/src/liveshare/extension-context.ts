import * as vscode from 'vscode';

export let extensionContext: vscode.ExtensionContext;

export function setExtensionContext(context: vscode.ExtensionContext) {
  extensionContext = context;
}
