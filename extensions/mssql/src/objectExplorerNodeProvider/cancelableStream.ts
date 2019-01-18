'use strict';

import { Transform } from 'stream';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export class CancelableStream extends Transform {
    constructor(private cancelationToken: vscode.CancellationTokenSource) {
        super();
    }

    public _transform(chunk: any, encoding: string, callback: Function): void {
        if (this.cancelationToken && this.cancelationToken.token.isCancellationRequested) {
            callback(new Error(localize('streamCanceled', 'Stream operation canceled by the user')));
        } else {
            this.push(chunk);
            callback();
        }
    }
}
