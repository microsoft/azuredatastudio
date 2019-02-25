/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

export interface ISqlServerBigDataClusterChannel {
    showOutput(message: any, title?: string): void;
}

class SqlServerBigDataCluster implements ISqlServerBigDataClusterChannel {
    private readonly channel: vscode.OutputChannel = vscode.window.createOutputChannel("SQL Server big data cluster");

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

export const sqlserverbigdataclusterchannel: ISqlServerBigDataClusterChannel = new SqlServerBigDataCluster();
