# 32. `std/stack` —— 栈分配

`std/stack` 提供在**当前函数栈帧**上申请临时内存的原语。申请的内存在函数返回时自动释放——无需手动 `free`。

## 导入

```rust
import "std/stack" as stack
```

## API

### `alloc<T>`

```rust
#[builtin] pub fn alloc<T>(count: u64) -> *T
```

在当前函数的栈帧上分配一块 `count * sizeof(T)` 字节的连续内存，按 `T` 的自然对齐对齐，返回一个 `*T` 指向第一个元素。

```rust
r1 = stack::alloc<i64>(1u64)                  // 一个 i64 槽
r1 = stack::alloc<Point>(count = 10u64)       // 10 个 Point
r1 = stack::alloc<u8>(count = 4096u64)        // 4KB 缓冲区
```

`count = 0` 是合法的——可能返回一个对齐到 `T` 的**可能同样合法也可能为空**的地址。别依赖它的具体值。

## 生命周期

分配的内存的生命周期是**分配它的函数的调用生命周期**：

- 函数返回时，内存立即释放
- 多个 `alloc` 调用可以并存——它们都属于当前栈帧，互不影响
- **不允许**把栈指针返回给调用者——返回后就是悬空指针，解引用是 UB

```rust
fn returns_dangling() -> (r0: *i64) {
    r0 = stack::alloc<i64>(1u64)
}                                             // r0 返回后指向释放的栈帧

fn caller() -> (r0: i64) uses r1 {
    r1 = returns_dangling()
    r0 = mem.i64[r1]                          // UB：解引用悬空指针
}
```

## 对齐

`alloc<T>` 总是按 `T` 的自然对齐分配：

- `T = u8` → 1 字节对齐
- `T = i32` → 4 字节对齐
- `T = i64` / `*T` → 8 字节对齐
- `T = Point`（内含 `i64`）→ 8 字节对齐
- `T = f64` → 8 字节对齐

想要更强的对齐（比如 64 字节缓存行），自己多申请一点再对齐：

```rust
r1 = stack::alloc<u8>(count = 128u64)         // 预留 128 字节
r2 = (ptr::to_addr<u8>(r1) + 63u64) & ~63u64  // 对齐到 64
r1 = ptr::from_addr<u8>(r2)
```

## 栈传参组合使用

当要调用的函数签名里有 `stack[N]` 参数时，通常的模式是：

```rust
fn many_args(r1: i64, r2: i64, r3: i64, r4: i64, stack[0]: i64) -> (r0: i64) { ... }

pub fn caller() -> (r0: i64) uses r9 {
    r9 = stack::alloc<i64>(count = 1u64)
    mem.i64[r9] = 42i64
    many_args(r1 = 1, r2 = 2, r3 = 3, r4 = 4, stack[0] = r9)
}
```

详见 [13. ABI 的栈传参](./13_abi.md#栈传参)。

## 注意事项

### 不要在循环里反复 alloc

栈分配是固定开销的——但每次 `alloc` 消耗都是累计的，直到函数返回才会释放。循环里反复 alloc 会在栈上占越来越多空间：

```rust
// 危险：每次迭代都累计一块栈内存
fn bad(r1: i64) -> (r0: i64) uses (r2, r3) {
    r0 = 0
@loop:
    if (r0 >= r1) goto(@done)
    r2 = stack::alloc<i64>(1000u64)              // 每次加 8000 字节
    // ...
    r0 = r0 + 1
    goto(@loop)
@done:
}
```

正确的做法是在循环**外**alloc 一次，循环体内复用：

```rust
fn good(r1: i64) -> (r0: i64) uses (r2, r3) {
    r2 = stack::alloc<i64>(1000u64)
    r0 = 0
@loop:
    if (r0 >= r1) goto(@done)
    // 用 r2 ...
    r0 = r0 + 1
    goto(@loop)
@done:
}
```

### 和 CPU 寄存器溢出共用栈

编译器自己也会把虚拟寄存器溢出到栈上。`stack::alloc` 申请的内存和寄存器溢出空间在同一个物理栈上，但 Aperio 保证两者**互不干扰**——你不需要关心布局细节。

## 为什么不提供 `free`

栈分配是**单调前进**的——没有办法"在函数中途释放一部分再释放另一部分"。想要灵活释放/复用？那不叫栈分配，那叫堆分配，请用 libc 的 `malloc` / `free`（通过 FFI）或者其他运行时的内存管理库。
