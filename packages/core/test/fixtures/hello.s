.intel_syntax noprefix
.text
.globl main
main:
  push rbp
  mov rbp, rsp
  sub rsp, 32
  mov rax, 0
  jmp .L_main_ret
.L_main_ret:
  add rsp, 32
  pop rbp
  ret

