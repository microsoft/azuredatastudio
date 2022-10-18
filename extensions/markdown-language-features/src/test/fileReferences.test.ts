/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import { MdLinkProvider } from '../languageFeatures/documentLinkProvider';
import { MdReference, MdReferencesProvider } from '../languageFeatures/references';
import { githubSlugifier } from '../slugify';
import { InMemoryDocument } from '../util/inMemoryDocument';
import { MdWorkspaceContents } from '../workspaceContents';
import { createNewMarkdownEngine } from './engine';
import { InMemoryWorkspaceMarkdownDocuments } from './inMemoryWorkspace';
import { joinLines, noopToken, workspacePath } from './util';


function getFileReferences(resource: vscode.Uri, workspaceContents: MdWorkspaceContents) {
	const engine = createNewMarkdownEngine();
	const linkProvider = new MdLinkProvider(engine);
	const provider = new MdReferencesProvider(linkProvider, workspaceContents, engine, githubSlugifier);
	return provider.getAllReferencesToFile(resource, noopToken);
}

function assertReferencesEqual(actualRefs: readonly MdReference[], ...expectedRefs: { uri: vscode.Uri; line: number }[]) {
	assert.strictEqual(actualRefs.length, expectedRefs.length, `Reference counts should match`);

	for (let i = 0; i < actualRefs.length; ++i) {
		const actual = actualRefs[i].location;
		const expected = expectedRefs[i];
		assert.strictEqual(actual.uri.toString(), expected.uri.toString(), `Ref '${i}' has expected document`);
		assert.strictEqual(actual.range.start.line, expected.line, `Ref '${i}' has expected start line`);
		assert.strictEqual(actual.range.end.line, expected.line, `Ref '${i}' has expected end line`);
	}
}

suite('markdown: find file references', () => {

	test('Should find basic references', async () => {
		const docUri = workspacePath('doc.md');
		const otherUri = workspacePath('other.md');

		const refs = await getFileReferences(otherUri, new InMemoryWorkspaceMarkdownDocuments([
			new InMemoryDocument(docUri, joinLines(
				`# header`,
				`[link 1](./other.md)`,
				`[link 2](./other.md)`,
			)),
			new InMemoryDocument(otherUri, joinLines(
				`# header`,
				`pre`,
				`[link 3](./other.md)`,
				`post`,
			)),
		]));

		assertReferencesEqual(refs!,
			{ uri: docUri, line: 1 },
			{ uri: docUri, line: 2 },
			{ uri: otherUri, line: 2 },
		);
	});

	test('Should find references with and without file extensions', async () => {
		const docUri = workspacePath('doc.md');
		const otherUri = workspacePath('other.md');

		const refs = await getFileReferences(otherUri, new InMemoryWorkspaceMarkdownDocuments([
			new InMemoryDocument(docUri, joinLines(
				`# header`,
				`[link 1](./other.md)`,
				`[link 2](./other)`,
			)),
			new InMemoryDocument(otherUri, joinLines(
				`# header`,
				`pre`,
				`[link 3](./other.md)`,
				`[link 4](./other)`,
				`post`,
			)),
		]));

		assertReferencesEqual(refs!,
			{ uri: docUri, line: 1 },
			{ uri: docUri, line: 2 },
			{ uri: otherUri, line: 2 },
			{ uri: otherUri, line: 3 },
		);
	});

	test('Should find references with headers on links', async () => {
		const docUri = workspacePath('doc.md');
		const otherUri = workspacePath('other.md');

		const refs = await getFileReferences(otherUri, new InMemoryWorkspaceMarkdownDocuments([
			new InMemoryDocument(docUri, joinLines(
				`# header`,
				`[link 1](./other.md#sub-bla)`,
				`[link 2](./other#sub-bla)`,
			)),
			new InMemoryDocument(otherUri, joinLines(
				`# header`,
				`pre`,
				`[link 3](./other.md#sub-bla)`,
				`[link 4](./other#sub-bla)`,
				`post`,
			)),
		]));

		assertReferencesEqual(refs!,
			{ uri: docUri, line: 1 },
			{ uri: docUri, line: 2 },
			{ uri: otherUri, line: 2 },
			{ uri: otherUri, line: 3 },
		);
	});
});
