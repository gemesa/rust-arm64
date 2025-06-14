# `Vec`

## Source

Initialize a new workspace with `cargo init`.

```rust
fn main() -> std::process::ExitCode {
    let mut vec = vec![1, 2, 3];
    vec.push(4);
    let ret = vec.pop().unwrap();
    std::process::ExitCode::from(ret)
}
```

[`vec!`](https://github.com/rust-lang/rust/blob/ec28ae9454139023117270985f114823d6570657/library/alloc/src/macros.rs#L42) is a macro which generates different code based on the passed argument. In our test code we pass a list of elements so the following pattern matches:

```rust
    ($($x:expr),+ $(,)?) => (
        <[_]>::into_vec($crate::boxed::box_new([$($x),+]))
    );
```

More information can be found about declarative macros in chapter [Declarative macros](./macro-declarative.md).

```
$ cargo rustc --release --quiet -- -Z unpretty=hir
#[prelude_import]
use std::prelude::rust_2024::*;
#[macro_use]
extern crate std;
fn main()
    ->
        std::process::ExitCode {
    let mut vec = <[_]>::into_vec(::alloc::boxed::box_new([1, 2, 3]));
    vec.push(4);
    let ret = vec.pop().unwrap();
    std::process::ExitCode::from(ret)
}
```

## Build

```
$ cargo rustc --release
```

## Ghidra

Load the binary into Ghidra and auto-analyze it.

### `rust_lab::main`

The [official docs](https://doc.rust-lang.org/stable/alloc/vec/struct.Vec.html) explains `Vec` in detail. The most important parts for us:
> The capacity of a vector is the amount of space allocated for any future elements that will be added onto the vector. This is not to be confused with the length of a vector, which specifies the number of actual elements within the vector. If a vector’s length exceeds its capacity, its capacity will automatically be increased, but its elements will have to be reallocated.

> Vec is and always will be a (pointer, capacity, length) triplet.

> The order of these fields is completely unspecified

> If a `Vec` *has* allocated memory, then the memory it points to is on the heap

We can verify this:

```
$ cargo rustc --release --quiet -- -Zprint-type-sizes
...
print-type-size type: `std::vec::Vec<u8>`: 24 bytes, alignment: 8 bytes
print-type-size     field `.buf`: 16 bytes
print-type-size     field `.len`: 8 bytes
print-type-size type: `alloc::raw_vec::RawVec<u8>`: 16 bytes, alignment: 8 bytes
print-type-size     field `.inner`: 16 bytes
print-type-size     field `._marker`: 0 bytes
print-type-size type: `alloc::raw_vec::RawVecInner`: 16 bytes, alignment: 8 bytes
print-type-size     field `.cap`: 8 bytes
print-type-size     field `.ptr`: 8 bytes
print-type-size     field `.alloc`: 0 bytes
...
```

There are some abstractions involved, but ultimately the memory layout looks like this:

```c
struct Vec {
    usize cap;
    ptr64 ptr;
    usize len;
};
```

Relevant types:
- [`Vec`](https://github.com/rust-lang/rust/blob/ec28ae9454139023117270985f114823d6570657/library/alloc/src/vec/mod.rs#L409)
- [`RawVec`](https://github.com/rust-lang/rust/blob/ec28ae9454139023117270985f114823d6570657/library/alloc/src/raw_vec/mod.rs#L74)
- [`RawVecInner`](https://github.com/rust-lang/rust/blob/ec28ae9454139023117270985f114823d6570657/library/alloc/src/raw_vec/mod.rs#L86)

With this background information, we are ready to look at the decompiled code. Note that this is not the raw decompiled code. First we needed to create the `Vec<u8>` type in the Structure Editor and apply it in the code, then implement some further modifications, e.g., fix the prototype of `__rust_alloc`.

```c
/* WARNING: Unknown calling convention: __rustcall */
/* rust_lab::main */

u8 __rustcall rust_lab::main(void)

{
  Vec<u8> vec;
  u8 ret;
  
  vec.ptr = __rustc::__rust_alloc(3,1);
  if (vec.ptr != (u8 *)0x0) {
    vec.ptr[2] = '\x03';
    vec.ptr[0] = '\x01';
    vec.ptr[1] = '\x02';
    vec.cap = 3;
    vec.len = 3;
                    /* try { // try from 00401958 to 00401967 has its CatchHandler @ 004019ac */
    alloc::raw_vec::RawVec<T,A>::grow_one(&vec,&PTR_s_src/main.rs_0046d860);
    vec.ptr[3] = 4;
    vec.len = 3;
    ret = vec.ptr[3];
    __rustc::__rust_dealloc(vec.ptr,vec.cap,1);
    return ret;
  }
                    /* WARNING: Subroutine does not return */
  alloc::alloc::handle_alloc_error(1,3);
}
```

The code is fairly self-explanatory at this point. But, for completeness, the logic is the following:
- allocate a 3 byte section on the heap
- initialize the heap data, capacity and length
- increase the capacity (normally, length is increased as well, but in this case it is optimized out since we immediately pop the last element)
- initialize the new heap data
- save the last element in the return variable
- deallocate the heap data
- return the return variable

The only thing we might need to discuss is [`grow_one`](https://github.com/rust-lang/rust/blob/e0d014a3dffbb3f0575cfbeb0f480c5080c4d018/library/alloc/src/raw_vec/mod.rs#L570). If we check the implementation, we can see that it calls [`grow_amortized`](https://github.com/rust-lang/rust/blob/e0d014a3dffbb3f0575cfbeb0f480c5080c4d018/library/alloc/src/raw_vec/mod.rs#L639).

```rust
    fn grow_amortized(
        &mut self,
        len: usize,
        additional: usize,
        elem_layout: Layout,
    ) -> Result<(), TryReserveError> {
...
        let cap = cmp::max(self.cap.as_inner() * 2, required_cap);
        let cap = cmp::max(min_non_zero_cap(elem_layout.size()), cap);
...
```
By default, this function doubles the capacity. In our case, since the old capacity is 3, the new one would be 6, but since the [`Layout`](https://stdrs.dev/nightly/x86_64-unknown-linux-gnu/alloc/alloc/struct.Layout.html) size is 1, it rounds up the capacity to 8.

```rust
// Tiny Vecs are dumb. Skip to:
// - 8 if the element size is 1, because any heap allocators is likely
//   to round up a request of less than 8 bytes to at least 8 bytes.
// ...
const fn min_non_zero_cap(size: usize) -> usize {
    if size == 1 {
        8
    } else if size <= 1024 {
        4
    } else {
        1
    }
}
```

Call graph of `grow_one`:

```
grow_one
    finish_grow
        __rust_realloc
        __rust_alloc
```

Raw decompiled code for reference:

```c
/* WARNING: Unknown calling convention: __rustcall */
/* rust_lab::main */

undefined1 __rustcall rust_lab::main(void)

{
  undefined1 uVar1;
  undefined2 *puVar2;
  undefined8 local_38;
  undefined2 *local_30;
  undefined8 local_28;
  
  puVar2 = (undefined2 *)0x3;
  __rustc::__rust_alloc(3,1);
  if (puVar2 != (undefined2 *)0x0) {
    *(undefined1 *)(puVar2 + 1) = 3;
    *puVar2 = 0x201;
    local_38 = 3;
    local_28 = 3;
                    /* try { // try from 00401958 to 00401967 has its CatchHandler @ 004019ac */
    local_30 = puVar2;
    alloc::raw_vec::RawVec<T,A>::grow_one(&local_38,&PTR_s_src/main.rs_0046d860);
    *(undefined1 *)((long)local_30 + 3) = 4;
    local_28 = 3;
    uVar1 = *(undefined1 *)((long)local_30 + 3);
    __rustc::__rust_dealloc(local_30,local_38,1);
    return uVar1;
  }
                    /* WARNING: Subroutine does not return */
  alloc::alloc::handle_alloc_error(1,3);
}
```

Now that we see the big picture, we are ready to go through the listing. To easily match the listing with the decompiled code, it is annotated with pre-comments.

There is one additional piece of information we need to be familiar with to fully understand all of the instructions. [`__rust_no_alloc_shim_is_unstable`](https://github.com/rust-lang/rust/blob/6de3a733122a82d9b3c3427c7ee16a1e1a022718/library/alloc/src/alloc.rs#L35) is an internal variable, `ldrb wzr,[x8]=>__rust_no_alloc_shim_is_unstable` forces the linker to include the [alloc shim](https://github.com/rust-lang/rust/blob/6de3a733122a82d9b3c3427c7ee16a1e1a022718/library/alloc/src/alloc.rs#L91). The tracking issue is [here](https://github.com/rust-lang/rust/issues/123015) for anyone who might be interested.

Listing:

```
                             **************************************************************
                             * rust_lab::main                                             *
                             **************************************************************
                             undefined __rustcall main()
             undefined         <UNASSIGNED>   <RETURN>
             undefined8        Stack[-0x10]:8 local_10                                XREF[2]:     0040191c(W), 
                                                                                                   00401994(R)  
             undefined8        Stack[-0x20]:8 local_20                                XREF[2]:     00401918(W), 
                                                                                                   00401990(*)  
             Vec<u8>           Stack[-0x38]   vec                                     XREF[2,3]:   00401950(W), 
                                                                                                   0040197c(R), 
                                                                                                   00401968(R), 
                                                                                                   00401954(W), 
                                                                                                   00401980(W)  
             u8                HASH:5f59380   ret
                             _ZN8rust_lab4main17h4c095f7be815a79eE           XREF[4]:     main:004019f8(*), 004528cc, 
                             rust_lab::main                                               00453a8f(*), 00464cc0(*)  
        00401914 ff 03 01 d1     sub        sp,sp,#0x40
        00401918 fd 7b 02 a9     stp        x29,x30,[sp, #local_20]
        0040191c f3 1b 00 f9     str        x19,[sp, #local_10]
        00401920 fd 83 00 91     add        x29,sp,#0x20
        00401924 68 03 00 d0     adrp       x8,0x46f000
                             arg0: 3
        00401928 60 00 80 52     mov        w0,#0x3
                             arg1: 1
        0040192c 21 00 80 52     mov        w1,#0x1
        00401930 08 a1 47 f9     ldr        x8,[x8, #0xf40]=>->__rust_no_alloc_shim_is_uns   = 00470ae4
        00401934 73 00 80 52     mov        w19,#0x3
                             force the linker to include the alloc shim
        00401938 1f 01 40 39     ldrb       wzr,[x8]=>__rust_no_alloc_shim_is_unstable       = ??
        0040193c 34 00 00 94     bl         __rustc::__rust_alloc                            u8 * __rust_alloc(usize size, us
        00401940 00 03 00 b4     cbz        x0,LAB_004019a0
        00401944 28 40 80 52     mov        w8,#0x201
                             heap_data[2] = 3
        00401948 13 08 00 39     strb       w19,[x0, #0x2]
                             heap_data[0] = 1
                             heap_data[1] = 2
        0040194c 08 00 00 79     strh       w8,[x0]
                             init vec.cap and vec.ptr
        00401950 f3 83 00 a9     stp        x19,x0,[sp, #vec.cap]
                             init vec.len
        00401954 f3 0f 00 f9     str        x19,[sp, #vec.len]
                             try { // try from 00401958 to 00401967 has its CatchHandler @
                             LAB_00401958                                    XREF[1]:     00453a88(*)  
        00401958 61 03 00 90     adrp       x1,0x46d000
                             arg1: source location for debugging
        0040195c 21 80 21 91     add        x1=>PTR_s_src/main.rs_0046d860,x1,#0x860         = 0044aea0
                             arg0: address of vec
        00401960 e0 23 00 91     add        x0,sp,#0x8
                             increase cap from 3 to 8
        00401964 fd 0d 01 94     bl         alloc::raw_vec::RawVec<T,A>::grow_one            undefined grow_one()
                             } // end try from 00401958 to 00401967
                             LAB_00401968                                    XREF[1]:     00453a8d(*)  
        00401968 e8 0b 40 f9     ldr        x8,[sp, #vec.ptr]
        0040196c 89 00 80 52     mov        w9,#0x4
                             arg2: 1
        00401970 22 00 80 52     mov        w2,#0x1
                             vec.ptr[3] = 4
        00401974 09 0d 00 39     strb       w9,[x8, #0x3]
        00401978 68 00 80 52     mov        w8,#0x3
                             arg0: vec.ptr
                             arg1: vec.cap
        0040197c e1 83 40 a9     ldp        x1,x0,[sp, #vec.cap]
                             vec.len = 3
        00401980 e8 0f 00 f9     str        x8,[sp, #vec.len]
                             save return value
        00401984 13 0c 40 39     ldrb       w19,[x0, #0x3]
        00401988 22 00 00 94     bl         __rustc::__rust_dealloc                          void __rust_dealloc(u8 * ptr, us
                             return value
        0040198c e0 03 13 2a     mov        w0,w19
        00401990 fd 7b 42 a9     ldp        x29=>local_20,x30,[sp, #0x20]
        00401994 f3 1b 40 f9     ldr        x19,[sp, #local_10]
        00401998 ff 03 01 91     add        sp,sp,#0x40
        0040199c c0 03 5f d6     ret
                             LAB_004019a0                                    XREF[1]:     00401940(j)  
        004019a0 20 00 80 52     mov        w0,#0x1
        004019a4 61 00 80 52     mov        w1,#0x3
        004019a8 0f fe ff 97     bl         alloc::alloc::handle_alloc_error                 undefined handle_alloc_error()
                             -- Flow Override: CALL_RETURN (CALL_TERMINATOR)
```

## `rust-lldb`

We can verify the results of our static analysis using `rust-lldb`.

Start a GDB server and connect to it with the `rust-lldb` client. We will examine our `Vec` struct just before deallocation.

```
$ qemu-aarch64 -g 1234 target/aarch64-unknown-linux-musl/release/rust-lab
```

```
$ rust-lldb --source-quietly -o "gdb-remote localhost:1234" target/aarch64-unknown-linux-musl/release/rust-lab
Current executable set to '/home/gemesa/git-repos/rust-lab/target/aarch64-unknown-linux-musl/release/rust-lab' (aarch64).
Process 1447629 stopped
* thread #1, stop reason = signal SIGTRAP
    frame #0: 0x00000000004017d4 rust-lab`_start
rust-lab`_start:
->  0x4017d4 <+0>:  mov    x29, #0x0 ; =0 
    0x4017d8 <+4>:  mov    x30, #0x0 ; =0 
    0x4017dc <+8>:  mov    x0, sp
    0x4017e0 <+12>: adrp   x1, 0
(lldb) b _ZN8rust_lab4main17h4c095f7be815a79eE
Breakpoint 2: where = rust-lab`rust_lab::main::h4c095f7be815a79e, address = 0x0000000000401914
(lldb) c
Process 1447629 resuming
Process 1447629 stopped
* thread #1, stop reason = breakpoint 2.1
    frame #0: 0x0000000000401914 rust-lab`rust_lab::main::h4c095f7be815a79e
rust-lab`rust_lab::main::h4c095f7be815a79e:
->  0x401914 <+0>:  sub    sp, sp, #0x40
    0x401918 <+4>:  stp    x29, x30, [sp, #0x20]
    0x40191c <+8>:  str    x19, [sp, #0x30]
    0x401920 <+12>: add    x29, sp, #0x20
(lldb) disas
rust-lab`rust_lab::main::h4c095f7be815a79e:
->  0x401914 <+0>:   sub    sp, sp, #0x40
    0x401918 <+4>:   stp    x29, x30, [sp, #0x20]
    0x40191c <+8>:   str    x19, [sp, #0x30]
    0x401920 <+12>:  add    x29, sp, #0x20
    0x401924 <+16>:  adrp   x8, 110
    0x401928 <+20>:  mov    w0, #0x3 ; =3 
    0x40192c <+24>:  mov    w1, #0x1 ; =1 
    0x401930 <+28>:  ldr    x8, [x8, #0xf40]
    0x401934 <+32>:  mov    w19, #0x3 ; =3 
    0x401938 <+36>:  ldrb   wzr, [x8]
    0x40193c <+40>:  bl     0x401a0c       ; __rustc::__rust_alloc
    0x401940 <+44>:  cbz    x0, 0x4019a0 ; <+140>
    0x401944 <+48>:  mov    w8, #0x201 ; =513 
    0x401948 <+52>:  strb   w19, [x0, #0x2]
    0x40194c <+56>:  strh   w8, [x0]
    0x401950 <+60>:  stp    x19, x0, [sp, #0x8]
    0x401954 <+64>:  str    x19, [sp, #0x18]
    0x401958 <+68>:  adrp   x1, 108
    0x40195c <+72>:  add    x1, x1, #0x860
    0x401960 <+76>:  add    x0, sp, #0x8
    0x401964 <+80>:  bl     0x445158       ; alloc::raw_vec::RawVec$LT$T$C$A$GT$::grow_one::h19885d150c1bd8f5
    0x401968 <+84>:  ldr    x8, [sp, #0x10]
    0x40196c <+88>:  mov    w9, #0x4 ; =4 
    0x401970 <+92>:  mov    w2, #0x1 ; =1 
    0x401974 <+96>:  strb   w9, [x8, #0x3]
    0x401978 <+100>: mov    w8, #0x3 ; =3 
    0x40197c <+104>: ldp    x1, x0, [sp, #0x8]
    0x401980 <+108>: str    x8, [sp, #0x18]
    0x401984 <+112>: ldrb   w19, [x0, #0x3]
    0x401988 <+116>: bl     0x401a10       ; __rustc::__rust_dealloc
    0x40198c <+120>: mov    w0, w19
    0x401990 <+124>: ldp    x29, x30, [sp, #0x20]
    0x401994 <+128>: ldr    x19, [sp, #0x30]
    0x401998 <+132>: add    sp, sp, #0x40
    0x40199c <+136>: ret    
    0x4019a0 <+140>: mov    w0, #0x1 ; =1 
    0x4019a4 <+144>: mov    w1, #0x3 ; =3 
    0x4019a8 <+148>: bl     0x4011e4       ; alloc::alloc::handle_alloc_error::h3005aad4027c4877
    0x4019ac <+152>: ldr    x1, [sp, #0x8]
    0x4019b0 <+156>: mov    x19, x0
    0x4019b4 <+160>: cbz    x1, 0x4019c4 ; <+176>
    0x4019b8 <+164>: ldr    x0, [sp, #0x10]
    0x4019bc <+168>: mov    w2, #0x1 ; =1 
    0x4019c0 <+172>: bl     0x401a10       ; __rustc::__rust_dealloc
    0x4019c4 <+176>: mov    x0, x19
    0x4019c8 <+180>: bl     0x433688       ; _Unwind_Resume
(lldb) b *0x401988
Breakpoint 3: where = rust-lab`rust_lab::main::h4c095f7be815a79e + 116, address = 0x0000000000401988
(lldb) c
Process 1447629 resuming
Process 1447629 stopped
* thread #1, stop reason = breakpoint 3.1
    frame #0: 0x0000000000401988 rust-lab`rust_lab::main::h4c095f7be815a79e + 116
rust-lab`rust_lab::main::h4c095f7be815a79e:
->  0x401988 <+116>: bl     0x401a10       ; __rustc::__rust_dealloc
    0x40198c <+120>: mov    w0, w19
    0x401990 <+124>: ldp    x29, x30, [sp, #0x20]
    0x401994 <+128>: ldr    x19, [sp, #0x30]
(lldb) x/g $sp+8
0x7f7d0dd8d8c8: 0x0000000000000008
(lldb) x/g $sp+16
0x7f7d0dd8d8d0: 0x00007f7d0fc0d040
(lldb) x/g 0x00007f7d0fc0d040
0x7f7d0fc0d040: 0x0000000004030201
(lldb) x/g $sp+24
0x7f7d0dd8d8d8: 0x0000000000000003
```
The capacity is 8, the heap data is `[1, 2, 3, 4]` and the length is 3, as expected.
