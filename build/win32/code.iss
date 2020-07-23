#define RootLicenseFileName FileExists(RepoDir + '\LICENSE.rtf') ? 'LICENSE.rtf' : 'LICENSE.txt'
#define LocalizedLanguageFile(Language = "") \
    DirExists(RepoDir + "\licenses") && Language != "" \
      ? ('; LicenseFile: "' + RepoDir + '\licenses\LICENSE-' + Language + '.txt"') \
      : '; LicenseFile: "' + RepoDir + '\' + RootLicenseFileName + '"'

[Setup]
AppId={#AppId}
AppName={#NameLong}
AppVerName={#NameVersion}
AppPublisher=Microsoft Corporation
AppPublisherURL=https://github.com/Microsoft/azuredatastudio
AppSupportURL=https://github.com/Microsoft/azuredatastudio
AppUpdatesURL=https://github.com/Microsoft/azuredatastudio

DefaultGroupName={#NameLong}
AllowNoIcons=yes
OutputDir={#OutputDir}
OutputBaseFilename=AzureDataStudioSetup
Compression=lzma
SolidCompression=yes
AppMutex={code:GetAppMutex}
SetupMutex={#AppMutex}setup
WizardImageFile="{#RepoDir}\resources\win32\inno-big-100.bmp,{#RepoDir}\resources\win32\inno-big-125.bmp,{#RepoDir}\resources\win32\inno-big-150.bmp,{#RepoDir}\resources\win32\inno-big-175.bmp,{#RepoDir}\resources\win32\inno-big-200.bmp,{#RepoDir}\resources\win32\inno-big-225.bmp,{#RepoDir}\resources\win32\inno-big-250.bmp"
WizardSmallImageFile="{#RepoDir}\resources\win32\inno-small-100.bmp,{#RepoDir}\resources\win32\inno-small-125.bmp,{#RepoDir}\resources\win32\inno-small-150.bmp,{#RepoDir}\resources\win32\inno-small-175.bmp,{#RepoDir}\resources\win32\inno-small-200.bmp,{#RepoDir}\resources\win32\inno-small-225.bmp,{#RepoDir}\resources\win32\inno-small-250.bmp"
SetupIconFile={#RepoDir}\resources\win32\code.ico
UninstallDisplayIcon={app}\{#ExeBasename}.exe
ChangesEnvironment=true
ChangesAssociations=true
MinVersion=6.1.7600
SourceDir={#SourceDir}
AppVersion={#Version}
VersionInfoVersion={#RawVersion}
ShowLanguageDialog=auto
ArchitecturesAllowed={#ArchitecturesAllowed}
ArchitecturesInstallIn64BitMode={#ArchitecturesInstallIn64BitMode}
WizardStyle=modern

#ifdef Sign
SignTool=esrp
#endif

#if "user" == InstallTarget
DefaultDirName={userpf}\{#DirName}
PrivilegesRequired=lowest
#else
DefaultDirName={pf}\{#DirName}
#endif

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl,{#RepoDir}\build\win32\i18n\messages.en.isl" {#LocalizedLanguageFile}
Name: "german"; MessagesFile: "compiler:Languages\German.isl,{#RepoDir}\build\win32\i18n\messages.de.isl" {#LocalizedLanguageFile("deu")}
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl,{#RepoDir}\build\win32\i18n\messages.es.isl" {#LocalizedLanguageFile("esp")}
Name: "french"; MessagesFile: "compiler:Languages\French.isl,{#RepoDir}\build\win32\i18n\messages.fr.isl" {#LocalizedLanguageFile("fra")}
Name: "italian"; MessagesFile: "compiler:Languages\Italian.isl,{#RepoDir}\build\win32\i18n\messages.it.isl" {#LocalizedLanguageFile("ita")}
Name: "japanese"; MessagesFile: "compiler:Languages\Japanese.isl,{#RepoDir}\build\win32\i18n\messages.ja.isl" {#LocalizedLanguageFile("jpn")}
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl,{#RepoDir}\build\win32\i18n\messages.ru.isl" {#LocalizedLanguageFile("rus")}
Name: "korean"; MessagesFile: "{#RepoDir}\build\win32\i18n\Default.ko.isl,{#RepoDir}\build\win32\i18n\messages.ko.isl" {#LocalizedLanguageFile("kor")}
Name: "simplifiedChinese"; MessagesFile: "{#RepoDir}\build\win32\i18n\Default.zh-cn.isl,{#RepoDir}\build\win32\i18n\messages.zh-cn.isl" {#LocalizedLanguageFile("chs")}
Name: "traditionalChinese"; MessagesFile: "{#RepoDir}\build\win32\i18n\Default.zh-tw.isl,{#RepoDir}\build\win32\i18n\messages.zh-tw.isl" {#LocalizedLanguageFile("cht")}
Name: "brazilianPortuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl,{#RepoDir}\build\win32\i18n\messages.pt-br.isl" {#LocalizedLanguageFile("ptb")}
Name: "hungarian"; MessagesFile: "{#RepoDir}\build\win32\i18n\Default.hu.isl,{#RepoDir}\build\win32\i18n\messages.hu.isl" {#LocalizedLanguageFile("hun")}
Name: "turkish"; MessagesFile: "compiler:Languages\Turkish.isl,{#RepoDir}\build\win32\i18n\messages.tr.isl" {#LocalizedLanguageFile("trk")}

[InstallDelete]
Type: filesandordirs; Name: "{app}\resources\app\out"; Check: IsNotUpdate
Type: filesandordirs; Name: "{app}\resources\app\plugins"; Check: IsNotUpdate
Type: filesandordirs; Name: "{app}\resources\app\extensions"; Check: IsNotUpdate
Type: filesandordirs; Name: "{app}\resources\app\node_modules"; Check: IsNotUpdate
Type: filesandordirs; Name: "{app}\resources\app\node_modules.asar.unpacked"; Check: IsNotUpdate
Type: files; Name: "{app}\resources\app\node_modules.asar"; Check: IsNotUpdate
Type: files; Name: "{app}\resources\app\Credits_45.0.2454.85.html"; Check: IsNotUpdate

[UninstallDelete]
Type: filesandordirs; Name: "{app}\_"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked;
Name: "quicklaunchicon"; Description: "{cm:CreateQuickLaunchIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked; OnlyBelowVersion: 0,6.1
Name: "associatewithfiles"; Description: "{cm:AssociateWithFiles,{#NameLong}}"; GroupDescription: "{cm:Other}"; Flags: unchecked
Name: "addtopath"; Description: "{cm:AddToPath}"; GroupDescription: "{cm:Other}"
Name: "runcode"; Description: "{cm:RunAfter,{#NameShort}}"; GroupDescription: "{cm:Other}"; Check: WizardSilent

[Files]
Source: "*"; Excludes: "\CodeSignSummary*.md,\tools,\tools\*,\resources\app\product.json"; DestDir: "{code:GetDestDir}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "tools\*"; DestDir: "{app}\tools"; Flags: ignoreversion
Source: "{#ProductJsonPath}"; DestDir: "{code:GetDestDir}\resources\app"; Flags: ignoreversion

[Icons]
Name: "{group}\{#NameLong}"; Filename: "{app}\{#ExeBasename}.exe"; AppUserModelID: "{#AppUserId}"
Name: "{commondesktop}\{#NameLong}"; Filename: "{app}\{#ExeBasename}.exe"; Tasks: desktopicon; AppUserModelID: "{#AppUserId}"
Name: "{userappdata}\Microsoft\Internet Explorer\Quick Launch\{#NameLong}"; Filename: "{app}\{#ExeBasename}.exe"; Tasks: quicklaunchicon; AppUserModelID: "{#AppUserId}"

[Run]
Filename: "{app}\{#ExeBasename}.exe"; Description: "{cm:LaunchProgram,{#NameLong}}"; Tasks: runcode; Flags: nowait postinstall; Check: ShouldRunAfterUpdate
Filename: "{app}\{#ExeBasename}.exe"; Description: "{cm:LaunchProgram,{#NameLong}}"; Flags: nowait postinstall; Check: WizardNotSilent

[Registry]
#if "user" == InstallTarget
#define SoftwareClassesRootKey "HKCU"
#else
#define SoftwareClassesRootKey "HKLM"
#endif
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\{#RegValueName}SourceFile"; ValueType: string; ValueName: ""; ValueData: "{cm:SourceFile,{#NameLong}}"; Flags: uninsdeletekey
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\{#RegValueName}SourceFile\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\resources\app\resources\win32\code_file.ico"
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\{#RegValueName}SourceFile\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#ExeBasename}.exe"" ""%1"""
Root: HKCU; Subkey: "Environment"; ValueType: expandsz; ValueName: "Path"; ValueData: "{olddata};{app}\bin"; Tasks: addtopath; Check: NeedsAddPath(ExpandConstant('{app}\bin'))

; .sql
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\.sql\OpenWithProgids"; ValueType: none; ValueName: "{#RegValueName}"; Flags: deletevalue uninsdeletevalue; Tasks: associatewithfiles
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\.sql\OpenWithProgids"; ValueType: string; ValueName: "{#RegValueName}.sql"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatewithfiles
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\{#RegValueName}.sql"; ValueType: string; ValueName: ""; ValueData: "{cm:SourceFile,SQL}"; Flags: uninsdeletekey; Tasks: associatewithfiles
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\{#RegValueName}.sql"; ValueType: string; ValueName: "AppUserModelID"; ValueData: "{#AppUserId}"; Flags: uninsdeletekey; Tasks: associatewithfiles
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\{#RegValueName}.sql\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\resources\app\resources\win32\sql.ico"; Tasks: associatewithfiles
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\{#RegValueName}.sql\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#ExeBasename}.exe"" ""%1"""; Tasks: associatewithfiles

; .ipynb
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\.ipynb\OpenWithProgids"; ValueType: none; ValueName: "{#RegValueName}"; Flags: deletevalue uninsdeletevalue; Tasks: associatewithfiles
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\.ipynb\OpenWithProgids"; ValueType: string; ValueName: "{#RegValueName}.ipynb"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatewithfiles
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\{#RegValueName}.ipynb"; ValueType: string; ValueName: ""; ValueData: "{cm:SourceFile,IPYNB}"; Flags: uninsdeletekey; Tasks: associatewithfiles
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\{#RegValueName}.ipynb"; ValueType: string; ValueName: "AppUserModelID"; ValueData: "{#AppUserId}"; Flags: uninsdeletekey; Tasks: associatewithfiles
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\{#RegValueName}.ipynb\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\resources\app\resources\win32\ipynb.ico"; Tasks: associatewithfiles
Root: {#SoftwareClassesRootKey}; Subkey: "Software\Classes\{#RegValueName}.ipynb\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#ExeBasename}.exe"" ""%1"""; Tasks: associatewithfiles

; Environment
#if "user" == InstallTarget
#define EnvironmentRootKey "HKCU"
#define EnvironmentKey "Environment"
#define Uninstall64RootKey "HKCU64"
#define Uninstall32RootKey "HKCU32"
#else
#define EnvironmentRootKey "HKLM"
#define EnvironmentKey "System\CurrentControlSet\Control\Session Manager\Environment"
#define Uninstall64RootKey "HKLM64"
#define Uninstall32RootKey "HKLM32"
#endif

Root: {#EnvironmentRootKey}; Subkey: "{#EnvironmentKey}"; ValueType: expandsz; ValueName: "Path"; ValueData: "{olddata};{app}\bin"; Tasks: addtopath; Check: NeedsAddPath(ExpandConstant('{app}\bin'))

[Code]
// Don't allow installing conflicting architectures
function InitializeSetup(): Boolean;
var
  RegKey: String;
  ThisArch: String;
  AltArch: String;
begin
  Result := True;

  #if "user" == InstallTarget
    if not WizardSilent() and IsAdmin() then begin
      if MsgBox('This User Installer is not meant to be run as an Administrator. If you would like to install Azure Data Studio for all users in this system, download the System Installer instead from https://docs.microsoft.com/sql/azure-data-studio/download. Are you sure you want to continue?', mbError, MB_OKCANCEL) = IDCANCEL then begin
        Result := False;
      end;
    end;
  #endif

  #if "user" == InstallTarget
    #if "ia32" == Arch || "arm64" == Arch
      #define IncompatibleArchRootKey "HKLM32"
    #else
      #define IncompatibleArchRootKey "HKLM64"
    #endif

    if Result and not WizardSilent() then begin
      RegKey := 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\' + copy('{#IncompatibleTargetAppId}', 2, 38) + '_is1';

      if RegKeyExists({#IncompatibleArchRootKey}, RegKey) then begin
        if MsgBox('{#NameShort} is already installed on this system for all users. We recommend first uninstalling that version before installing this one. Are you sure you want to continue the installation?', mbConfirmation, MB_YESNO) = IDNO then begin
          Result := False;
        end;
      end;
    end;
  #endif

  if Result and IsWin64 then begin
    RegKey := 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\' + copy('{#IncompatibleArchAppId}', 2, 38) + '_is1';

    if '{#Arch}' = 'ia32' then begin
      Result := not RegKeyExists({#Uninstall64RootKey}, RegKey);
      ThisArch := '32';
      AltArch := '64';
    end else begin
      Result := not RegKeyExists({#Uninstall32RootKey}, RegKey);
      ThisArch := '64';
      AltArch := '32';
    end;

    if not Result and not WizardSilent() then begin
      MsgBox('Please uninstall the ' + AltArch + '-bit version of {#NameShort} before installing this ' + ThisArch + '-bit version.', mbInformation, MB_OK);
    end;
  end;
end;

function WizardNotSilent(): Boolean;
begin
  Result := not WizardSilent();
end;

// Updates
function IsBackgroundUpdate(): Boolean;
begin
  Result := ExpandConstant('{param:update|false}') <> 'false';
end;

function IsNotUpdate(): Boolean;
begin
  Result := not IsBackgroundUpdate();
end;

// AzureDataStudio will create a flag file before the update starts (/update=C:\foo\bar)
// - if the file exists at this point, the user quit AzureDataStudio before the update finished, so don't start AzureDataStudio after update
// - otherwise, the user has accepted to apply the update and AzureDataStudio should start
function LockFileExists(): Boolean;
begin
  Result := FileExists(ExpandConstant('{param:update}'))
end;

function ShouldRunAfterUpdate(): Boolean;
begin
  if IsBackgroundUpdate() then
    Result := not LockFileExists()
  else
    Result := True;
end;

function GetAppMutex(Value: string): string;
begin
  if IsBackgroundUpdate() then
    Result := ''
  else
    Result := '{#AppMutex}';
end;

function GetDestDir(Value: string): string;
begin
  if IsBackgroundUpdate() then
    Result := ExpandConstant('{app}\_')
  else
    Result := ExpandConstant('{app}');
end;

function BoolToStr(Value: Boolean): String;
begin
  if Value then
    Result := 'true'
  else
    Result := 'false';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  UpdateResultCode: Integer;
begin
  if IsBackgroundUpdate() and (CurStep = ssPostInstall) then
  begin
    CreateMutex('{#AppMutex}-ready');

    while (CheckForMutexes('{#AppMutex}')) do
    begin
      Log('Application is still running, waiting');
      Sleep(1000);
    end;

    Exec(ExpandConstant('{app}\tools\inno_updater.exe'), ExpandConstant('"{app}\{#ExeBasename}.exe" ' + BoolToStr(LockFileExists())), '', SW_SHOW, ewWaitUntilTerminated, UpdateResultCode);
  end;
end;

// https://stackoverflow.com/a/23838239/261019
procedure Explode(var Dest: TArrayOfString; Text: String; Separator: String);
var
  i, p: Integer;
begin
  i := 0;
  repeat
    SetArrayLength(Dest, i+1);
    p := Pos(Separator,Text);
    if p > 0 then begin
      Dest[i] := Copy(Text, 1, p-1);
      Text := Copy(Text, p + Length(Separator), Length(Text));
      i := i + 1;
    end else begin
      Dest[i] := Text;
      Text := '';
    end;
  until Length(Text)=0;
end;

function NeedsAddPath(Param: string): boolean;
var
  OrigPath: string;
begin
  if not RegQueryStringValue({#EnvironmentRootKey}, '{#EnvironmentKey}', 'Path', OrigPath)
  then begin
    Result := True;
    exit;
  end;
  Result := Pos(';' + Param + ';', ';' + OrigPath + ';') = 0;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Path: string;
  CarbonPath: string;
  Parts: TArrayOfString;
  NewPath: string;
  i: Integer;
begin
  if not CurUninstallStep = usUninstall then begin
    exit;
  end;
  if not RegQueryStringValue({#EnvironmentRootKey}, '{#EnvironmentKey}', 'Path', Path)
  then begin
    exit;
  end;
  NewPath := '';
  CarbonPath := ExpandConstant('{app}\bin')
  Explode(Parts, Path, ';');
  for i:=0 to GetArrayLength(Parts)-1 do begin
    if CompareText(Parts[i], CarbonPath) <> 0 then begin
      NewPath := NewPath + Parts[i];

      if i < GetArrayLength(Parts) - 1 then begin
        NewPath := NewPath + ';';
      end;
    end;
  end;
  RegWriteExpandStringValue({#EnvironmentRootKey}, '{#EnvironmentKey}', 'Path', NewPath);
end;

#ifdef Debug
  #expr SaveToFile(AddBackslash(SourcePath) + "code-processed.iss")
#endif
