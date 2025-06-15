# Built-in declarative macros

## Source

Initialize a new workspace with `cargo init --lib`.

```rust
pub fn format_args_built_in() {
    println!("Hello, world!");
}
```

Built-in declarative macros are a special type of [declarative macros](./macro-declarative.md). They are marked with [`#[rustc_builtin_macro]`](https://github.com/rust-lang/rust/blob/ec28ae9454139023117270985f114823d6570657/compiler/rustc_resolve/src/macros.rs#L1132) and expanded with an internal [expander function](https://github.com/rust-lang/rust/blob/ec28ae9454139023117270985f114823d6570657/compiler/rustc_resolve/src/macros.rs#L1134). The list of the built-in macros can be found [here](https://github.com/rust-lang/rust/blob/ec28ae9454139023117270985f114823d6570657/compiler/rustc_builtin_macros/src/lib.rs#L78).

If we look at the [`format_args!`](https://github.com/rust-lang/rust/blob/64c81fd10509924ca4da5d93d6052a65b75418a5/library/core/src/macros/mod.rs#L1004) macro as an example, we see that it is marked with `#[rustc_builtin_macro]` and the [expander function](https://github.com/rust-lang/rust/blob/ec28ae9454139023117270985f114823d6570657/compiler/rustc_builtin_macros/src/lib.rs#L92) is [`expand_format_args`](https://github.com/rust-lang/rust/blob/ec28ae9454139023117270985f114823d6570657/compiler/rustc_builtin_macros/src/format.rs#L1032) which calls [`expand_format_args_impl`](https://github.com/rust-lang/rust/blob/ec28ae9454139023117270985f114823d6570657/compiler/rustc_builtin_macros/src/format.rs#L1006).

```rust
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_diagnostic_item = "format_args_macro"]
#[allow_internal_unsafe]
#[allow_internal_unstable(fmt_internals)]
#[rustc_builtin_macro]
#[macro_export]
macro_rules! format_args {
    ($fmt:expr) => {{ /* compiler built-in */ }};
    ($fmt:expr, $($args:tt)*) => {{ /* compiler built-in */ }};
}
```

## `format_args_built_in`

```rust
pub fn format_args_built_in() {
    println!("Hello, world!");
}
```
Built-in macros are not expanded to Rust code which means `cargo expand` cannot show us their expanded form:

```
$ cargo expand
...
pub fn format_args_built_in() {
    {
        ::std::io::_print(format_args!("Hello, world!\n"));
    };
}
```
Instead, they are expanded in the HIR:

```
$ cargo rustc --release --quiet -- -Z unpretty=hir
...
fn format_args_built_in() {
    { ::std::io::_print(format_arguments::new_const(&["Hello, world!\n"])); };
}
```
