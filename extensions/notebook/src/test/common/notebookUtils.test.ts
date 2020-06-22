/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { newNotebook } from '../../common/notebookUtils';
import * as should from 'should';
import * as vscode from 'vscode';

describe('notebookUtils Tests', async function (): Promise<void> {
	describe('newNotebook', async function (): Promise<void> {
		it('Should open a new notebook successfully', async function (): Promise<void> {
			should(azdata.nb.notebookDocuments.length).equal(0, 'There should be not any open Notebook documents');
			await newNotebook(undefined);
			should(azdata.nb.notebookDocuments.length).equal(1, 'There should be exactly 1 open Notebook document');
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
			should(azdata.nb.notebookDocuments.length).equal(0, 'There should be not any open Notebook documents');
		});

		it('Opening an untitled editor after closing should re-use previous untitled name', async function (): Promise<void> {
			should(azdata.nb.notebookDocuments.length).equal(0, 'There should be not any open Notebook documents');
			await newNotebook(undefined);
			should(azdata.nb.notebookDocuments.length).equal(1, 'There should be exactly 1 open Notebook document');
			should(azdata.nb.notebookDocuments[0].fileName).equal('Notebook-0', 'The first Untitled Notebook should have an index of 0');
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
			should(azdata.nb.notebookDocuments.length).equal(0, 'There should be not any open Notebook documents');
			await newNotebook(undefined);
			should(azdata.nb.notebookDocuments.length).equal(1, 'There should be exactly 1 open Notebook document after second opening');
			should(azdata.nb.notebookDocuments[0].fileName).equal('Notebook-0', 'The first Untitled Notebook should have an index of 0 after closing first Untitled Notebook');
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		});

		it('Untitled Name index should increase', async function (): Promise<void> {
			should(azdata.nb.notebookDocuments.length).equal(0, 'There should be not any open Notebook documents');
			await newNotebook(undefined);
			should(azdata.nb.notebookDocuments.length).equal(1, 'There should be exactly 1 open Notebook document');
			const secondNotebook = await newNotebook(undefined);
			should(azdata.nb.notebookDocuments.length).equal(2, 'There should be exactly 2 open Notebook documents');
			should(secondNotebook.document.fileName).equal('Notebook-1', 'The second Untitled Notebook should have an index of 1');
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
			should(azdata.nb.notebookDocuments.length).equal(0, 'There should be not any open Notebook documents');
		});
	});
});
