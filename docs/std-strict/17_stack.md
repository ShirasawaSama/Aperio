# 17. 栈管理

Std-Strict **不暴露**栈指针（`sp`）和帧指针（`bp`）。所有栈操作通过 `stack.alloc` 原语完成。这样做的两个主要原因：

1. 避免手写汇编里最常见的坑——栈不平衡导致返回地址被破坏
2. 让同一份代码能编译到 WebAssembly，后者没有硬件栈指针

## stack.alloc

在当前函数的栈帧上分配一段连续字节，返回起始地址：

```
r<n> = stack.alloc(<size>)
```

- `<size>` 必须是编译期常量（整数或 `const`）
- 返回的地址可以当作普通内存指针使用

```text
pub fn example() -> r0 uses (r1, r2) {
    r1 = stack.alloc(16)          // 在栈上分配 16 字节
    mem.i32[r1]     = 100
    mem.i32[r1 + 4] = 200
    mem.i32[r1 + 8] = 300

    r2 = mem.i32[r1 + 4]          // 读回来 = 200

    r0 = 0
}
```

## 自动释放

`stack.alloc` 分配的内存**在函数返回时自动释放**。你永远不需要手动写 `stack.free` 之类的指令——也没有这样的指令存在。

这消除了栈溢出、栈不平衡等类别的 bug，代价是你**不能**让一段栈分配跨越函数边界。

## 生命周期

`stack.alloc` 返回的指针**在函数返回后就悬空**了。把它返回给调用者或者存到全局变量都是未定义行为：

```text
pub fn BAD() -> r0 {
    r0 = stack.alloc(16)        // 把栈地址作为返回值
    return                       // 返回后 r0 指向已失效的内存
}
```

编译器会对明显的情况（比如上面这种直接返回栈指针）给出警告，但它无法检测所有情况——比如把栈指针存到全局变量里。这个语义自己把握。

## 对齐

`stack.alloc` 返回的地址保证 **16 字节对齐**（与大多数 ABI 的栈对齐要求一致）。如果你需要更强的对齐（比如 AVX-512 的 64 字节对齐），可以多分配一些然后手动对齐：

```text
r1 = stack.alloc(128)            // 多分配
r1 = (r1 + 63) & ~63             // 向上对齐到 64 字节
```

## 分配多块

一个函数里可以多次调用 `stack.alloc`，每次都会得到新的、互不重叠的内存块：

```text
pub fn multi() -> r0 uses (r1, r2, r3) {
    r1 = stack.alloc(8)           // 第一块：r1
    r2 = stack.alloc(16)          // 第二块：r2
    r3 = stack.alloc(32)          // 第三块：r3
    // 三块互不重叠，都在本函数返回时统一释放
    // ...
    r0 = 0
}
```

所有分配会在**编译期**合并为单次栈帧调整（一次性移动 `sp`），不会在每次 `stack.alloc` 处生成单独的指令。

## 多返回值的替代：写回 buffer

多返回值一般直接用签名里的 `-> (r0, r3)` 形式解决，不需要栈。但如果你要返回一整块结构化数据（例如一个结构体），让调用方传入 buffer 指针、被调用方写回，仍然是更合适的方式：

```text
struct DivResult {
    quot: i64,
    rem:  i64,
}

// r1 = 被除数, r2 = 除数, r3 = 输出 buffer 指针
fn divmod_to_buffer(r1, r2, r3) -> r0 {
    mem.i64[r3 + DivResult.quot] = r1 / r2
    mem.i64[r3 + DivResult.rem]  = r1 % r2
    r0 = 0
}

pub fn caller() -> r0 uses (r1, r2, r3) {
    r3 = stack.alloc(DivResult.size)      // 分配返回 buffer
    divmod_to_buffer(r1 = 17, r2 = 5, r3 = r3)

    r1 = mem.i64[r3 + DivResult.quot]     // 商 = 3
    r2 = mem.i64[r3 + DivResult.rem]      // 余 = 2
    r0 = 0
}
```

## 栈传参

当函数用了栈参数（`stack[N]` 形式的参数，见 [11. ABI](./11_abi.md)），调用者需要在调用前把值写入对应位置。这时就需要用 `stack.alloc` 预留空间：

```text
pub fn many_args(r1, r2, stack[0], stack[8]) -> r0 uses (r3, r4) {
    r3 = mem.i64[stack[0]]
    r4 = mem.i64[stack[8]]
    r0 = r1 + r2 + r3 + r4
}

pub fn caller() -> r0 uses r5 {
    r5 = stack.alloc(16)
    mem.i64[r5]     = 100                 // 写入 stack[0] 位置的参数
    mem.i64[r5 + 8] = 200                 // 写入 stack[8] 位置的参数

    many_args(r1 = 1, r2 = 2)             // r0 = 303
}
```

具体的 `stack[N]` 如何和 `stack.alloc` 的指针对齐，是 Native-Strict 层面的细节；Std-Strict 只需要你遵守签名。
