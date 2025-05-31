# Startup

This section shows how to locate the user-defined `main` function and trace the call chain that leads to its execution.

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

Listing:

```
                             **************************************************************
                             *                          FUNCTION                          *
                             **************************************************************
                             undefined main()
             undefined         <UNASSIGNED>   <RETURN>
             undefined8        Stack[-0x10]:8 local_10                                XREF[1]:     00401b38(W)  
                             main                                            XREF[5]:     Entry Point(*), 
                                                                                          _start_c:004019f4(*), 00453c74, 
                                                                                          004648c4(*), 0046ff90(*)  
        00401b28 08 00 00 90     adrp       x8,0x401000
                             adrp + add loads the address of rust_lab::main
        00401b2c 08 c1 2b 91     add        x8,x8,#0xaf0
                             arg3: argv
        00401b30 e3 03 01 aa     mov        x3,x1
                             arg2: argc
        00401b34 02 7c 40 93     sxtw       x2,w0
                             store link register and address of rust_lab::main on the stack
        00401b38 fe 23 bf a9     stp        x30,x8=>rust_lab::main,[sp, #local_10]!
        00401b3c 61 03 00 90     adrp       x1,0x46d000
                             arg1: vtable pointer of the trait object
        00401b40 21 a0 1b 91     add        x1=>DAT_0046d6e8,x1,#0x6e8
                             arg0: data pointer of the trait object
        00401b44 e0 23 00 91     add        x0,sp,#0x8
                             arg4: 0
        00401b48 e4 03 1f 2a     mov        w4,wzr
        00401b4c ad 5b 00 94     bl         std::rt::lang_start_internal                     undefined lang_start_internal()
        00401b50 fe 07 41 f8     ldr        x30,[sp], #0x10
        00401b54 c0 03 5f d6     ret
```

### Understanding the `lang_start_internal` arguments

If we look at the signature of [`lang_start_internal`](https://github.com/rust-lang/rust/blob/738c08b63c4f9e3ebdaec5eece7b6fbc354f6467/library/std/src/rt.rs#L152), we can see that it accepts 4 arguments, but the decompiled code above shows 5.

```rust
// To reduce the generated code of the new `lang_start`, this function is doing
// the real work.
#[cfg(not(test))]
fn lang_start_internal(
    main: &(dyn Fn() -> i32 + Sync + crate::panic::RefUnwindSafe),
    argc: isize,
    argv: *const *const u8,
    sigpipe: u8,
) -> isize {
...
```

This is because the first argument is a closure that is converted to a trait object when [`lang_start`](https://github.com/rust-lang/rust/blob/738c08b63c4f9e3ebdaec5eece7b6fbc354f6467/library/std/src/rt.rs#L199) calls `lang_start_internal`.

```rust
#[cfg(not(any(test, doctest)))]
#[lang = "start"]
fn lang_start<T: crate::process::Termination + 'static>(
    main: fn() -> T,
    argc: isize,
    argv: *const *const u8,
    sigpipe: u8,
) -> isize {
    lang_start_internal(
        &move || crate::sys::backtrace::__rust_begin_short_backtrace(main).report().to_i32(),
        argc,
        argv,
        sigpipe,
    )
}
```

Within the closure body, [`__rust_begin_short_backtrace`](https://github.com/rust-lang/rust/blob/738c08b63c4f9e3ebdaec5eece7b6fbc354f6467/library/std/src/sys/backtrace.rs#L148) is called, which then calls `rust_lab::main`.

```rust
/// Fixed frame used to clean the backtrace with `RUST_BACKTRACE=1`. Note that
/// this is only inline(never) when backtraces in std are enabled, otherwise
/// it's fine to optimize away.
#[cfg_attr(feature = "backtrace", inline(never))]
pub fn __rust_begin_short_backtrace<F, T>(f: F) -> T
where
    F: FnOnce() -> T,
{
    let result = f();

    // prevent this frame from being tail-call optimised away
    crate::hint::black_box(());

    result
}
```

Trait objects are represented by a data pointer (here: address of `rust_lab::main`) and a vtable pointer (here: `DAT_0046d6e8`).

```
                             DAT_0046d6e8                                    XREF[1]:     main:00401b40(*)  
        0046d6e8 00              undefined1 00h
        0046d6e9 00              ??         00h
        ...
        0046d700 d8 1a 40        addr       core::ops::function::FnOnce::call_once{{vtable
                 00 00 00 
                 00 00
        0046d708 b0 1a 40        addr       std::rt::lang_start::_{{closure}}
                 00 00 00 
                 00 00
        0046d710 b0 1a 40        addr       std::rt::lang_start::_{{closure}}
                 00 00 00 
                 00 00
```

If we look at the disassembly of `lang_start_internal`, we can see which vtable entry it uses to execute `rust_lab::main`:

```c

/* WARNING: Globals starting with '_' overlap smaller symbols at the same address */
/* WARNING: Unknown calling convention: __rustcall */
/* std::rt::lang_start_internal */

long __rustcall
std::rt::lang_start_internal
          (undefined8 param_1,long param_2,undefined8 param_3,undefined8 param_4,byte param_5)

{
...
  (**(code **)(param_2 + 0x28))(param_1);
...
```
```
0x0046d6e8 + 0x28 = 0x46d710
```

Using this offset and the vtable address, we can calculate the address of the vtable entry which contains the address of `std::rt::lang_start::_{{closure}}`:

```c
/* WARNING: Unknown calling convention: __rustcall */
/* std::rt::lang_start::_{{closure}} */

undefined8 __rustcall std::rt::lang_start::_{{closure}}(undefined8 *param_1)

{
  sys::backtrace::__rust_begin_short_backtrace(*param_1);
  return 0;
}
```

As we also saw earlier, `__rust_begin_short_backtrace` calls `rust_lab::main` in the end.

```c
/* WARNING: Unknown calling convention: __rustcall */
/* std::sys::backtrace::__rust_begin_short_backtrace */

void __rustcall std::sys::backtrace::__rust_begin_short_backtrace(code *param_1)

{
  (*param_1)();
  return;
}
```
