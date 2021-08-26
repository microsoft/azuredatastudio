/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Schemas } from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';
import { mock } from 'vs/base/test/common/mock';
import { IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { NullLogService } from 'vs/platform/log/common/log';
import { MainThreadWebviewManager } from 'vs/workbench/api/browser/mainThreadWebviewManager';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { NullApiDeprecationService } from 'vs/workbench/api/common/extHostApiDeprecationService';
import { IExtHostRpcService } from 'vs/workbench/api/common/extHostRpcService';
import { ExtHostWebviews } from 'vs/workbench/api/common/extHostWebview';
import { ExtHostWebviewPanels } from 'vs/workbench/api/common/extHostWebviewPanels';
import { webviewResourceBaseHost } from 'vs/workbench/api/common/shared/webview';
import { EditorGroupColumn } from 'vs/workbench/common/editor';
import type * as vscode from 'vscode';
import { SingleProxyRPCProtocol } from './testRPCProtocol';

suite('ExtHostWebview', () => {

	let rpcProtocol: (IExtHostRpcService & IExtHostContext) | undefined;

	setup(() => {
		const shape = createNoopMainThreadWebviews();
		rpcProtocol = SingleProxyRPCProtocol(shape);
	});

	test('Cannot register multiple serializers for the same view type', async () => {
		const viewType = 'view.type';

		const extHostWebviews = new ExtHostWebviews(rpcProtocol!, { remote: { authority: undefined, isRemote: false } }, undefined, new NullLogService(), NullApiDeprecationService);

		const extHostWebviewPanels = new ExtHostWebviewPanels(rpcProtocol!, extHostWebviews, undefined);

		let lastInvokedDeserializer: vscode.WebviewPanelSerializer | undefined = undefined;

		class NoopSerializer implements vscode.WebviewPanelSerializer {
			async deserializeWebviewPanel(_webview: vscode.WebviewPanel, _state: any): Promise<void> {
				lastInvokedDeserializer = this;
			}
		}

		const extension = {} as IExtensionDescription;

		const serializerA = new NoopSerializer();
		const serializerB = new NoopSerializer();

		const serializerARegistration = extHostWebviewPanels.registerWebviewPanelSerializer(extension, viewType, serializerA);

		await extHostWebviewPanels.$deserializeWebviewPanel('x', viewType, {
			title: 'title',
			state: {},
			panelOptions: {},
			webviewOptions: {}
		}, 0 as EditorGroupColumn);
		assert.strictEqual(lastInvokedDeserializer, serializerA);

		assert.throws(
			() => extHostWebviewPanels.registerWebviewPanelSerializer(extension, viewType, serializerB),
			'Should throw when registering two serializers for the same view');

		serializerARegistration.dispose();

		extHostWebviewPanels.registerWebviewPanelSerializer(extension, viewType, serializerB);

		await extHostWebviewPanels.$deserializeWebviewPanel('x', viewType, {
			title: 'title',
			state: {},
			panelOptions: {},
			webviewOptions: {}
		}, 0 as EditorGroupColumn);
		assert.strictEqual(lastInvokedDeserializer, serializerB);
	});

	test('asWebviewUri for local file paths', () => {
		const webview = createWebview(rpcProtocol, /* remoteAuthority */undefined);

		assert.strictEqual(
			(webview.webview.asWebviewUri(URI.parse('file:///Users/codey/file.html')).toString()),
			`https://file%2B.vscode-resource.${webviewResourceBaseHost}/Users/codey/file.html`,
			'Unix basic'
		);

		assert.strictEqual(
			(webview.webview.asWebviewUri(URI.parse('file:///Users/codey/file.html#frag')).toString()),
			`https://file%2B.vscode-resource.${webviewResourceBaseHost}/Users/codey/file.html#frag`,
			'Unix should preserve fragment'
		);

		assert.strictEqual(
			(webview.webview.asWebviewUri(URI.parse('file:///Users/codey/f%20ile.html')).toString()),
			`https://file%2B.vscode-resource.${webviewResourceBaseHost}/Users/codey/f%20ile.html`,
			'Unix with encoding'
		);

		assert.strictEqual(
			(webview.webview.asWebviewUri(URI.parse('file://localhost/Users/codey/file.html')).toString()),
			`https://file%2Blocalhost.vscode-resource.${webviewResourceBaseHost}/Users/codey/file.html`,
			'Unix should preserve authority'
		);

		assert.strictEqual(
			(webview.webview.asWebviewUri(URI.parse('file:///c:/codey/file.txt')).toString()),
			`https://file%2B.vscode-resource.${webviewResourceBaseHost}/c%3A/codey/file.txt`,
			'Windows C drive'
		);
	});

	test('asWebviewUri for remote file paths', () => {
		const webview = createWebview(rpcProtocol, /* remoteAuthority */ 'remote');

		assert.strictEqual(
			(webview.webview.asWebviewUri(URI.parse('file:///Users/codey/file.html')).toString()),
			`https://vscode-remote%2Bremote.vscode-resource.${webviewResourceBaseHost}/Users/codey/file.html`,
			'Unix basic'
		);
	});
});

function createWebview(rpcProtocol: (IExtHostRpcService & IExtHostContext) | undefined, remoteAuthority: string | undefined) {
	const extHostWebviews = new ExtHostWebviews(rpcProtocol!, {
		remote: {
			authority: remoteAuthority,
			isRemote: !!remoteAuthority,
		},
	}, undefined, new NullLogService(), NullApiDeprecationService);

	const extHostWebviewPanels = new ExtHostWebviewPanels(rpcProtocol!, extHostWebviews, undefined);

	const webview = extHostWebviewPanels.createWebviewPanel({
		extensionLocation: URI.from({
			scheme: remoteAuthority ? Schemas.vscodeRemote : Schemas.file,
			authority: remoteAuthority,
			path: '/ext/path',
		})
	} as IExtensionDescription, 'type', 'title', 1, {});
	return webview;
}


function createNoopMainThreadWebviews() {
	return new class extends mock<MainThreadWebviewManager>() {
		$createWebviewPanel() { /* noop */ }
		$registerSerializer() { /* noop */ }
		$unregisterSerializer() { /* noop */ }
	};
}

