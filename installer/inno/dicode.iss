; Dicode Windows installer (Inno Setup 6).
; Build: iscc installer\inno\dicode.iss
; Add /DBundleCodexRuntime only after confirming runtime redistribution rights.

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
ChangesEnvironment=yes

[Files]
; Dicode standalone EXE (Node 26 ESM SEA)
Source: "..\..\release\dicode.exe"; DestDir: "{app}"; Flags: ignoreversion
#ifdef BundleCodexRuntime
Source: "..\..\runtime\codex\codex.exe"; DestDir: "{app}\runtime\codex"; Flags: ignoreversion
Source: "..\..\runtime\codex\*"; DestDir: "{app}\runtime\codex"; Excludes: "codex.exe"; Flags: ignoreversion recursesubdirs
#endif
; Product resources
Source: "..\..\resources\*"; DestDir: "{app}\resources"; Flags: ignoreversion recursesubdirs skipifsourcedoesntexist
Source: "..\..\release\licenses\*"; DestDir: "{app}\licenses"; Flags: ignoreversion recursesubdirs skipifsourcedoesntexist

[Registry]
; Append install dir to current-user PATH (never overwrite), avoid duplicates.
Root: HKCU; Subkey: "Environment"; ValueType: expandsz; ValueName: "Path"; \
  ValueData: "{code:PathWithApp}"; Check: NeedsAddPath(ExpandConstant('{app}'))

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\{#MyAppExeName}"; Parameters: "doctor"; Description: "Run diagnostics"; Flags: postinstall nowait skipifsilent

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

function PathWithApp(Param: string): string;
var
  OrigPath, AppDir: string;
begin
  AppDir := ExpandConstant('{app}');
  if RegQueryStringValue(HKCU, 'Environment', 'Path', OrigPath) and (OrigPath <> '') then
    Result := OrigPath + ';' + AppDir
  else
    Result := AppDir;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Path, Entry: string;
  EntryPosition: Integer;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    if RegQueryStringValue(HKCU, 'Environment', 'Path', Path) then
    begin
      Path := ';' + Path + ';';
      Entry := ';' + ExpandConstant('{app}') + ';';
      EntryPosition := Pos(Uppercase(Entry), Uppercase(Path));
      if EntryPosition > 0 then
      begin
        Delete(Path, EntryPosition, Length(Entry) - 1);
        RegWriteExpandStringValue(HKCU, 'Environment', 'Path', Copy(Path, 2, Length(Path) - 2));
      end;
    end;
  end;
end;
