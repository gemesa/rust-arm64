# Introduction

This book explores how different Rust constructs translate to ARM64/AArch64 assembly.

:warning: :construction: The book is still under construction. New chapters will be added and the existing ones might be modified.

Since compilation involves multiple intermediate steps, we will trace through HIR, MIR and LLVM IR when it helps explain the final assembly output. We will only discuss the Rust frontend, not the LLVM backend. Still, for completeness, good documentation for the LLVM backend can be found [here](https://llvm.org/docs/WritingAnLLVMBackend.html).

The Rust compiler overview can be found [here](https://rustc-dev-guide.rust-lang.org/overview.html).
