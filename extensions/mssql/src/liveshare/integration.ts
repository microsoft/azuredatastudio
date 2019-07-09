import * as vsls from 'vsls';
import * as vscode from 'vscode';

import {
  vslsShareColorMementoName,
  vslsJoinColorMementoName
} from './constants';
import { registerLiveShareIntegrationCommands } from './liveshare-commands';
import { extensionContext, setExtensionContext } from './extension-context';

let peacockColorCustomizations: any;


function changeColor(a) {

}

function setPeacockColorCustomizations(a) {

}

export async function revertLiveShareWorkspaceColors() {
  await setPeacockColorCustomizations(peacockColorCustomizations);

  peacockColorCustomizations = null;
}

async function setLiveShareSessionWorkspaceColors(isHost: boolean) {
  const colorSettingName = isHost
    ? vslsShareColorMementoName
    : vslsJoinColorMementoName;

  const liveShareColorSetting = await extensionContext.globalState.get<string>(
    colorSettingName
  );
  if (!liveShareColorSetting) {
    return;
  }

  await changeColor(liveShareColorSetting);
}

export async function refreshLiveShareSessionColor(
  isHostRole: boolean
): Promise<boolean> {
  const vslsApi = await vsls.getApi();

  // not in Live Share session, no need to update
  if (!vslsApi || !vslsApi.session.id) {
    const verb = isHostRole ? 'host and share' : 'join';

    vscode.window.showInformationMessage(
      `The selected color will be applied every time you ${verb} a Live Share session.`
    );

    return false;
  }

  const isHost = vslsApi.session.role === vsls.Role.Host;
  await setLiveShareSessionWorkspaceColors(isHost);
  return true;
}

export async function addLiveShareIntegration(
  context: vscode.ExtensionContext
) {
  setExtensionContext(context);

  registerLiveShareIntegrationCommands();

  const vslsApi = await vsls.getApi();
  await vscode.commands.executeCommand(
    'setContext',
    'peacock:liveshare',
    !!vslsApi
  );

  if (!vslsApi) {
    return;
  }

  vslsApi!.onDidChangeSession(async function onLiveShareSessionCHange(e) {
    // If there isn't a session ID, then that
    // means the session has been ended.
    if (!e.session.id) {
      return await revertLiveShareWorkspaceColors();
    }

    // we need to update `peacockColorCustomizations` only when it is `undefined`
    // to prevent the case of multiple color changes during live share session
    // peacockColorCustomizations = await vscode.workspace
    //   .getConfiguration()
    //   .get(Sections.workspacePeacockSection);

    const isHost = e.session.role === vsls.Role.Host;
    return await setLiveShareSessionWorkspaceColors(isHost);
  });
}
