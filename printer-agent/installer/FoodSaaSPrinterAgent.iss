; FoodSaaS Printer Agent — instalador Windows (Inno Setup)
;
; Estagio 1 do escopo pedido pelo usuario: acabar com a experiencia de
; "cole o token numa janela preta" — agora e' um instalador normal do
; Windows, pede a chave numa tela do proprio instalador, cria atalho,
; e liga sozinho no login sem mostrar terminal nenhum.
;
; Compilar: ISCC.exe FoodSaaSPrinterAgent.iss
; (precisa do .exe do agente ja compilado em ..\dist\FoodSaaS-Printer-Agent-win.exe
;  — rodar "npm run build:win" na pasta printer-agent antes)

#define MyAppName "FoodSaaS Printer Agent"
#define MyAppVersion "1.0.0"
#define MyAppExeName "FoodSaaS-Printer-Agent-win.exe"
#define MyAppPublisher "FoodSaaS"

[Setup]
AppId={{8F2C9E1A-4B3D-4A5E-9C7F-1D2E3F4A5B6C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\FoodSaaS\PrinterAgent
DefaultGroupName=FoodSaaS Printer Agent
DisableProgramGroupPage=yes
; Instala só para o usuário atual, sem pedir permissão de administrador —
; funcionários de loja normalmente não têm senha de admin no computador.
PrivilegesRequired=lowest
OutputDir=output
OutputBaseFilename=FoodSaaS-Printer-Agent-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\{#MyAppExeName}
DisableWelcomePage=no
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na Área de Trabalho"; GroupDescription: "Ícones adicionais:"; Flags: unchecked

[Files]
Source: "..\dist\FoodSaaS-Printer-Agent-win.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "RunHidden.vbs"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\FoodSaaS Printer Agent"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Desinstalar FoodSaaS Printer Agent"; Filename: "{uninstallexe}"
Name: "{userdesktop}\FoodSaaS Printer Agent"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
; Atalho na pasta Inicializar do Windows — liga sozinho no login, sem
; janela de terminal (usa o launcher oculto via wscript.exe).
Name: "{userstartup}\FoodSaaS Printer Agent"; Filename: "wscript.exe"; Parameters: """{app}\RunHidden.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\{#MyAppExeName}"

[Code]
var
  TokenPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  TokenPage := CreateInputQueryPage(wpSelectDir,
    'Chave de Ativação da Loja',
    'Cole a chave que aparece na tela Configurações → Impressão',
    'No painel do FoodSaaS, vá em Configurações → Impressão e copie a chave de ativação exibida lá. Cole ela abaixo (você pode instalar sem ela agora e configurar depois, mas o agente não vai funcionar até ter uma chave válida):');
  TokenPage.Add('Chave de ativação:', False);
end;

// Instalação silenciosa (/VERYSILENT, usada em testes automatizados e em
// scripts de deploy em massa) não pode ficar esperando alguém digitar a
// chave numa tela que nunca vai aparecer — pula essa página nesse caso.
function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  if (TokenPage <> nil) and (PageID = TokenPage.ID) and WizardSilent() then
    Result := True;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  EnvFile: string;
  Token: string;
begin
  if CurStep = ssPostInstall then
  begin
    Token := Trim(TokenPage.Values[0]);
    if Token <> '' then
    begin
      EnvFile := ExpandConstant('{app}\.env');
      SaveStringToFile(EnvFile, 'PRINTER_AUTH_TOKEN=' + Token + #13#10, False);
    end;
  end;
end;

[Run]
Filename: "wscript.exe"; Parameters: """{app}\RunHidden.vbs"""; WorkingDir: "{app}"; Flags: nowait postinstall skipifsilent; Description: "Iniciar o FoodSaaS Printer Agent agora"
