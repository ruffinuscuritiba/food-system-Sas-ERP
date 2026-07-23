; FoodSaaS Printer Agent — instalador Windows (Inno Setup)
;
; Estagio 1 do escopo pedido pelo usuario: acabar com a experiencia de
; "cole o token numa janela preta" — agora e' um instalador normal do
; Windows. Fluxo minimo, sem paginas de wizard: duplo-clique -> barra de
; progresso (com Cancelar) -> tela final com botao Fechar. A chave de
; ativacao NAO e' mais pedida durante a instalacao — fica num atalho
; separado ("Configurar Chave de Ativacao") que a pessoa clica quando
; quiser, e abre so um InputBox simples (nao reabre o instalador).
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
; Sem tela de boas-vindas, sem escolha de pasta, sem tela de confirmacao —
; duplo-clique vai direto pra barra de progresso. So a tela final
; (com o botao Fechar) continua aparecendo.
DisableWelcomePage=yes
DisableDirPage=yes
DisableReadyPage=yes
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
Source: "..\dist\FoodSaaS-Printer-Agent-win.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "RunHidden.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "ConfigureToken.vbs"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\FoodSaaS Printer Agent"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Configurar Chave de Ativação"; Filename: "wscript.exe"; Parameters: """{app}\ConfigureToken.vbs"""; WorkingDir: "{app}"
Name: "{group}\Desinstalar FoodSaaS Printer Agent"; Filename: "{uninstallexe}"
Name: "{userdesktop}\FoodSaaS Printer Agent"; Filename: "{app}\{#MyAppExeName}"
; Atalho na pasta Inicializar do Windows — liga sozinho no login, sem
; janela de terminal (usa o launcher oculto via wscript.exe).
Name: "{userstartup}\FoodSaaS Printer Agent"; Filename: "wscript.exe"; Parameters: """{app}\RunHidden.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\{#MyAppExeName}"

[Run]
Filename: "wscript.exe"; Parameters: """{app}\ConfigureToken.vbs"""; WorkingDir: "{app}"; Flags: nowait postinstall skipifsilent unchecked; Description: "Configurar a chave de ativação agora"
Filename: "wscript.exe"; Parameters: """{app}\RunHidden.vbs"""; WorkingDir: "{app}"; Flags: nowait postinstall skipifsilent; Description: "Iniciar o FoodSaaS Printer Agent agora"
