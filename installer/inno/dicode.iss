; Dicode Windows installer (Inno Setup 6).
; Build: iscc installer\inno\dicode.iss
; NOTE: Codex Runtime files are only included after distribution authorization.

#define MyAppName "Dicode"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "Dicode"
#define MyAppExeName "dicode.exe"

[Setup]
AppId={{7B4F6E2A-1C4D-4F5A-9E3B-2A6D8C1F5E0B}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
PrivilegesRequired=lowest
OutputDir=..\..\release
OutputBaseFilename=Dicode-Setup-x64
Compression=lzma2
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern

[Files]
; Dicode standalone EXE (Node 26 ESM SEA)
Source: "..\..\release\dicode.exe"; DestDir: "{app}"; Flags: ignoreversion
; Bundled Codex Runtime (stable 0.167.0)
Source: "..\..\runtime\codex\*"; DestDir: "{app}\runtime\codex"; Flags: ignoreversion recursesubdirs
; Product resources
Source: "..\..\resources\*"; DestDir: "{app}\resources"; Flags: ignoreversion recursesubdirs skipifsourcedoesntexist
Source: "..\..\runtime\codex\version.json"; DestDir: "{app}\runtime\codex"; Flags: ignoreversion skipifsourcedoesntexist

[Registry]
; Append install dir to current-user PATH (never overwrite), avoid duplicates.
Root: HKCU; Subkey: "Environment"; ValueType: expandsz; ValueName: "Path"; \
  ValueData: "{olddata};{app}"; Check: NeedsAddPath(ExpandConstant('{app}'))

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\{#MyAppExeName}"; Parameters: "--doctor"; Description: "Run diagnostics"; Flags: postinstall nowait skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\runtime\codex"
Type: filesandordirs; Name: "{app}\resources"

[Code]
function NeedsAddPath(Param: string): Boolean;
var
  OrigPath: string;
begin
  if not RegQueryStringValue(HKCU, 'Environment', 'Path', OrigPath) then
  begin
    Result := True;
    exit;
  end;
  Result := Pos(';' + Uppercase(Param) + ';', ';' + Uppercase(OrigPath) + ';') = 0;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Path, AppDir: string;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    AppDir := ExpandConstant('{app}');
    if RegQueryStringValue(HKCU, 'Environment', 'Path', Path) then
    begin
      StringChange(Path, ';' + AppDir, '');
      StringChange(Path, AppDir + ';', '');
      RegWriteStringValue(HKCU, 'Environment', 'Path', Path);
    end;
  end;
end;
