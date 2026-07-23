' Roda o FoodSaaS Printer Agent sem abrir janela de terminal —
' e' isso que o usuario final ve (nada): o agente fica rodando
' em segundo plano, sem uma janela preta assustando ninguem.
Set objShell = CreateObject("WScript.Shell")
strPath = Left(WScript.ScriptFullName, Len(WScript.ScriptFullName) - Len(WScript.ScriptName))
objShell.Run """" & strPath & "FoodSaaS-Printer-Agent-win.exe""", 0, False
