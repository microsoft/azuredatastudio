/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import { MdDefinitionProvider } from '../languageFeatures/definitionProvider';
import { MdLinkProvider } from '../languageFeatures/documentLinkProvider';
import { MdReferencesProvider } from '../languageFeatures/references';
import { githubSlugifier } from '../slugify';
import { InMemoryDocument } from '../util/inMemoryDocument';
import { MdWorkspaceContents } from '../workspaceContents';
import { createNewMarkdownEngine } from './engine';
import { InMemoryWorkspaceMarkdownDocuments } from './inMemoryWorkspace';
import { joinLines, noopToken, workspacePath } from './util';


function getDefinition(doc: InMemoryDocument, pos: vscode.Position, workspaceContents: MdWorkspaceContents) {
	const engine = createNewMarkdownEngine();
	const linkProvider = new MdLinkProvider(engine);
	const referencesProvider = new MdReferencesProvider(linkProvider, workspaceContents, engine, githubSlugifier);
	const provider = new MdDefinitionProvider(referencesProvider);
	return provider.provideDefinition(doc, pos, noopToken);
}

function assertDefinitionsEqual(actualDef: vscode.Definition, ...expectedDefs: { uri: vscode.Uri; line: number; startCharacter?: number; endCharacter?: number }[]) {
	const actualDefsArr = Array.isArray(actualDef) ? actualDef : [actualDef];

	assert.strictEqual(actualDefsArr.length, expectedDefs.length, `Definition counts should match`);

	for (let i = 0; i < actualDefsArr.length; ++i) {
		const actual = actualDefsArr[i];
		const expected = expectedDefs[i];
		assert.strictEqual(actual.uri.toString(), expected.uri.toString(), `Definition '${i}' has expected document`);
		assert.strictEqual(actual.range.start.line, expected.line, `Definition '${i}' has expected start line`);
		assert.strictEqual(actual.range.end.line, expected.line, `Definition '${i}' has expected end line`);
		if (typeof expected.startCharacter !== 'undefined') {
			assert.strictEqual(actual.range.start.character, expected.startCharacter, `Definition '${i}' has expected start character`);
		}
		if (typeof expected.endCharacter !== 'undefined') {
			assert.strictEqual(actual.range.end.character, expected.endCharacter, `Definition '${i}' has expected end character`);
		}
	}
}

suite('markdown: Go to definition', () => {
	test('Should not return definition when on link text', async () => {
		const doc = new InMemoryDocument(workspacePath('doc.md'), joinLines(
			`[ref](#abc)`,
			`[ref]: http://example.com`,
		));

		const defs = await getDefinition(doc, new vscode.Position(0, 1), new InMemoryWorkspaceMarkdownDocuments([doc]));
		assert.deepStrictEqual(defs, undefined);
	});

	test('Should find definition links within file from link', async () => {
		const docUri = workspacePath('doc.md');
		const doc = new InMemoryDocument(docUri, joinLines(
			`[link 1][abc]`, // trigger here
			``,
			`[abc]: https://example.com`,
		));

		const defs = await getDefinition(doc, new vscode.Position(0, 12), new InMemoryWorkspaceMarkdownDocuments([doc]));
		assertDefinitionsEqual(defs!,
			{ uri: docUri, line: 2 },
		);
	});

	test('Should find definition links using shorthand', async () => {
		const docUri = workspacePath('doc.md');
		const doc = new InMemoryDocument(docUri, joinLines(
			`[ref]`, // trigger 1
			``,
			`[yes][ref]`, // trigger 2
			``,
			`[ref]: /Hello.md` // trigger 3
		));

		{
			const defs = await getDefinition(doc, new vscode.Position(0, 2), new InMemoryWorkspaceMarkdownDocuments([doc]));
			assertDefinitionsEqual(defs!,
				{ uri: docUri, line: 4 },
			);
		}
		{
			const defs = await getDefinition(doc, new vscode.Position(2, 7), new InMemoryWorkspaceMarkdownDocuments([doc]));
			assertDefinitionsEqual(defs!,
				{ uri: docUri, line: 4 },
			);
		}
		{
			const defs = await getDefinition(doc, new vscode.Position(4, 2), new InMemoryWorkspaceMarkdownDocuments([doc]));
			assertDefinitionsEqual(defs!,
				{ uri: docUri, line: 4 },
			);
		}
	});

	test('Should find definition links within file from definition', async () => {
		const docUri = workspacePath('doc.md');
		const doc = new InMemoryDocument(docUri, joinLines(
			`[link 1][abc]`,
			``,
			`[abc]: https://example.com`, // trigger here
		));

		const defs = await getDefinition(doc, new vscode.Position(2, 3), new InMemoryWorkspaceMarkdownDocuments([doc]));
		assertDefinitionsEqual(defs!,
			{ uri: docUri, line: 2 },
		);
	});

	test('Should not find definition links across files', async () => {
		const docUri = workspacePath('doc.md');
		const doc = new InMemoryDocument(docUri, joinLines(
			`[link 1][abc]`,
			``,
			`[abc]: https://example.com`,
		));

		const defs = await getDefinition(doc, new vscode.Position(0, 12), new InMemoryWorkspaceMarkdownDocuments([
			doc,
			new InMemoryDocument(workspacePath('other.md'), joinLines(
				`[link 1][abc]`,
				``,
				`[abc]: https://example.com?bad`,
			))
		]));
		assertDefinitionsEqual(defs!,
			{ uri: docUri, line: 2 },
		);
	});
});
