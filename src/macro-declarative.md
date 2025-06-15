# Declarative macros

## Source

Initialize a new workspace with `cargo init --lib`.

```rust
pub fn declarative_macro_vec_empty() -> Vec<i32> {
    let vec: Vec<i32> = vec![];
    vec
}

pub fn declarative_macro_vec_repeat() -> Vec<i32> {
    let vec: Vec<i32> = vec![1; 10];
    vec
}

pub fn declarative_macro_vec_list() -> Vec<i32> {
    let vec: Vec<i32> = vec![1, 2, 3];
    vec
}
```

[Declarative macros](https://doc.rust-lang.org/reference/macros-by-example.html) are defined with the `macro_rules!` language construct and they work through pattern matching on the syntax tree. The implementation handling the macro compilation can be found [here](https://github.com/rust-lang/rust/blob/64c81fd10509924ca4da5d93d6052a65b75418a5/compiler/rustc_expand/src/mbe/macro_rules.rs#L369) and [here](https://github.com/rust-lang/rust/blob/ec28ae9454139023117270985f114823d6570657/compiler/rustc_resolve/src/macros.rs#L1111).

Since declarative macros can be expanded to arbitrary Rust code based on the implementation of the macro, we will focus on the expanded Rust code rather than the generated binary files in this chapter.

If we look at the [`vec!`](https://github.com/rust-lang/rust/blob/ec28ae9454139023117270985f114823d6570657/library/alloc/src/macros.rs#L42) macro as an example, we see that it has 3 arms:
- the 1. one matching `vec![]`
- the 2. one matching `vec![1; 10]`
- the 3. one matching `vec![1, 2, 3]`

```rust
macro_rules! vec {
    () => (
        $crate::vec::Vec::new()
    );
    ($elem:expr; $n:expr) => (
        $crate::vec::from_elem($elem, $n)
    );
    ($($x:expr),+ $(,)?) => (
        <[_]>::into_vec(
            // Using the intrinsic produces a dramatic improvement in stack usage for
            // unoptimized programs using this code path to construct large Vecs.
            $crate::boxed::box_new([$($x),+])
        )
    );
}
```

## `declarative_macro_vec_empty`

```rust
pub fn declarative_macro_vec_empty() -> Vec<i32> {
    let vec: Vec<i32> = vec![];
    vec
}
```

```
$ cargo expand
...
pub fn declarative_macro_vec_empty() -> Vec<i32> {
    let vec: Vec<i32> = ::alloc::vec::Vec::new();
    vec
}

```

## `declarative_macro_vec_repeat`

```rust
pub fn declarative_macro_vec_repeat() -> Vec<i32> {
    let vec: Vec<i32> = vec![1; 10];
    vec
}
```

```
$ cargo expand
...
pub fn declarative_macro_vec_repeat() -> Vec<i32> {
    let vec: Vec<i32> = ::alloc::vec::from_elem(1, 10);
    vec
}
```

## `declarative_macro_vec_list`

```rust
pub fn declarative_macro_vec_list() -> Vec<i32> {
    let vec: Vec<i32> = vec![1, 2, 3];
    vec
}
```

```
$ cargo expand
...
pub fn declarative_macro_vec_list() -> Vec<i32> {
    let vec: Vec<i32> = <[_]>::into_vec(::alloc::boxed::box_new([1, 2, 3]));
    vec
}
```
