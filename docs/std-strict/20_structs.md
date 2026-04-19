# 16. 结构体

Aperio 的 `struct` 不是高级语言里的对象，它只是**一张编译期偏移量表**——用于给内存布局里的各个字段起名字，方便阅读和维护。

## 定义

```rust
struct Point {
    x: i32,
    y: i32,
}

struct Node {
    next:  u64,
    value: i64,
    flags: u32,
    _pad:  u32,       // 显式对齐填充
}
```

结构体定义本身**不分配任何内存**。它只在编译器的符号表中注册一组字段名到偏移量的映射。

## 字段偏移

字段按声明顺序依次排列，**不自动插入对齐填充**。每个字段的偏移量可以用 `StructName.field` 语法获取，值是一个编译期常量：

```rust
struct Point {
    x: i32,    // offset: 0
    y: i32,    // offset: 4
}

const X_OFFSET: u32 = Point.x     // 0
const Y_OFFSET: u32 = Point.y     // 4
const POINT_SIZE: u32 = Point.size // 8（编译器合成的 size 属性）
```

## 用法

典型的用法是访问一个指向结构体实例的内存：

```rust
struct Point {
    x: i32,
    y: i32,
}

// 假设 r1 存放的是一个 Point 的指针
pub fn add_to_x(r1, r2) -> r0 uses r3 {
    r3 = mem.i32[r1 + Point.x]     // 读 x
    r3 = r3 + r2
    mem.i32[r1 + Point.x] = r3     // 写回 x
    r0 = 0
}
```

使用 `Point.x` 比直接写 `+ 0` 更清晰，更容易在后续调整字段顺序时跟着变化。

## 对齐与填充

Std-Strict **不自动填充**对齐字节。如果你需要字段按特定对齐，自己用显式的占位字段：

```rust
struct Header {
    magic:    u32,       // offset: 0
    _pad0:    u32,       // offset: 4 (手动填充)
    payload:  u64,       // offset: 8
}
```

这样做的理由是：让内存布局完全由开发者控制。不同架构对对齐的要求不同，自动填充会在 x86、ARM、Wasm 之间产生不一致的结果。

如果你就是想要"像 C 那样自动对齐"，可以使用 Loose 模式，它会在降级时自动插入填充字段。

## size 属性

每个 struct 自动带一个 `.size` 编译期属性，返回它占用的总字节数：

```rust
struct Vec3 { x: f32, y: f32, z: f32 }

const VEC3_SIZE: u32 = Vec3.size       // 12

var BUFFER: u8[Vec3.size * 100]        // 1200 字节，足够放 100 个 Vec3
```

## 不能做的事

`struct` **只是语法糖**，它不引入任何运行时机制：

- 不能"实例化"一个 struct 并放到寄存器里
- 不能直接对 struct 整体赋值：`mem.Point[r1] = mem.Point[r2]` **非法**
- 不能把 struct 作为参数传递：参数都是单个寄存器或栈槽

需要拷贝一个结构体？按字段或按字节显式写：

```rust
// 拷贝 r1 指向的 Point 到 r2 指向的位置
r3 = mem.i32[r1 + Point.x]
mem.i32[r2 + Point.x] = r3
r3 = mem.i32[r1 + Point.y]
mem.i32[r2 + Point.y] = r3
```

或者用某种 `memcpy` 内置原语（如果运行时提供）。

## 可见性

结构体定义可以加 `pub` 让其他模块可见：

```rust
pub struct Request {
    id:     u32,
    kind:   u8,
    _pad:   u8[3],
    length: u32,
}
```

没有 `pub` 的 struct 只能在本模块内使用。
