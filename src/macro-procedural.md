# Procedural macros

## Source

Initialize a new workspace with `cargo init --lib` and add `tokio` to the dependencies via `cargo add tokio --features full`.

```rust
#[tokio::main]
async fn proc_macro_main() {}
```

[Procedural macros](https://doc.rust-lang.org/reference/procedural-macros.html) can manipulate the syntax tree directly. They work with `TokenStream`s which are sequences of tokens representing Rust code. A proc macro receives a `TokenStream` as input and returns a `TokenStream` as output.

Since proc macros can be expanded to arbitrary Rust code based on the implementation of the macro, we will focus on the expanded Rust code rather than the generated binary files in this chapter.

If we look at the [`#[tokio::main]`](https://docs.rs/tokio/latest/tokio/attr.main.html) attribute proc macro as an example, we see that it is expanded to [this or similar code](https://docs.rs/tokio-macros/2.5.0/src/tokio_macros/lib.rs.html#226):

```rust
fn main() {
    tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .unhandled_panic(UnhandledPanic::ShutdownRuntime)
        .build()
        .unwrap()
        .block_on(async {
            let _ = tokio::spawn(async {
                panic!("This panic will shutdown the runtime.");
            }).await;
        })
}
```

## `proc_macro_main`

```rust
#[tokio::main]
async fn proc_macro_main() {}
```

```
$ cargo expand
...
fn proc_macro_main() {
    let body = async {};
    #[allow(
        clippy::expect_used,
        clippy::diverging_sub_expression,
        clippy::needless_return
    )]
    {
        return tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("Failed building the Runtime")
            .block_on(body);
    }
}
```
