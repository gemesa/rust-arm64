# Panic: unwind vs abort

When a Rust program panics, it can handle the failure in two ways: unwind or abort. Unwind mode cleans up resources as the panic travels up the call stack, while abort mode immediately terminates the program. The chosen mode affects the generated code.

## Source

The source code of chapter [`Vec`](./vec.md) is reused here.

## Build

```
$ cargo rustc --release
```

By default the option `panic=unwind` is used.

## Ghidra

Load the binary into Ghidra and auto-analyze it.

### `rust_lab::main`

While scrolling through the listing, we can see that Ghidra adds try-catch comments to the following parts, and we notice XREFs from addresses that are far away.

```
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
```

```
                             catch() { ... } // from try @ 00401958 with catch @ 004019ac
                             LAB_004019ac                                    XREF[1]:     00453a8a(*)  
        004019ac e1 07 40 f9     ldr        x1,[sp, #0x8]
        004019b0 f3 03 00 aa     mov        x19,x0
        004019b4 81 00 00 b4     cbz        x1,LAB_004019c4
        004019b8 e0 0b 40 f9     ldr        x0,[sp, #0x10]
        004019bc 22 00 80 52     mov        w2,#0x1
        004019c0 14 00 00 94     bl         __rustc::__rust_dealloc                          void __rust_dealloc(u8 * ptr, us
                             LAB_004019c4                                    XREF[1]:     004019b4(j)  
        004019c4 e0 03 13 aa     mov        x0,x19
        004019c8 30 c7 00 94     bl         _Unwind_Resume                                   undefined _Unwind_Resume()
                             -- Flow Override: CALL_RETURN (CALL_TERMINATOR)

```

If we follow the XREFs, we can see they are under the LSDA (Language-Specific Data Area) located in section `.gcc_except_table`.

```
                             //
                             // .gcc_except_table 
                             // SHT_PROGBITS  [0x453a84 - 0x454c67]
                             // ram:00453a84-ram:00454c67
                             //
                             **************************************************************
                             * Language-Specific Data Area                                *
                             **************************************************************
...
        00453a88 44              uleb128    LAB_00401958                                     (LSDA Call Site) IP Offset
        00453a89 10              uleb128    10h                                              (LSDA Call Site) IP Range Length
        00453a8a 98 01           uleb128    LAB_004019ac                                     (LSDA Call Site) Landing Pad Add
        00453a8c 00              uleb128    0h                                               (LSDA Call Site) Action Table Of
...
```

This means, if a panic occurs while the execution is between 0x00401958 and 0x00401958 + 0x10 = 0x00401968, during unwinding, the code located at 0x004019ac will be executed. In this case, if necessary (the vector capacity is not null) it deallocates the allocated block and continues the unwinding process.
