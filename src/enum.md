# `enum`

## Source

Initialize a new workspace with `cargo init --lib`.

```rust
pub enum Color {
    Red,
    Green,
    Blue,
}

#[unsafe(no_mangle)]
pub fn u32_to_color(value: u32) -> Color {
    match value {
        0 => Color::Red,
        1 => Color::Green,
        2 => Color::Blue,
        _ => Color::Red,
    }
}

#[unsafe(no_mangle)]
pub fn simple_enum_match(color: Color) -> u8 {
    match color {
        Color::Red => 0,
        Color::Green => 1,
        Color::Blue => 2,
    }
}
```

```rust
pub enum BasicShape {
    Circle(i32),
    Point,
}

#[unsafe(no_mangle)]
pub fn basic_shape_match(shape: BasicShape) -> i32 {
    match shape {
        BasicShape::Circle(radius) => radius * radius,
        BasicShape::Point => 0,
    }
}

#[unsafe(no_mangle)]
pub fn make_basic_circle(radius: i32) -> BasicShape {
    BasicShape::Circle(radius)
}

#[unsafe(no_mangle)]
pub fn make_basic_point() -> BasicShape {
    BasicShape::Point
}
```

```rust
pub enum Shape {
    Circle(i32),
    Rectangle(i32, i32),
    Point,
}

#[unsafe(no_mangle)]
pub fn enum_with_data_match(shape: Shape) -> i32 {
    match shape {
        Shape::Circle(radius) => radius * radius,
        Shape::Rectangle(width, height) => width * height,
        Shape::Point => 0,
    }
}

#[unsafe(no_mangle)]
pub fn make_circle(radius: i32) -> Shape {
    Shape::Circle(radius)
}

#[unsafe(no_mangle)]
pub fn make_rectangle(w: i32, h: i32) -> Shape {
    Shape::Rectangle(w, h)
}

#[unsafe(no_mangle)]
pub fn make_point() -> Shape {
    Shape::Point
}
```

