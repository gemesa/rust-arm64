# Introduction

This book explores how different Rust constructs translate to ARM64/AArch64 assembly.

Since compilation involves multiple intermediate steps, we will trace through HIR, MIR and LLVM IR when it helps explain the final assembly output. We will only discuss the Rust frontend, not the LLVM backend. Still, for completeness, good documentation for the LLVM backend can be found [here](https://llvm.org/docs/WritingAnLLVMBackend.html).

The Rust compiler overview can be found [here](https://rustc-dev-guide.rust-lang.org/overview.html).

## Prerequisites

### [Rust compiler](https://www.rust-lang.org/)

```
$ curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### AArch64 musl libraries

```
$ rustup target install aarch64-unknown-linux-musl
```

### AArch64 cross-compiler + binutils + sysroot


```
$ sudo dnf install gcc-aarch64-linux-gnu
$ sudo dnf install binutils-aarch64-linux-gnu
$ sudo dnf install sysroot-aarch64-fc41-glibc
```

### QEMU

```
$ sudo dnf install qemu-user
```

### [Ghidra](https://github.com/NationalSecurityAgency/ghidra/releases)

```
$ wget https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_11.3.2_build/ghidra_11.3.2_PUBLIC_20250415.zip
```
## Test the cross-compilation setup

```
$ echo 'fn main() { println!("Hello ARM64!"); }' > test.rs
$ rustc --target aarch64-unknown-linux-musl -C linker=aarch64-linux-gnu-gcc test.rs
$ qemu-aarch64 ./test
Hello ARM64!
```
