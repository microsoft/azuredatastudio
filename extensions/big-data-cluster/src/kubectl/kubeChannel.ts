/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

export interface IKubeChannel {
    showOutput(message: any, title?: string): void;
}

class KubeChannel implements IKubeChannel {
    private readonly channel: vscode.OutputChannel = vscode.window.createOutputChannel("Kubernetes");

    showOutput(message: any, title?: string): void {
        if (title) {
            const simplifiedTime = (new Date()).toISOString().replace(/z|t/gi, ' ').trim(); // YYYY-MM-DD HH:mm:ss.sss
            const hightlightingTitle = `[${title} ${simplifiedTime}]`;
            this.channel.appendLine(hightlightingTitle);
        }
        this.channel.appendLine(message);
        this.channel.show();
    }
}

export const kubeChannel: IKubeChannel = new KubeChannel();