The `enum` type is described in the [official docs](https://doc.rust-lang.org/std/keyword.enum.html) in detail. We are using `no_mangle` to simplify things, the reason can be found [here](https://shadowshell.io/rust-arm64/option.html#no_mangle). The source code is split into 3 parts:
- unit-only `enum`
- data-carrying `enum` (largest variant: tuple with 1 field)
- data-carrying `enum` (largest variant: tuple with 2 fields)

Note: for this analysis the unit-only and data-carrying types have been chosen as they are the most common ones.

## Build

```
$ cargo rustc --release -- --emit obj
```

## Ghidra

Load the `.o` file (located at `target/aarch64-unknown-linux-musl/release/deps/`) into Ghidra and auto-analyze it.

### Layout

[This description](https://github.com/rust-lang/unsafe-code-guidelines/blob/c138499c1de03b908dfe719a41193c84f8146883/reference/src/layout/enums.md#layout-of-rust-enum-types) provides a good overview of the `enum` types and their layouts (even the ones we will not discuss such as empty `enum` and `enum` with a single variant). `enum`s are also called [tagged unions](https://rust-lang.github.io/rfcs/2195-really-tagged-unions.html) but their layout is [unspecified](https://github.com/rust-lang/unsafe-code-guidelines/blob/c138499c1de03b908dfe719a41193c84f8146883/reference/src/layout/enums.md#layout-of-a-data-carrying-enums-without-a-repr-annotation), unless you use `#[repr(...)]`.

Still, we will see that in our examples an `enum` is either represented by a discriminant only or a discriminant plus the data/payload.

## Unit-only `enum`

```rust
pub enum Color {
    Red,
    Green,
    Blue,
}

#[unsafe(no_mangle)]
pub fn u32_to_color(value: u32) -> Color {
    match value {
        0 => Color::Red,
        1 => Color::Green,
        2 => Color::Blue,
        _ => Color::Red,
    }
}

#[unsafe(no_mangle)]
pub fn simple_enum_match(color: Color) -> u8 {
    match color {
        Color::Red => 0,
        Color::Green => 1,
        Color::Blue => 2,
    }
}
```

Since the layout is unstable, there is no fixed size for the `enum`, although the compiler will typically choose the smallest representation possible. In this case it is `u8` or `i8`.

```
$ cargo rustc --release --quiet -- -Z print-type-sizes       
print-type-size type: `Color`: 1 bytes, alignment: 1 bytes
print-type-size     discriminant: 1 bytes
print-type-size     variant `Red`: 0 bytes
print-type-size     variant `Green`: 0 bytes
print-type-size     variant `Blue`: 0 bytes
```

If we check `simple_enum_match()`, we can see that it just forwards the input value (0/1/2) to the output (from `w0` to `w0`, so effectively it does nothing), meaning that the `enum` uses the same values for its discriminants. `u32_to_color()` behaves the same, with the difference that it also handles the default case which makes the code a bit more complicated.

Listings:

```
                             **************************************************************
                             *                          FUNCTION                          *
                             **************************************************************
                             undefined simple_enum_match()
             undefined         <UNASSIGNED>   <RETURN>
                             simple_enum_match                               XREF[3]:     Entry Point(*), 001000c0(*), 
                                                                                          _elfSectionHeaders::00000110(*)  
        00100014 c0 03 5f d6     ret

```

```
                             **************************************************************
                             *                          FUNCTION                          *
                             **************************************************************
                             undefined u32_to_color()
             undefined         <UNASSIGNED>   <RETURN>
                             u32_to_color                                    XREF[4]:     Entry Point(*), 001000ac(*), 
                                                                                          _elfSectionHeaders::00000090(*), 
                                                                                          _elfSectionHeaders::000000d0(*)  
        00100000 1f 04 00 71     cmp        w0,#0x1
                             set w8=1 if input==1, else w8=0
        00100004 e8 17 9f 1a     cset       w8,eq
        00100008 1f 08 00 71     cmp        w0,#0x2
                             if input==2, keep input, else use w8
        0010000c 00 00 88 1a     csel       w0,w0,w8,eq
        00100010 c0 03 5f d6     ret

```

## Data-carrying `enum` (largest variant: tuple with 1 field)

```rust
pub enum BasicShape {
    Circle(i32),
    Point,
}

#[unsafe(no_mangle)]
pub fn basic_shape_match(shape: BasicShape) -> i32 {
    match shape {
        BasicShape::Circle(radius) => radius * radius,
        BasicShape::Point => 0,
    }
}

#[unsafe(no_mangle)]
pub fn make_basic_circle(radius: i32) -> BasicShape {
    BasicShape::Circle(radius)
}

#[unsafe(no_mangle)]
pub fn make_basic_point() -> BasicShape {
    BasicShape::Point
}
```

```
$ cargo rustc --release --quiet -- -Z print-type-sizes
print-type-size type: `BasicShape`: 8 bytes, alignment: 4 bytes
print-type-size     discriminant: 4 bytes
print-type-size     variant `Circle`: 4 bytes
print-type-size         field `.0`: 4 bytes
print-type-size     variant `Point`: 0 bytes
```

In case the largest data-carrying variant is a tuple with 1 field, the compiler chooses to pass the discriminant and data via 2 registers (`w0`: discriminant and `w1`: data). A discriminant of 0 means `Circle` while 1 means `Point`.

Listings:

```
                             **************************************************************
                             *                          FUNCTION                          *
                             **************************************************************
                             undefined basic_shape_match()
             undefined         <UNASSIGNED>   <RETURN>
                             basic_shape_match                               XREF[3]:     Entry Point(*), 00100124(*), 
                                                                                          _elfSectionHeaders::00000250(*)  
        0010006c 28 7c 01 1b     mul        w8,w1,w1
                             check discriminant
        00100070 1f 00 00 72     tst        w0,#0x1
                             if discriminant != 0, return 0, else return w8
        00100074 e0 13 88 1a     csel       w0,wzr,w8,ne
        00100078 c0 03 5f d6     ret
```

```
                             **************************************************************
                             *                          FUNCTION                          *
                             **************************************************************
                             undefined make_basic_circle()
             undefined         <UNASSIGNED>   <RETURN>
                             make_basic_circle                               XREF[3]:     Entry Point(*), 00100138(*), 
                                                                                          _elfSectionHeaders::00000290(*)  
        0010007c e1 03 00 2a     mov        w1,w0
        00100080 e0 03 1f 2a     mov        w0,wzr
        00100084 c0 03 5f d6     ret
```

```
                             **************************************************************
                             *                          FUNCTION                          *
                             **************************************************************
                             undefined make_basic_point()
             undefined         <UNASSIGNED>   <RETURN>
                             make_basic_point                                XREF[3]:     Entry Point(*), 0010014c(*), 
                                                                                          _elfSectionHeaders::000002d0(*)  
        00100088 20 00 80 52     mov        w0,#0x1
        0010008c c0 03 5f d6     ret
```

## Data-carrying `enum` (largest variant: tuple with 2 fields)

```rust
pub enum Shape {
    Circle(i32),
    Rectangle(i32, i32),
    Point,
}

#[unsafe(no_mangle)]
pub fn enum_with_data_match(shape: Shape) -> i32 {
    match shape {
        Shape::Circle(radius) => radius * radius,
        Shape::Rectangle(width, height) => width * height,
        Shape::Point => 0,
    }
}

#[unsafe(no_mangle)]
pub fn make_circle(radius: i32) -> Shape {
    Shape::Circle(radius)
}

#[unsafe(no_mangle)]
pub fn make_rectangle(w: i32, h: i32) -> Shape {
    Shape::Rectangle(w, h)
}

#[unsafe(no_mangle)]
pub fn make_point() -> Shape {
    Shape::Point
}
```

```
$ cargo rustc --release --quiet -- -Z print-type-sizes
print-type-size type: `Shape`: 12 bytes, alignment: 4 bytes
print-type-size     discriminant: 4 bytes
print-type-size     variant `Rectangle`: 8 bytes
print-type-size         field `.0`: 4 bytes
print-type-size         field `.1`: 4 bytes
print-type-size     variant `Circle`: 4 bytes
print-type-size         field `.0`: 4 bytes
print-type-size     variant `Point`: 0 bytes
```

In case the largest data-carrying variant is a tuple with 2 fields, the compiler chooses to pass the discriminant and data via 1 register (`w0`), which holds a pointer to the `enum`'s memory location where the struct begins with the discriminant (here: offset 0), then contains the remaining fields associated with that variant (here: offset 4). A discriminant of 0 means `Circle`, 1 means `Rectangle` and 2 means `Point`.

Note: `x8` is the indirect result register according to the [AAPCS64](https://github.com/ARM-software/abi-aa/blob/c51addc3dc03e73a016a1e4edf25440bcac76431/aapcs64/aapcs64.rst). It is also explained [here](https://developer.arm.com/documentation/102374/0102/Procedure-Call-Standard):
> `XR` (`X8`) is a pointer to the memory allocated by the caller for returning the struct.

Listings:

```
                             **************************************************************
                             *                          FUNCTION                          *
                             **************************************************************
                             undefined enum_with_data_match()
             undefined         <UNASSIGNED>   <RETURN>
                             enum_with_data_match                            XREF[3]:     Entry Point(*), 001000d4(*), 
                                                                                          _elfSectionHeaders::00000150(*)  
        00100018 08 00 40 b9     ldr        w8,[x0]
        0010001c c8 00 00 34     cbz        w8,LAB_00100034
        00100020 1f 05 00 71     cmp        w8,#0x1
        00100024 e1 00 00 54     b.ne       LAB_00100040
                             rectangle
        00100028 08 a4 40 29     ldp        w8,w9,[x0, #0x4]
        0010002c 20 7d 08 1b     mul        w0,w9,w8
        00100030 c0 03 5f d6     ret
                             circle
                             LAB_00100034                                    XREF[1]:     0010001c(j)  
        00100034 08 04 40 b9     ldr        w8,[x0, #0x4]
        00100038 00 7d 08 1b     mul        w0,w8,w8
        0010003c c0 03 5f d6     ret
                             point
                             LAB_00100040                                    XREF[1]:     00100024(j)  
        00100040 e0 03 1f 2a     mov        w0,wzr
        00100044 c0 03 5f d6     ret
```

```
                             **************************************************************
                             *                          FUNCTION                          *
                             **************************************************************
                             undefined make_circle()
             undefined         <UNASSIGNED>   <RETURN>
                             make_circle                                     XREF[3]:     Entry Point(*), 001000e8(*), 
                                                                                          _elfSectionHeaders::00000190(*)  
        00100048 1f 01 00 29     stp        wzr,w0,[x8]
        0010004c c0 03 5f d6     ret
```

```
                             **************************************************************
                             *                          FUNCTION                          *
                             **************************************************************
                             undefined make_rectangle()
             undefined         <UNASSIGNED>   <RETURN>
                             make_rectangle                                  XREF[3]:     Entry Point(*), 001000fc(*), 
                                                                                          _elfSectionHeaders::000001d0(*)  
        00100050 29 00 80 52     mov        w9,#0x1
        00100054 00 85 00 29     stp        w0,w1,[x8, #0x4]
        00100058 09 01 00 b9     str        w9,[x8]
        0010005c c0 03 5f d6     ret
```

```
                             **************************************************************
                             *                          FUNCTION                          *
                             **************************************************************
                             undefined make_point()
             undefined         <UNASSIGNED>   <RETURN>
                             make_point                                      XREF[3]:     Entry Point(*), 00100110(*), 
                                                                                          _elfSectionHeaders::00000210(*)  
        00100060 49 00 80 52     mov        w9,#0x2
        00100064 09 01 00 b9     str        w9,[x8]
        00100068 c0 03 5f d6     ret
```
