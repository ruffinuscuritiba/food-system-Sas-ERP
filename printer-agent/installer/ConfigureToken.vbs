' Configurar Chave de Ativacao — janela simples (InputBox nativo do Windows,
' nao reabre o instalador) pra colar/trocar a chave a qualquer momento
' depois de instalado. Disponivel pelo atalho "Configurar Chave de
' Ativacao" no Menu Iniciar, ou logo apos a instalacao (checkbox opcional
' na tela final).
Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

strPath = Left(WScript.ScriptFullName, Len(WScript.ScriptFullName) - Len(WScript.ScriptName))
strEnvFile = strPath & ".env"

strToken = InputBox( _
  "Cole a chave que aparece em Configurações -> Impressão no painel FoodSaaS:", _
  "FoodSaaS Printer Agent — Configurar Chave de Ativação")

strToken = Trim(strToken)

If strToken <> "" Then
  Set objFile = objFSO.CreateTextFile(strEnvFile, True)
  objFile.WriteLine "PRINTER_AUTH_TOKEN=" & strToken
  objFile.Close
  MsgBox "Chave salva! O assistente vai usar ela a partir de agora.", vbInformation, "FoodSaaS Printer Agent"
End If
