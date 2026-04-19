.intel_syntax noprefix
.text
.globl main
main:
  push rbp
  mov rbp, rsp
  sub rsp, 32
  mov ecx, 0
  call ExitProcess
  mov rax, 0
.L_main_ret:
  add rsp, 32
  pop rbp
  ret

