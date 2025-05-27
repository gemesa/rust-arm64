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

Listing:

```
                             **************************************************************
                             *                          FUNCTION                          *
                             **************************************************************
                             undefined main()
             undefined         <UNASSIGNED>   <RETURN>
             undefined8        Stack[-0x10]:8 local_10                                XREF[1]:     00401b58(W)  
                             main                                            XREF[5]:     Entry Point(*), 
                                                                                          _start_c:00401a14(*), 00454cbc, 
                                                                                          00464b04(*), 0046ffa8(*)  
        00401b48 08 00 00 90     adrp       x8,0x401000
        00401b4c 08 41 2c 91     add        x8,x8,#0xb10
        00401b50 e3 03 01 aa     mov        x3,x1
        00401b54 02 7c 40 93     sxtw       x2,w0
        00401b58 fe 23 bf a9     stp        x30,x8=>rust_lab::main,[sp, #local_10]!
        00401b5c 61 03 00 90     adrp       x1,0x46d000
        00401b60 21 80 20 91     add        x1=>DAT_0046d820,x1,#0x820
        00401b64 e0 23 00 91     add        x0,sp,#0x8
        00401b68 e4 03 1f 2a     mov        w4,wzr
        00401b6c fc 58 00 94     bl         std::rt::lang_start_internal                     undefined lang_start_internal()
        00401b70 fe 07 41 f8     ldr        x30,[sp], #0x10
        00401b74 c0 03 5f d6     ret
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

Listing:

```
                             **************************************************************
                             * rust_lab::main                                             *
                             **************************************************************
                             undefined __rustcall main()
             undefined         <UNASSIGNED>   <RETURN>
             undefined8        Stack[-0x10]:8 local_10                                XREF[2]:     00401b14(W), 
                                                                                                   00401b3c(R)  
             Arguments         Stack[-0x40]   arguments                               XREF[1,2]:   00401b24(W), 
                                                                                                   00401b34(W), 
                                                                                                   00401b30(W)  
                             _ZN8rust_lab4main17h5a3b3b5819298371E           XREF[3]:     main:00401b58(*), 00454cb4, 
                             rust_lab::main                                               00464ae8(*)  
        00401b10 ff 03 01 d1     sub        sp,sp,#0x40
        00401b14 fe 1b 00 f9     str        x30,[sp, #local_10]
        00401b18 68 03 00 90     adrp       x8,0x46d000
        00401b1c 08 41 21 91     add        x8,x8,#0x850
        00401b20 29 00 80 52     mov        w9,#0x1
        00401b24 e8 27 00 a9     stp        x8=>PTR_s_hello_world_0046d850,x9,[sp]=>argume   = 0044d830
        00401b28 08 01 80 52     mov        w8,#0x8
        00401b2c e0 03 00 91     mov        x0,sp
        00401b30 ff ff 01 a9     stp        xzr,xzr,[sp, #arguments+0x18]
        00401b34 e8 0b 00 f9     str        x8,[sp, #arguments.args.ptr]
        00401b38 45 61 00 94     bl         std::io::stdio::_print                           undefined _print()
        00401b3c fe 1b 40 f9     ldr        x30,[sp, #local_10]
        00401b40 ff 03 01 91     add        sp,sp,#0x40
        00401b44 c0 03 5f d6     ret
```

Decompiled code (after creating the `Arguments` type in the Structure Editor and applying it in the code):

```c
/* WARNING: Unknown calling convention: __rustcall */
/* rust_lab::main */

void __rustcall rust_lab::main(void)

{
  Arguments arguments;
  
  arguments.pieces.ptr = (undefined *)&PTR_s_hello_world_0046d850;
  arguments.pieces.len = 1;
  arguments.args.len = 0;
  arguments.fmt.ptr = (undefined *)0x0;
  arguments.args.ptr = &DAT_00000008;
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
