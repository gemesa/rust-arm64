# `Option`

## Source

Initialize a new workspace with `cargo init --lib`.

```rust
#[unsafe(no_mangle)]
pub fn safe_divide(dividend: i32, divisor: i32) -> Option<i32> {
    if divisor == 0 {
        None
    } else {
        Some(dividend / divisor)
    }
}

#[unsafe(no_mangle)]
pub fn process_option(value: Option<i32>) -> i32 {
    match value {
        Some(x) => x * 2,
        None => 0,
    }
}

#[unsafe(no_mangle)]
pub fn process_str_option(value: Option<&str>) -> usize {
    match value {
        Some(s) => s.len(),
        None => 0,
    }
}

#[unsafe(no_mangle)]
pub fn process_box_option(value: Option<Box<i32>>) -> i32 {
    match value {
        Some(boxed) => *boxed,
        None => -1,
    }
}
```

The `Option` type is described in the [official docs](https://doc.rust-lang.org/std/option/) in detail.

In some cases, simple functions e.g. `process_option` might be inlined by the compiler. For this reason, these are not present in the `.o` file, only in `.rmeta`. The inlining will be done based on the information (e.g. function signatures, type information and encoded MIR) available in the `.rmeta` file. Information about the `.rmeta` file format can be found [here](https://rustc-dev-guide.rust-lang.org/backend/libs-and-metadata.html#rmeta). We want to see the generated code for our sample functions in the `.o` file, so this optimization is undesirable for us. A possible solution is to use `#[unsafe(no_mangle)]` which has 2 effects:
- Do not mangle the symbol name.
- Export this symbol. `#[unsafe(no_mangle)]` implies that the function is intended to be called from outside of the current compilation unit (e.g. from C code or another Rust crate with a different LTO context). For this reason, it will be present in the `.o` file.

Without `#[unsafe(no_mangle)]`:

```
$ llvm-objdump --syms target/aarch64-unknown-linux-musl/release/deps/*.o

target/aarch64-unknown-linux-musl/release/deps/rust_lab-35c360f17fe9ba7d.o:     file format elf64-littleaarch64

SYMBOL TABLE:
0000000000000000 l    df *ABS*  0000000000000000 rust_lab.e234cd7f6b439d7e-cgu.0
0000000000000000 l    d  .text._ZN8rust_lab11safe_divide17h459bac753259da22E    0000000000000000 .text._ZN8rust_lab11safe_divide17h459bac753259da22E
0000000000000000 l       .text._ZN8rust_lab11safe_divide17h459bac753259da22E    0000000000000000 $x
0000000000000000 l    d  .text._ZN8rust_lab18process_box_option17h2a7f2c1809e960d7E     0000000000000000 .text._ZN8rust_lab18process_box_option17h2a7f2c1809e960d7E
0000000000000000 l       .text._ZN8rust_lab18process_box_option17h2a7f2c1809e960d7E     0000000000000000 $x
0000000000000000 l    d  .rodata..Lalloc_f5ffd2fd1476bab43ad89fb40c72d0c5       0000000000000000 .rodata..Lalloc_f5ffd2fd1476bab43ad89fb40c72d0c5
0000000000000000 l       .rodata..Lalloc_f5ffd2fd1476bab43ad89fb40c72d0c5       0000000000000000 $d
0000000000000000 l    d  .data.rel.ro..Lalloc_0ea055d83440e297c58eb113a9bcb2e2  0000000000000000 .data.rel.ro..Lalloc_0ea055d83440e297c58eb113a9bcb2e2
0000000000000000 l       .data.rel.ro..Lalloc_0ea055d83440e297c58eb113a9bcb2e2  0000000000000000 $d
0000000000000000 l       .comment       0000000000000000 $d
0000000000000000 l       .eh_frame      0000000000000000 $d
0000000000000000 g     F .text._ZN8rust_lab11safe_divide17h459bac753259da22E    0000000000000040 _ZN8rust_lab11safe_divide17h459bac753259da22E
0000000000000000         *UND*  0000000000000000 _ZN4core9panicking11panic_const24panic_const_div_overflow17h2ce15414ba9ec1bdE
0000000000000000 g     F .text._ZN8rust_lab18process_box_option17h2a7f2c1809e960d7E     0000000000000044 _ZN8rust_lab18process_box_option17h2a7f2c1809e960d7E
0000000000000000         *UND*  0000000000000000 _RNvCsdk9DaPZnL1i_7___rustc14___rust_dealloc
```

With `#[unsafe(no_mangle)]`:

```
$ llvm-objdump --syms target/aarch64-unknown-linux-musl/release/deps/*.o

target/aarch64-unknown-linux-musl/release/deps/rust_lab-35c360f17fe9ba7d.o:     file format elf64-littleaarch64

SYMBOL TABLE:
0000000000000000 l    df *ABS*  0000000000000000 rust_lab.e234cd7f6b439d7e-cgu.0
0000000000000000 l    d  .text.safe_divide      0000000000000000 .text.safe_divide
0000000000000000 l       .text.safe_divide      0000000000000000 $x
0000000000000000 l    d  .text.process_option   0000000000000000 .text.process_option
0000000000000000 l       .text.process_option   0000000000000000 $x
0000000000000000 l    d  .text.process_str_option       0000000000000000 .text.process_str_option
0000000000000000 l       .text.process_str_option       0000000000000000 $x
0000000000000000 l    d  .text.process_box_option       0000000000000000 .text.process_box_option
0000000000000000 l       .text.process_box_option       0000000000000000 $x
0000000000000000 l    d  .rodata..Lalloc_f5ffd2fd1476bab43ad89fb40c72d0c5       0000000000000000 .rodata..Lalloc_f5ffd2fd1476bab43ad89fb40c72d0c5
0000000000000000 l       .rodata..Lalloc_f5ffd2fd1476bab43ad89fb40c72d0c5       0000000000000000 $d
0000000000000000 l    d  .data.rel.ro..Lalloc_0ea055d83440e297c58eb113a9bcb2e2  0000000000000000 .data.rel.ro..Lalloc_0ea055d83440e297c58eb113a9bcb2e2
0000000000000000 l       .data.rel.ro..Lalloc_0ea055d83440e297c58eb113a9bcb2e2  0000000000000000 $d
0000000000000000 l       .comment       0000000000000000 $d
0000000000000000 l       .eh_frame      0000000000000000 $d
0000000000000000 g     F .text.safe_divide      0000000000000040 safe_divide
0000000000000000         *UND*  0000000000000000 _ZN4core9panicking11panic_const24panic_const_div_overflow17h2ce15414ba9ec1bdE
0000000000000000 g     F .text.process_option   0000000000000010 process_option
0000000000000000 g     F .text.process_str_option       000000000000000c process_str_option
0000000000000000 g     F .text.process_box_option       0000000000000044 process_box_option
0000000000000000         *UND*  0000000000000000 _RNvCsdk9DaPZnL1i_7___rustc14___rust_dealloc
```

## Build

```
$ cargo rustc --release -- --emit obj,mir,llvm-ir
```

## Ghidra

Load the `.o` file (located at `target/aarch64-unknown-linux-musl/release/deps/`) into Ghidra and auto-analyze it.

### Layout

[`Option`]((https://doc.rust-lang.org/std/option/enum.Option.html)) is an `Enum` type which is conceptually a tagged union with a discriminant and data. However, Rust often applies [discriminant elision](https://github.com/rust-lang/unsafe-code-guidelines/blob/c138499c1de03b908dfe719a41193c84f8146883/reference/src/layout/enums.md#layout-of-a-data-carrying-enums-without-a-repr-annotation). For common types like references and `Box<T>`, `None` is represented using invalid bit patterns (like null pointers, see chapter [Null pointer optimization](#null-pointer-optimization)) rather than a separate discriminant field, making `Option<T>` the same size as `T`. In case of the `None` variant, the data value is undefined. We will see this in the generated code but this is [documented](https://doc.rust-lang.org/std/option/enum.Option.html#method.unwrap_unchecked) as well. The exact memory layout is unspecified without explicit `#[repr]` attributes.

### `safe_divide`

```rust
#[unsafe(no_mangle)]
pub fn safe_divide(dividend: i32, divisor: i32) -> Option<i32> {
    if divisor == 0 {
        None
    } else {
        Some(dividend / divisor)
    }
}
```

The generated assembly is straightforward, there is only one piece of background information we need to know to fully understand it. The compiler automatically generates a check which makes sure to panic if the result would overflow. In case of `i32`, there is only one such scenario: dividend is [`i32::MIN`](https://doc.rust-lang.org/std/primitive.i32.html#associatedconstant.MIN) and divisor is `-1`. This can be seen in the MIR already:

```
fn safe_divide(_1: i32, _2: i32) -> Option<i32> {
    debug dividend => _1;
    debug divisor => _2;
    let mut _0: std::option::Option<i32>;
    let mut _3: bool;
    let mut _4: i32;
    let mut _5: bool;
    let mut _6: bool;
    let mut _7: bool;

    bb0: {
        _3 = Eq(copy _2, const 0_i32);
        switchInt(move _2) -> [0: bb1, otherwise: bb2];
    }

    bb1: {
        _0 = const Option::<i32>::None;
        goto -> bb5;
    }

    bb2: {
        StorageLive(_4);
        assert(!copy _3, "attempt to divide `{}` by zero", copy _1) -> [success: bb3, unwind continue];
    }

    bb3: {
        _5 = Eq(copy _2, const -1_i32);
        _6 = Eq(copy _1, const i32::MIN);
        _7 = BitAnd(move _5, move _6);
        assert(!move _7, "attempt to compute `{} / {}`, which would overflow", copy _1, copy _2) -> [success: bb4, unwind continue];
    }

    bb4: {
        _4 = Div(copy _1, copy _2);
        _0 = Option::<i32>::Some(move _4);
        StorageDead(_4);
        goto -> bb5;
    }

    bb5: {
        return;
    }
}
```

The result is returned using 2 registers: `w0` stores the discriminant (`None`: `0`, `Some`: `1`) and `w1` stores the data.

Listing:

```
                             **************************************************************
                             *                          FUNCTION                          *
                             **************************************************************
                             undefined safe_divide()
             undefined         <UNASSIGNED>   <RETURN>
             undefined8        Stack[-0x10]:8 local_10                                XREF[1]:     0010002c(W)  
                             check if divisor is 0
                             safe_divide                                     XREF[4]:     Entry Point(*), 001000e4(*), 
                                                                                          _elfSectionHeaders::00000090(*), 
                                                                                          _elfSectionHeaders::000000d0(*)  
        00100000 21 01 00 34     cbz        w1,LAB_00100024
                             i32::MIN
        00100004 08 00 b0 52     mov        w8,#0x80000000
                             check if dividend is i32::MIN
        00100008 1f 00 08 6b     cmp        w0,w8
        0010000c 61 00 00 54     b.ne       LAB_00100018
                             check if divisor is -1
        00100010 3f 04 00 31     cmn        w1,#0x1
        00100014 c0 00 00 54     b.eq       LAB_0010002c
                             LAB_00100018                                    XREF[1]:     0010000c(j)  
        00100018 01 0c c1 1a     sdiv       w1,w0,w1
                             Some
        0010001c 20 00 80 52     mov        w0,#0x1
        00100020 c0 03 5f d6     ret
                             None
                             LAB_00100024                                    XREF[1]:     00100000(j)  
        00100024 e0 03 1f 2a     mov        w0,wzr
        00100028 c0 03 5f d6     ret
                             LAB_0010002c                                    XREF[1]:     00100014(j)  
        0010002c fd 7b bf a9     stp        x29,x30,[sp, #local_10]!
        00100030 fd 03 00 91     mov        x29,sp
        00100034 00 00 00 90     adrp       x0,0x100000
        00100038 00 c0 02 91     add        x0=>PTR_DAT_001000b0,x0,#0xb0                    = 001000a0
        0010003c f1 03 00 94     bl         <EXTERNAL>::core::panicking::panic_const::pani   undefined panic_const_div_overfl
```

### `process_option`

```rust
#[unsafe(no_mangle)]
pub fn process_option(value: Option<i32>) -> i32 {
    match value {
        Some(x) => x * 2,
        None => 0,
    }
}
```

We can see the same pattern (`w0`: discriminant, `w1`: data) when processing an `Option` passed to our function.

Listing:

```
                             **************************************************************
                             *                          FUNCTION                          *
                             **************************************************************
                             undefined process_option()
             undefined         <UNASSIGNED>   <RETURN>
                             multiply by 2
                             process_option                                  XREF[3]:     Entry Point(*), 00100100(*), 
                                                                                          _elfSectionHeaders::00000150(*)  
        00100040 28 78 1f 53     lsl        w8,w1,#0x1
                             check discriminant: Z flag = 1 if None, Z flag = 0 if Some
        00100044 1f 00 00 72     tst        w0,#0x1
                             if Z=0 (Some): return w8, if Z=1 (None): return wzr
        00100048 00 11 9f 1a     csel       w0,w8,wzr,ne
        0010004c c0 03 5f d6     ret
```

### Null pointer optimization

There are some cases where the discriminant is omitted due to optimizations. The general rule is that null pointer optimization can be used for types that can never be null. Examples include:
- `Option<&str>`
- `Option<Box<i32>>`

By the safety guarantees of safe Rust, a `&str` always points to a valid location and a `Box<T>` always points to a valid heap allocation. This enables the compiler to use further optimizations, for example dropping the discriminant field and using a null value to represent the `None` variant.

While tracing the different compilation steps, we can see that the discriminant is present in the MIR but not in the LLVM IR. This means the null pointer optimization happens during lowering MIR to LLVM IR.

### `process_str_option`

```rust
#[unsafe(no_mangle)]
pub fn process_str_option(value: Option<&str>) -> usize {
    match value {
        Some(s) => s.len(),
        None => 0,
    }
}
```

Looking at the MIR, we can see that it extracts and checks the discriminant:

```
...
        _2 = discriminant(_1);
        switchInt(move _2) -> [0: bb2, 1: bb3, otherwise: bb1];
...
```

In the LLVM IR this has been simplified and replaced with a null check. If the pointer is null, 0 is returned, if it is a valid value, the length of the referenced string is returned. (An `&str` consists of 2 values: a pointer and a length.)

```
; Function Attrs: mustprogress nofree norecurse nosync nounwind willreturn memory(none) uwtable
define noundef i64 @process_str_option(ptr noalias noundef readonly align 1 %0, i64 %1) unnamed_addr #1 {
start:
  %.not = icmp eq ptr %0, null
  %. = select i1 %.not, i64 0, i64 %1
  ret i64 %.
}
```

Listing:

```
                             **************************************************************
                             *                          FUNCTION                          *
                             **************************************************************
                             undefined process_str_option()
             undefined         <UNASSIGNED>   <RETURN>
                             process_str_option                              XREF[3]:     Entry Point(*), 00100114(*), 
                                                                                          _elfSectionHeaders::00000190(*)  
        00100050 1f 00 00 f1     cmp        x0,#0x0
        00100054 e0 03 81 9a     csel       x0,xzr,x1,eq
        00100058 c0 03 5f d6     ret

```

Full MIR for reference:

```
fn process_str_option(_1: Option<&str>) -> usize {
    debug value => _1;
    let mut _0: usize;
    let mut _2: isize;
    let _3: &str;
    scope 1 {
        debug s => _3;
        scope 2 (inlined core::str::<impl str>::len) {
            let _4: &[u8];
            scope 3 (inlined core::str::<impl str>::as_bytes) {
            }
        }
    }

    bb0: {
        _2 = discriminant(_1);
        switchInt(move _2) -> [0: bb2, 1: bb3, otherwise: bb1];
    }

    bb1: {
        unreachable;
    }

    bb2: {
        _0 = const 0_usize;
        goto -> bb4;
    }

    bb3: {
        _3 = copy ((_1 as Some).0: &str);
        StorageLive(_4);
        _4 = copy _3 as &[u8] (Transmute);
        _0 = PtrMetadata(copy _4);
        StorageDead(_4);
        goto -> bb4;
    }

    bb4: {
        return;
    }
}
```

### `process_box_option`

```rust
#[unsafe(no_mangle)]
pub fn process_box_option(value: Option<Box<i32>>) -> i32 {
    match value {
        Some(boxed) => *boxed,
        None => -1,
    }
}

```

A `Box<i32>` consists of a single pointer pointing to a heap allocated block and can never be null in safe code. Therefore, the code can be optimized with a null check. If it is null, `-1` is returned. Otherwise, the pointer is dereferenced, the heap block is deallocated and the value is returned.

Listing:


```
                             **************************************************************
                             *                          FUNCTION                          *
                             **************************************************************
                             undefined process_box_option()
             undefined         <UNASSIGNED>   <RETURN>
             undefined8        Stack[-0x10]:8 local_10                                XREF[3]:     00100060(W), 
                                                                                                   00100080(R), 
                                                                                                   00100094(R)  
             undefined8        Stack[-0x20]:8 local_20                                XREF[3]:     0010005c(W), 
                                                                                                   00100084(*), 
                                                                                                   00100098(*)  
                             process_box_option                              XREF[3]:     Entry Point(*), 00100128(*), 
                                                                                          _elfSectionHeaders::000001d0(*)  
        0010005c fd 7b be a9     stp        x29,x30,[sp, #local_20]!
        00100060 f3 0b 00 f9     str        x19,[sp, #local_10]
        00100064 fd 03 00 91     mov        x29,sp
                             null check
        00100068 20 01 00 b4     cbz        x0,LAB_0010008c
                             dereference
        0010006c 13 00 40 b9     ldr        w19,[x0]
        00100070 81 00 80 52     mov        w1,#0x4
        00100074 82 00 80 52     mov        w2,#0x4
        00100078 e4 03 00 94     bl         <EXTERNAL>::__rustc[a3537046f032bc96]::__rust_   undefined __rust_dealloc()
        0010007c e0 03 13 2a     mov        w0,w19
        00100080 f3 0b 40 f9     ldr        x19,[sp, #local_10]
        00100084 fd 7b c2 a8     ldp        x29=>local_20,x30,[sp], #0x20
        00100088 c0 03 5f d6     ret
                             LAB_0010008c                                    XREF[1]:     00100068(j)  
        0010008c 13 00 80 12     mov        w19,#0xffffffff
        00100090 e0 03 13 2a     mov        w0,w19
        00100094 f3 0b 40 f9     ldr        x19,[sp, #local_10]
        00100098 fd 7b c2 a8     ldp        x29=>local_20,x30,[sp], #0x20
        0010009c c0 03 5f d6     ret
```
