# 34. `std/simd` —— 向量运算（占位）

**状态：规划中，尚未提供稳定 API。**

本章只给出方向和预留语法，细节等到设计冻结后再补完。

## 预期形态

一组虚拟向量寄存器：

- `v0` – `v127`，每个 128 位宽（后端按需在 x86 SSE/AVX、ARM NEON、Wasm SIMD、RISC-V V 之间 lowering）
- 类型标注写在操作上：`simd::add_i32x4(v1, v2)`、`simd::mul_f32x4(v1, v2)`

预期 API 片段（**非最终**）：

```rust
#[builtin] pub fn load_i32x4(addr: *i32) -> v_i32x4
#[builtin] pub fn store_i32x4(addr: *i32, value: v_i32x4)
#[builtin] pub fn add_i32x4(a: v_i32x4, b: v_i32x4) -> v_i32x4
#[builtin] pub fn mul_f32x4(a: v_f32x4, b: v_f32x4) -> v_f32x4
#[builtin] pub fn shuffle_f32x4<MASK>(a: v_f32x4, b: v_f32x4) -> v_f32x4
```

## 设计问题

以下问题还在讨论，任何当前答案都是占位：

1. **向量类型系统**：是给 `v_*` 一个专门的类型族（类似 `*T`）？还是让 `f*` 寄存器承载？
2. **对齐约束**：强制 128 位对齐，还是允许非对齐 load？
3. **lane 访问**：`v1[0]` 还是 `simd::extract(v1, 0)`？
4. **占位符宽度**：Wasm SIMD 固定 128 位，AVX 可到 512 位——要不要暴露更宽的类型？
5. **mask 类型**：bitmask（`u8` for 8 lanes）还是 bool 向量？

## 临时替代方案

想立刻用 SIMD？两条路径：

1. **FFI 进 C 库**：用 C 的 intrinsics 写 SIMD kernel，通过 `extern fn` 暴露
2. **手写内联汇编**：等 `std/asm` 稳定后可以直接在 `.ap` 里写
3. **循环**：编译器的自动向量化对简单循环有效（尤其 Loose 模式降级出来的循环）

## 跟进

当这一章正式启动时，会涉及：

- 新增 `v0` – `v127` 寄存器文件（和 `r*` / `f*` 平行）
- `04_types.md` 加向量类型族
- `std/simd` 完整 API 列表
- 跨平台 lowering 策略
- 检测与降级（目标不支持时）

在此之前，本章只作"占位"出现在文档目录里，提醒读者这个方向存在。
