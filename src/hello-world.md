# Hello, world!

## Source

```rust
fn main() {
    println!("Hello, world!");
}
```

## Build

```
$ cargo rustc --release
```

## Ghidra

Load the binary into Ghidra and auto-analyze it.

### Locating `main`

In an `std` environment (as opposed to [`no_std`](https://docs.rust-embedded.org/book/intro/no-std.html)), the user-defined `main` function (here `rust_lab::main`) is called by [`lang_start_internal`](https://stdrs.dev/nightly/x86_64-unknown-linux-gnu/std/rt/fn.lang_start_internal.html).

Call graph:

```
_start
    _start_c
        __libc_start_main
            main
                lang_start_internal
                    rust_lab::main
```

Decompiled code:

```c
void main(int param_1,undefined8 param_2)

{
  code *pcStack_8;
  
  pcStack_8 = rust_lab::main;
  std::rt::lang_start_internal(&pcStack_8,&DAT_0046d6e8,(long)param_1,param_2,0);
  return;
}
```

`lang_start_internal` can be easily recognized, even if symbols are stripped. The first parameter is the `rust_lab::main` function being passed.

### `rust_lab::main`

Before we look at the disassembly and the decompiled code, it is a good idea to check the Rust code with the -non-internal- macros expanded:

```
$ cargo rustc --release --quiet -- -Z unpretty=expanded
#![feature(prelude_import)]
#[prelude_import]
use std::prelude::rust_2024::*;
#[macro_use]
extern crate std;
fn main() { { ::std::io::_print(format_args!("Hello, world!\n")); }; }
```

Alternatively, all macros (including the internal ones) are expanded in the HIR:

```
$ cargo rustc --release --quiet -- -Z unpretty=hir
#[prelude_import]
use std::prelude::rust_2024::*;
#[macro_use]
extern crate std;
fn main() {
    { ::std::io::_print(format_arguments::new_const(&["Hello, world!\n"])); };
}
```

As we can see, `println!` is expanded to a [`_print`](https://stdrs.dev/nightly/x86_64-unknown-linux-gnu/std/io/stdio/fn._print.html#) call, which accepts an [`Arguments`](https://stdrs.dev/nightly/x86_64-unknown-linux-gnu/std/fmt/struct.Arguments.html) struct.

While reconstructing the `Arguments` type, the type size information is very useful. Note that the compiler might reorder the struct fields.

```
$ cargo rustc --release --quiet -- -Z print-type-sizes 
print-type-size type: `core::fmt::rt::Placeholder`: 48 bytes, alignment: 8 bytes
print-type-size     field `.precision`: 16 bytes
print-type-size     field `.width`: 16 bytes
print-type-size     field `.position`: 8 bytes
print-type-size     field `.flags`: 4 bytes
print-type-size     end padding: 4 bytes
print-type-size type: `std::fmt::Arguments<'_>`: 48 bytes, alignment: 8 bytes
print-type-size     field `.pieces`: 16 bytes
print-type-size     field `.args`: 16 bytes
print-type-size     field `.fmt`: 16 bytes
...
print-type-size type: `core::fmt::rt::Argument<'_>`: 16 bytes, alignment: 8 bytes
print-type-size     field `.ty`: 16 bytes
print-type-size type: `core::fmt::rt::ArgumentType<'_>`: 16 bytes, alignment: 8 bytes
print-type-size     variant `Placeholder`: 16 bytes
print-type-size         field `.value`: 8 bytes
print-type-size         field `.formatter`: 8 bytes
print-type-size         field `._lifetime`: 0 bytes
print-type-size     variant `Count`: 10 bytes
print-type-size         padding: 8 bytes
print-type-size         field `.0`: 2 bytes, alignment: 2 bytes
print-type-size type: `core::fmt::rt::Count`: 16 bytes, alignment: 8 bytes
print-type-size     discriminant: 2 bytes
print-type-size     variant `Param`: 14 bytes
print-type-size         padding: 6 bytes
print-type-size         field `.0`: 8 bytes, alignment: 8 bytes
print-type-size     variant `Is`: 2 bytes
print-type-size         field `.0`: 2 bytes
print-type-size     variant `Implied`: 0 bytes
print-type-size type: `std::option::Option<&[core::fmt::rt::Placeholder]>`: 16 bytes, alignment: 8 bytes
print-type-size     variant `Some`: 16 bytes
print-type-size         field `.0`: 16 bytes
print-type-size     variant `None`: 0 bytes
...
```

The simplified `Arguments` type can be represented like this (explained in detail later). This is not valid C syntax of course, as `&`, `[]` or `<>` cannot be used in C struct names.

```
struct &[&str] {
    pointer64 ptr;
    ulonglong len;
};

struct &[Argument] {
    pointer64 ptr;
    ulonglong len;
};

struct Option<&[Placeholder]> {
    pointer64 ptr;
    ulonglong len;
};

struct Arguments {
    struct &[&str] pieces;
    struct &[Argument] args;
    struct Option<&[Placeholder]> fmt;
};
```

Listing:

```
                             **************************************************************
                             * rust_lab::main                                             *
                             **************************************************************
                             undefined __rustcall main()
             undefined         <UNASSIGNED>   <RETURN>
             undefined8        Stack[-0x10]:8 local_10                                XREF[2]:     00401af4(W), 
                                                                                                   00401b1c(R)  
             Arguments         Stack[-0x40]   arguments                               XREF[1,2]:   00401b04(W), 
                                                                                                   00401b14(W), 
                                                                                                   00401b10(W)  
                             _ZN8rust_lab4main17hf9a0ba7e2c977e69E           XREF[3]:     main:00401b38(*), 00453c6c, 
                             rust_lab::main                                               004648a8(*)  
        00401af0 ff 03 01 d1     sub        sp,sp,#0x40
        00401af4 fe 1b 00 f9     str        x30,[sp, #local_10]
        00401af8 68 03 00 90     adrp       x8,0x46d000
        00401afc 08 61 1c 91     add        x8,x8,#0x718
        00401b00 29 00 80 52     mov        w9,#0x1
                             store pieces.ptr and pieces.len
        00401b04 e8 27 00 a9     stp        x8=>PTR_s_Hello,_world!_0046d718,x9,[sp]=>argu   = 0044c1a0
        00401b08 08 01 80 52     mov        w8,#0x8
                             move the struct address to the first argument
        00401b0c e0 03 00 91     mov        x0,sp
                             zero out args.len and fmt.ptr
        00401b10 ff ff 01 a9     stp        xzr,xzr,[sp, #arguments+0x18]
                             store args.ptr
        00401b14 e8 0b 00 f9     str        x8,[sp, #arguments.args.ptr]
        00401b18 da 63 00 94     bl         std::io::stdio::_print                           undefined _print()
        00401b1c fe 1b 40 f9     ldr        x30,[sp, #local_10]
        00401b20 ff 03 01 91     add        sp,sp,#0x40
        00401b24 c0 03 5f d6     ret
```

The logic is simple: it constructs an `Arguments` struct on the stack and passes the address of it via `sp` to the `_print` function.

Decompiled code (after creating the `Arguments` type in the Structure Editor and applying it in the code):

```c
/* WARNING: Unknown calling convention: __rustcall */
/* rust_lab::main */

void __rustcall rust_lab::main(void)

{
  Arguments arguments;
  
                    /* store pieces.ptr and pieces.len */
  arguments.pieces.ptr = (undefined *)&PTR_s_Hello,_world!_0046d718;
  arguments.pieces.len = 1;
                    /* move the struct address to the first argument */
                    /* zero out args.len and fmt.ptr */
  arguments.args.len = 0;
  arguments.fmt.ptr = (undefined *)0x0;
                    /* store args.ptr */
  arguments.args.ptr = (undefined *)0x8;
  std::io::stdio::_print(&arguments);
  return;
}
```

From the [Rust reference](https://doc.rust-lang.org/reference/type-layout.html#pointers-and-references-layout):
> Though you should not rely on this, all pointers to DSTs are currently twice the size of the size of usize and have the same alignment.

In practice, this means that the fields of the struct `Arguments` are 16 bytes in memory: an 8 byte pointer and an 8 byte length. This is confirmed by the output of `-Z print-type-sizes` above.

`pieces` is a reference to a slice of `str` references. In this case, `pieces` only references 1 `str`.

`args` is a reference to a slice of `Argument` items and it references an empty slice now. Empty slices do not point to null but their size is 0. They point to valid addresses instead, depending on the alignment (8 bytes here).

```
print-type-size type: `core::fmt::rt::Argument<'_>`: 16 bytes, alignment: 8 bytes
print-type-size     field `.ty`: 16 bytes
```

```rust
fn main() {
    let empty_u8: &[u8] = &[];      // 1-byte aligned
    let empty_u32: &[u32] = &[];    // 4-byte aligned  
    let empty_u64: &[u64] = &[];    // 8-byte aligned
   
    println!("u8 address: {}", empty_u8.as_ptr() as usize);
    println!("u32 address: {}", empty_u32.as_ptr() as usize);
    println!("u64 address: {}", empty_u64.as_ptr() as usize);
}
```

```
$ cargo run --release --quiet
u8 address: 1
u32 address: 4
u64 address: 8
```

`fmt` is an optional reference to a slice of `Placeholder` items. For `Option<&[T]>`, Rust -often- uses null pointer optimization where `None` is represented by a null pointer. Therefore, the length field is irrelevant and is not populated in the current example.

```
print-type-size type: `std::option::Option<&[core::fmt::rt::Placeholder]>`: 16 bytes, alignment: 8 bytes
print-type-size     variant `Some`: 16 bytes
print-type-size         field `.0`: 16 bytes
print-type-size     variant `None`: 0 bytes
```

## `rust-gdb`

We can verify the results of our static analysis using `rust-gdb` (or `rust-lldb`) which supports Rust types.

First we need to create a debug build where the function `new_const` constructing the `Arguments` struct is not optimized and inlined.

```
$ cargo build
```

Then we start a GDB server and connect to it with our `rust-gdb` client.

```
$ qemu-aarch64 -g 1234 target/aarch64-unknown-linux-musl/debug/rust-lab
```

```
$ rust-gdb -q -ex "target remote localhost:1234" target/aarch64-unknown-linux-musl/debug/rust-lab
Reading symbols from target/aarch64-unknown-linux-musl/debug/rust-lab...
Remote debugging using localhost:1234

This GDB supports auto-downloading debuginfo from the following URLs:
  <https://debuginfod.fedoraproject.org/>
Enable debuginfod for this session? (y or [n]) y
Debuginfod has been enabled.
To make this setting permanent, add 'set debuginfod enabled on' to .gdbinit.
0x00000000004019bc in _start ()
(gdb) b rust_lab::main
Breakpoint 1 at 0x401bd4: file src/main.rs, line 2.
(gdb) c
Continuing.

Breakpoint 1, rust_lab::main () at src/main.rs:2
2	    println!("Hello, world!");
(gdb) disas
Dump of assembler code for function _ZN8rust_lab4main17hb3ccde9ab543d852E:
   0x0000000000401bc0 <+0>:	sub	sp, sp, #0x50
   0x0000000000401bc4 <+4>:	stp	x29, x30, [sp, #64]
   0x0000000000401bc8 <+8>:	add	x29, sp, #0x40
   0x0000000000401bcc <+12>:	add	x8, sp, #0x10
   0x0000000000401bd0 <+16>:	str	x8, [sp, #8]
=> 0x0000000000401bd4 <+20>:	adrp	x0, 0x46d000
   0x0000000000401bd8 <+24>:	add	x0, x0, #0x710
   0x0000000000401bdc <+28>:	bl	0x401b54 <_ZN4core3fmt2rt38_$LT$impl$u20$core..fmt..Arguments$GT$9new_const17h2005e5bc47942c4fE>
   0x0000000000401be0 <+32>:	ldr	x0, [sp, #8]
   0x0000000000401be4 <+36>:	bl	0x41abf0 <_ZN3std2io5stdio6_print17h5a3b0843896b0124E>
   0x0000000000401be8 <+40>:	ldp	x29, x30, [sp, #64]
   0x0000000000401bec <+44>:	add	sp, sp, #0x50
   0x0000000000401bf0 <+48>:	ret
End of assembler dump.
(gdb) si 3
core::fmt::Arguments::new_const<1> (pieces=0x7f867d3fe830)
    at /home/gemesa/.rustup/toolchains/nightly-x86_64-unknown-linux-gnu/lib/rustlib/src/rust/library/core/src/fmt/rt.rs:226
226	    pub const fn new_const<const N: usize>(pieces: &'a [&'static str; N]) -> Self {
(gdb) fin
Run till exit from #0  core::fmt::Arguments::new_const<1> (pieces=0x7f867d3fe830)
    at /home/gemesa/.rustup/toolchains/nightly-x86_64-unknown-linux-gnu/lib/rustlib/src/rust/library/core/src/fmt/rt.rs:226
0x0000000000401be0 in rust_lab::main () at src/main.rs:2
2	    println!("Hello, world!");
Value returned is $1 = core::fmt::Arguments {pieces: &[&str](size=1) = {"Hello, world!\n"}, fmt: core::option::Option<&[core::fmt::rt::Placeholder]>::None, args: &[core::fmt::rt::Argument](size=0)}
(gdb)
```

The value returned matches the expected `Arguments` struct.
