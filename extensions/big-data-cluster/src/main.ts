/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import vscode = require('vscode');
import { MainController } from './mainController';

import { fs } from './fs';

import { host } from './kubectl/host';
import { kubeChannel } from './kubectl/kubeChannel';
import { shell, Shell } from './shell';
import { CheckPresentMessageMode, create as kubectlCreate } from './kubectl/kubectl';
import { installKubectl } from './installer/installer';
import { Errorable, failed } from './errorable';

const kubectl = kubectlCreate(host, fs, shell, installDependencies);
export let controller: MainController;

export function activate(context: vscode.ExtensionContext) {
    kubectl.checkPresent(CheckPresentMessageMode.Activation);
	controller = new MainController(context, kubectl);
	controller.activate();
}

// this method is called when your extension is deactivated
export function deactivate(): void {
	if (controller) {
		controller.deactivate();
	}
}

export async function installDependencies() {
    const gotKubectl = await kubectl.checkPresent(CheckPresentMessageMode.Silent);


    const installPromises = [
        installDependency("kubectl", gotKubectl, installKubectl),
    ];

    await Promise.all(installPromises);

    kubeChannel.showOutput("Done");
}

async function installDependency(name: string, alreadyGot: boolean, installFunc: (shell: Shell) => Promise<Errorable<null>>): Promise<void> {
    if (alreadyGot) {
        kubeChannel.showOutput(`Already got ${name}...`);
    } else {
        kubeChannel.showOutput(`Installing ${name}...`);
        const result = await installFunc(shell);
        if (failed(result)) {
            kubeChannel.showOutput(`Unable to install ${name}: ${result.error[0]}`);
        }
    }
}