# `Result`

## Source

Initialize a new workspace with `cargo init --lib`.

```rust
pub enum MathError {
    DivisionByZero,
    Overflow,
}

#[unsafe(no_mangle)]
pub fn divide_with_str_error(dividend: i32, divisor: i32) -> Result<i32, &'static str> {
    if divisor == 0 {
        Err("Division by zero")
    } else {
        Ok(dividend / divisor)
    }
}

#[unsafe(no_mangle)]
pub fn divide_with_enum_error(a: i32, b: i32) -> Result<i32, MathError> {
    if b == 0 {
        return Err(MathError::DivisionByZero);
    }

    if a == i32::MIN && b == -1 {
        return Err(MathError::Overflow);
    }

    Ok(a / b)
}

#[unsafe(no_mangle)]
pub fn process_result_str_error(value: Result<i32, &str>) -> i32 {
    match value {
        Ok(x) => x * 2,
        Err(_) => -1,
    }
}

#[unsafe(no_mangle)]
pub fn process_result_box_enum(value: Result<Box<i32>, MathError>) -> i32 {
    match value {
        Err(MathError::DivisionByZero) => -1,
        Err(MathError::Overflow) => -2,
        Ok(value) => *value,
    }
}
```

The `Result` type is described in the [official docs](https://doc.rust-lang.org/std/result/) in detail. We are using `no_mangle` to simplify things, the reason can be found [here](https://shadowshell.io/rust-arm64/option.html#no_mangle).

## Build

```
$ cargo rustc --release -- --emit obj
```

## Ghidra

Load the `.o` file (located at `target/aarch64-unknown-linux-musl/release/deps/`) into Ghidra and auto-analyze it.

### Layout

[`Result`](https://doc.rust-lang.org/std/result/enum.Result.html) is an `enum` type which is conceptually a [tagged union](https://rust-lang.github.io/rfcs/2195-really-tagged-unions.html) with a discriminant and data (refer to chapter [`enum`](./enum.md) for more information about `enum`s). The layout is unspecified, which similarly to [`Option`](./option.md#layout) enables certain niche optimizations.

### `divide_with_str_error`

```rust
#[unsafe(no_mangle)]
pub fn divide_with_str_error(dividend: i32, divisor: i32) -> Result<i32, &'static str> {
    if divisor == 0 {
        Err("Division by zero")
    } else {
        Ok(dividend / divisor)
    }
}
```

If we look at the layout, we see that there is no discriminant field. Since the compiler knows that references [always point to valid locations](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html#dangling-references), it can use the null value as a discriminant. `&str` is a fat reference (16 bytes: pointer + length), therefore variant `Err` is 16 bytes.

```
$ cargo rustc --release --quiet -- -Z print-type-sizes
...
print-type-size type: `std::result::Result<i32, &str>`: 16 bytes, alignment: 8 bytes
print-type-size     variant `Err`: 16 bytes
print-type-size         field `.0`: 16 bytes
print-type-size     variant `Ok`: 12 bytes
print-type-size         padding: 8 bytes
print-type-size         field `.0`: 4 bytes, alignment: 4 bytes
...
```

Before looking at the assembly, we must mention that the compiler automatically generates a check that causes a panic if the result would overflow. For `i32`, there is only one such scenario: dividend is [`i32::MIN`](https://doc.rust-lang.org/std/primitive.i32.html#associatedconstant.MIN) and divisor is `-1`.

Listing:

```
                             **************************************************************
                             *                          FUNCTION                          *
                             **************************************************************
                             undefined divide_with_str_error()
             undefined         <UNASSIGNED>   <RETURN>
             undefined8        Stack[-0x10]:8 local_10                                XREF[1]:     0010003c(W)  
                             check if divisor is 0
                             divide_with_str_error                           XREF[4]:     Entry Point(*), 0010015c(*), 
                                                                                          _elfSectionHeaders::00000090(*), 
                                                                                          _elfSectionHeaders::000000d0(*)  
        00100000 41 01 00 34     cbz        w1,LAB_00100028
                             i32::MIN
        00100004 09 00 b0 52     mov        w9,#0x80000000
                             check if dividend is i32::MIN
        00100008 1f 00 09 6b     cmp        w0,w9
        0010000c 61 00 00 54     b.ne       LAB_00100018
                             check if divisor is -1
        00100010 3f 04 00 31     cmn        w1,#0x1
        00100014 40 01 00 54     b.eq       LAB_0010003c
                             LAB_00100018                                    XREF[1]:     0010000c(j)  
        00100018 09 0c c1 1a     sdiv       w9,w0,w1
                             Ok
        0010001c 1f 01 00 f9     str        xzr,[x8]
        00100020 09 09 00 b9     str        w9,[x8, #0x8]
        00100024 c0 03 5f d6     ret
                             LAB_00100028                                    XREF[1]:     00100000(j)  
        00100028 09 00 00 90     adrp       x9,0x100000
        0010002c 29 21 04 91     add        x9,x9,#0x108
                             length of "Division by zero"
        00100030 0a 02 80 52     mov        w10,#0x10
                             Err
        00100034 09 29 00 a9     stp        x9=>s_Division_by_zero_00100108,x10,[x8]         = "Division by zero"
        00100038 c0 03 5f d6     ret
                             LAB_0010003c                                    XREF[1]:     00100014(j)  
        0010003c fd 7b bf a9     stp        x29,x30,[sp, #local_10]!
        00100040 fd 03 00 91     mov        x29,sp
        00100044 00 00 00 90     adrp       x0,0x100000
        00100048 00 a0 04 91     add        x0=>PTR_DAT_00100128,x0,#0x128                   = 00100118
        0010004c ed 03 00 94     bl         <EXTERNAL>::core::panicking::panic_const::pani   undefined panic_const_div_overfl
```

### `divide_with_enum_error`

```rust
pub enum MathError {
    DivisionByZero,
    Overflow,
}

#[unsafe(no_mangle)]
pub fn divide_with_enum_error(a: i32, b: i32) -> Result<i32, MathError> {
    if b == 0 {
        return Err(MathError::DivisionByZero);
    }

    if a == i32::MIN && b == -1 {
        return Err(MathError::Overflow);
    }

    Ok(a / b)
}
```
Here we have a discriminant which is either followed by the value (`Ok`) or the error type (`Err`).

```
$ cargo rustc --release --quiet -- -Z print-type-sizes
...
print-type-size type: `std::result::Result<i32, MathError>`: 8 bytes, alignment: 4 bytes
print-type-size     discriminant: 1 bytes
print-type-size     variant `Ok`: 7 bytes
print-type-size         padding: 3 bytes
print-type-size         field `.0`: 4 bytes, alignment: 4 bytes
print-type-size     variant `Err`: 1 bytes
print-type-size         field `.0`: 1 bytes
...
```
Listing:

```
                             **************************************************************
                             *                          FUNCTION                          *
                             **************************************************************
                             undefined divide_with_enum_error()
             undefined         <UNASSIGNED>   <RETURN>
                             check if divisor is 0
                             divide_with_enum_error                          XREF[3]:     Entry Point(*), 0010017c(*), 
                                                                                          _elfSectionHeaders::00000150(*)  
        00100050 41 01 00 34     cbz        w1,LAB_00100078
                             i32::MIN
        00100054 08 00 b0 52     mov        w8,#0x80000000
                             check if dividend is i32::MIN
        00100058 1f 00 08 6b     cmp        w0,w8
        0010005c 41 01 00 54     b.ne       LAB_00100084
                             check if divisor is -1
        00100060 3f 04 00 31     cmn        w1,#0x1
        00100064 01 01 00 54     b.ne       LAB_00100084
                             Overflow
        00100068 08 20 80 52     mov        w8,#0x100
                             Err
        0010006c 29 00 80 52     mov        w9,#0x1
                             Err(Overflow) encoded
        00100070 00 01 09 aa     orr        x0,x8,x9
        00100074 c0 03 5f d6     ret
                             Err
                             LAB_00100078                                    XREF[1]:     00100050(j)  
        00100078 29 00 80 52     mov        w9,#0x1
                             Err(DivisionByZero) encoded
        0010007c e0 03 09 aa     mov        x0,x9
        00100080 c0 03 5f d6     ret
                             LAB_00100084                                    XREF[2]:     0010005c(j), 00100064(j)  
        00100084 08 0c c1 1a     sdiv       w8,w0,w1
                             Ok (value is upper 4 bytes)
        00100088 08 7d 60 d3     lsl        x8,x8,#0x20
        0010008c 00 01 1f aa     orr        x0,x8,xzr
        00100090 c0 03 5f d6     ret
```

### `process_result_str_error`

```rust
#[unsafe(no_mangle)]
pub fn process_result_str_error(value: Result<i32, &str>) -> i32 {
    match value {
        Ok(x) => x * 2,
        Err(_) => -1,
    }
}
```
The layout of the `Result` is the same as in [`divide_with_str_error`](#divide_with_str_error). If the first 8 bytes are 0 it means `Ok` and the value is multiplied by 2 and returned, otherwise `-1` is returned (`wzr` inverted: 0xffff).

Listing:

```
                             **************************************************************
                             *                          FUNCTION                          *
                             **************************************************************
                             undefined process_result_str_error()
             undefined         <UNASSIGNED>   <RETURN>
                             process_result_str_error                        XREF[3]:     Entry Point(*), 00100190(*), 
                                                                                          _elfSectionHeaders::00000190(*)  
        00100094 08 08 40 b9     ldr        w8,[x0, #0x8]
        00100098 09 00 40 f9     ldr        x9,[x0]
        0010009c 08 79 1f 53     lsl        w8,w8,#0x1
        001000a0 3f 01 00 f1     cmp        x9,#0x0
        001000a4 00 01 9f 5a     csinv      w0,w8,wzr,eq
        001000a8 c0 03 5f d6     ret

```

### `process_result_box_enum`

```rust
pub enum MathError {
    DivisionByZero,
    Overflow,
}

#[unsafe(no_mangle)]
pub fn process_result_box_enum(value: Result<Box<i32>, MathError>) -> i32 {
    match value {
        Err(MathError::DivisionByZero) => -1,
        Err(MathError::Overflow) => -2,
        Ok(value) => *value,
    }
}
```
`Box<T>` is a thin pointer pointing to a heap location, the memory is automatically deallocated by [`__rust_dealloc`](https://stdrs.dev/nightly/x86_64-unknown-linux-gnu/alloc/alloc/fn.__rust_dealloc.html) The layout is similar to what we saw in the case of [`divide_with_enum_error`](#divide_with_enum_error). The difference is that the size of the `Ok` data is 8 bytes instead of 4.

```
$ cargo rustc --release --quiet -- -Z print-type-sizes
...
print-type-size type: `std::result::Result<std::boxed::Box<i32>, MathError>`: 16 bytes, alignment: 8 bytes
print-type-size     discriminant: 1 bytes
print-type-size     variant `Ok`: 15 bytes
print-type-size         padding: 7 bytes
print-type-size         field `.0`: 8 bytes, alignment: 8 bytes
print-type-size     variant `Err`: 1 bytes
print-type-size         field `.0`: 1 bytes
...
```
Listing:

```
                             **************************************************************
                             *                          FUNCTION                          *
                             **************************************************************
                             undefined process_result_box_enum()
             undefined         <UNASSIGNED>   <RETURN>
             undefined8        Stack[-0x10]:8 local_10                                XREF[3]:     001000b0(W), 
                                                                                                   001000d8(R), 
                                                                                                   001000fc(R)  
             undefined8        Stack[-0x20]:8 local_20                                XREF[3]:     001000ac(W), 
                                                                                                   001000dc(*), 
                                                                                                   00100100(*)  
                             process_result_box_enum                         XREF[3]:     Entry Point(*), 001001a4(*), 
                                                                                          _elfSectionHeaders::000001d0(*)  
        001000ac fd 7b be a9     stp        x29,x30,[sp, #local_20]!
        001000b0 f3 0b 00 f9     str        x19,[sp, #local_10]
        001000b4 fd 03 00 91     mov        x29,sp
                             load discriminant
        001000b8 08 00 40 39     ldrb       w8,[x0]
                             Err
        001000bc 1f 05 00 71     cmp        w8,#0x1
        001000c0 21 01 00 54     b.ne       LAB_001000e4
        001000c4 08 04 40 39     ldrb       w8,[x0, #0x1]
                             DivisionByZero
        001000c8 1f 01 00 71     cmp        w8,#0x0
        001000cc 28 00 80 12     mov        w8,#0xfffffffe
                             if DivisionByZero: ret val is 0xfffffffe + 1 = -1,
                             otherwise (Overflow): 0xfffffffe = -2
        001000d0 13 15 88 1a     cinc       w19,w8,eq
        001000d4 e0 03 13 2a     mov        w0,w19
        001000d8 f3 0b 40 f9     ldr        x19,[sp, #local_10]
        001000dc fd 7b c2 a8     ldp        x29=>local_20,x30,[sp], #0x20
        001000e0 c0 03 5f d6     ret
                             arg0: ptr
                             LAB_001000e4                                    XREF[1]:     001000c0(j)  
        001000e4 00 04 40 f9     ldr        x0,[x0, #0x8]
                             arg1: size
        001000e8 81 00 80 52     mov        w1,#0x4
                             arg2: align
        001000ec 82 00 80 52     mov        w2,#0x4
                             save value
        001000f0 13 00 40 b9     ldr        w19,[x0]
        001000f4 c5 03 00 94     bl         <EXTERNAL>::__rustc[eb192786f4da5ea1]::__rust_   undefined __rust_dealloc()
        001000f8 e0 03 13 2a     mov        w0,w19
        001000fc f3 0b 40 f9     ldr        x19,[sp, #local_10]
        00100100 fd 7b c2 a8     ldp        x29=>local_20,x30,[sp], #0x20
        00100104 c0 03 5f d6     ret
```
