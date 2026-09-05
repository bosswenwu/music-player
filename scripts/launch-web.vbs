Option Explicit
Dim sh, fso, root, node, target
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
target = root & "\scripts\open-web.mjs"

node = FindNode()
If node = "" Then
  MsgBox "找不到 Node.js，无法打开音乐网页。", 16, "音乐"
  WScript.Quit 1
End If

sh.CurrentDirectory = root
sh.Run """" & node & """ """ & target & """", 0, False

Function FindNode()
  Dim candidates, i, whereOut, lines
  candidates = Array( _
    sh.ExpandEnvironmentStrings("%ProgramFiles%\nodejs\node.exe"), _
    "C:\Program Files\nodejs\node.exe", _
    sh.ExpandEnvironmentStrings("%LOCALAPPDATA%\fnm_multishells") _
  )
  For i = 0 To 1
    If fso.FileExists(candidates(i)) Then
      FindNode = candidates(i)
      Exit Function
    End If
  Next
  On Error Resume Next
  whereOut = sh.Exec("cmd /c where node").StdOut.ReadAll
  On Error GoTo 0
  If Len(Trim(whereOut)) > 0 Then
    lines = Split(Replace(Trim(whereOut), vbCrLf, vbLf), vbLf)
    If fso.FileExists(lines(0)) Then
      FindNode = lines(0)
      Exit Function
    End If
  End If
  FindNode = ""
End Function
