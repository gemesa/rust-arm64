# Prerequisites

## [Rust compiler](https://www.rust-lang.org/)

```
$ curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## AArch64 musl libraries

```
$ rustup target install aarch64-unknown-linux-musl
```

## Rust nightly toolchain

This is necessary because we will be using some nightly features.

```
$ rustup install nightly
$ rustup default nightly
```

Alternatively, just override the default toolchain in your working directory:

```
$ rustup override set nightly
```

## Rust default config

```
$ export CARGO_BUILD_TARGET=aarch64-unknown-linux-musl
$ export CARGO_TARGET_AARCH64_UNKNOWN_LINUX_MUSL_LINKER=aarch64-linux-gnu-gcc
$ export CARGO_TARGET_AARCH64_UNKNOWN_LINUX_MUSL_RUNNER="qemu-aarch64"
```

Alternatively, add the following to `.cargo/config.toml`:

```
[build]
target = "aarch64-unknown-linux-musl"

[target.aarch64-unknown-linux-musl]
linker = "aarch64-linux-gnu-gcc"
runner = "qemu-aarch64"
```

## AArch64 cross-compiler + binutils + sysroot


```
$ sudo dnf install gcc-aarch64-linux-gnu
$ sudo dnf install binutils-aarch64-linux-gnu
$ sudo dnf install sysroot-aarch64-fc41-glibc
```

## LLVM

Necessary for binutils, e.g. `llvm-objdump`.

```
$ sudo dnf install llvm
```

## `rustfilt` (optional)

If you need to manually demangle a symbol, `rustfilt` is very convenient:

```
$ cargo install rustfilt
$ echo _ZN8rust_lab4main17hf9a0ba7e2c977e69E | rustfilt
rust_lab::main
```

## QEMU

```
$ sudo dnf install qemu-user
```

## [Ghidra](https://github.com/NationalSecurityAgency/ghidra/releases)

```
$ wget https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_11.3.2_build/ghidra_11.3.2_PUBLIC_20250415.zip
```

# Test the cross-compilation setup

With a Cargo project:

```
$ cargo init
$ cargo build
$ cargo run --quiet
Hello, world!
```

Without a Cargo project:

```
$ echo 'fn main() { println!("Hello ARM64!"); }' > test.rs
$ rustc --target aarch64-unknown-linux-musl -C linker=aarch64-linux-gnu-gcc test.rs
$ qemu-aarch64 ./test
Hello ARM64!
```
