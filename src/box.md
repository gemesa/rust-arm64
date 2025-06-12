# `Box`

## Source

Initialize a new workspace with `cargo init --lib`.

```rust
#[unsafe(no_mangle)]
pub fn create_boxed_value(n: i32) -> Box<i32> {
    Box::new(n * 2)
}

#[unsafe(no_mangle)]
pub fn process_box(boxed: Box<i32>) -> i32 {
    *boxed + 10
}
```

The `Box` type is described in the [official docs](https://doc.rust-lang.org/std/boxed/struct.Box.html) in detail. Further information can be found [here](https://doc.rust-lang.org/book/ch15-01-box.html). We are using `no_mangle` to simplify things, the reason can be found [here](https://shadowshell.io/rust-arm64/option.html#no_mangle).

## Build

```
$ cargo rustc --release -- --emit obj
```

## `llvm-objdump`

For this example we will use `llvm-objdump` instead of Ghidra, as Ghidra [does not support](https://github.com/NationalSecurityAgency/ghidra/issues/8253) the relocation type `R_AARCH64_ADR_GOT_PAGE`.

Alternatively, the compiler can generate assembly output as well, although it is a bit less readable because of all the `.cfi_*` directives:

```
$ cargo rustc --release -- --emit asm
$ cat target/aarch64-unknown-linux-musl/release/deps/rust_lab-15e16dbcf37b825b.s
...
create_boxed_value:
	.cfi_startproc
	stp	x29, x30, [sp, #-32]!
	.cfi_def_cfa_offset 32
	str	x19, [sp, #16]
	mov	x29, sp
	.cfi_def_cfa w29, 32
	.cfi_offset w19, -16
	.cfi_offset w30, -24
	.cfi_offset w29, -32
	.cfi_remember_state
	adrp	x8, :got:__rust_no_alloc_shim_is_unstable
	mov	w19, w0
	mov	w0, #4
	ldr	x8, [x8, :got_lo12:__rust_no_alloc_shim_is_unstable]
	mov	w1, #4
	ldrb	wzr, [x8]
	bl	_RNvCshIQntqZdYTC_7___rustc12___rust_alloc
	cbz	x0, .LBB0_2
	lsl	w8, w19, #1
	str	w8, [x0]
	.cfi_def_cfa wsp, 32
	ldr	x19, [sp, #16]
	ldp	x29, x30, [sp], #32
	.cfi_def_cfa_offset 0
	.cfi_restore w19
	.cfi_restore w30
	.cfi_restore w29
	ret
.LBB0_2:
	.cfi_restore_state
	mov	w0, #4
	mov	w1, #4
	bl	_ZN5alloc5alloc18handle_alloc_error17h0e34a69f1cc3072eE
...
```

### `create_boxed_value`

```rust
#[unsafe(no_mangle)]
pub fn create_boxed_value(n: i32) -> Box<i32> {
    Box::new(n * 2)
}
```

Disassembly (the output is piped through `rustfilt` to demangle symbols):

```
$ llvm-objdump -r --disassemble-symbols=create_boxed_value target/aarch64-unknown-linux-musl/release/deps/rust_lab-15e16dbcf37b825b.o | rustfilt 

target/aarch64-unknown-linux-musl/release/deps/rust_lab-15e16dbcf37b825b.o:	file format elf64-littleaarch64

Disassembly of section .text.create_boxed_value:

0000000000000000 <create_boxed_value>:
       0: a9be7bfd     	stp	x29, x30, [sp, #-0x20]!
       4: f9000bf3     	str	x19, [sp, #0x10]
       8: 910003fd     	mov	x29, sp
       c: 90000008     	adrp	x8, 0x0 <create_boxed_value>
		000000000000000c:  R_AARCH64_ADR_GOT_PAGE	__rust_no_alloc_shim_is_unstable
      10: 2a0003f3     	mov	w19, w0
      14: 52800080     	mov	w0, #0x4                // =4
      18: f9400108     	ldr	x8, [x8]
		0000000000000018:  R_AARCH64_LD64_GOT_LO12_NC	__rust_no_alloc_shim_is_unstable
      1c: 52800081     	mov	w1, #0x4                // =4
      20: 3940011f     	ldrb	wzr, [x8]
      24: 94000000     	bl	0x24 <create_boxed_value+0x24>
		0000000000000024:  R_AARCH64_CALL26	__rustc::__rust_alloc
      28: b40000c0     	cbz	x0, 0x40 <create_boxed_value+0x40>
      2c: 531f7a68     	lsl	w8, w19, #1
      30: b9000008     	str	w8, [x0]
      34: f9400bf3     	ldr	x19, [sp, #0x10]
      38: a8c27bfd     	ldp	x29, x30, [sp], #0x20
      3c: d65f03c0     	ret
      40: 52800080     	mov	w0, #0x4                // =4
      44: 52800081     	mov	w1, #0x4                // =4
      48: 94000000     	bl	0x48 <create_boxed_value+0x48>
		0000000000000048:  R_AARCH64_CALL26	alloc::alloc::handle_alloc_error
```

There is one piece of information we need to be familiar with to fully understand all of the instructions. [`__rust_no_alloc_shim_is_unstable`](https://github.com/rust-lang/rust/blob/6de3a733122a82d9b3c3427c7ee16a1e1a022718/library/alloc/src/alloc.rs#L35) is an internal variable, `ldrb wzr,[x8]` forces the linker to include the [alloc shim](https://github.com/rust-lang/rust/blob/6de3a733122a82d9b3c3427c7ee16a1e1a022718/library/alloc/src/alloc.rs#L91). The tracking issue is [here](https://github.com/rust-lang/rust/issues/123015) for anyone who might be interested.

Since our input is `i32`, [`__rust_alloc`](https://stdrs.dev/nightly/x86_64-unknown-linux-gnu/alloc/alloc/fn.__rust_alloc.html) is called with the following arguments (size and alignment):

```
      14: 52800080     	mov	w0, #0x4                // =4
      1c: 52800081     	mov	w1, #0x4                // =4
```

If the allocation fails and returns null, `handle_alloc_error` is called:

```
      28: b40000c0     	cbz	x0, 0x40 <create_boxed_value+0x40>
```

After successful allocation, the input value is multiplied by 2 and stored in the allocated section:

```
      10: 2a0003f3     	mov	w19, w0
...
      2c: 531f7a68     	lsl	w8, w19, #1
      30: b9000008     	str	w8, [x0]
```

### `process_box`

```rust
#[unsafe(no_mangle)]
pub fn process_box(boxed: Box<i32>) -> i32 {
    *boxed + 10
}
```

Disassembly:

```
$ llvm-objdump -r --disassemble-symbols=process_box target/aarch64-unknown-linux-musl/release/deps/rust_lab-15e16dbcf37b825b.o | rustfilt

target/aarch64-unknown-linux-musl/release/deps/rust_lab-15e16dbcf37b825b.o:	file format elf64-littleaarch64

Disassembly of section .text.process_box:

0000000000000000 <process_box>:
       0: a9be7bfd     	stp	x29, x30, [sp, #-0x20]!
       4: f9000bf3     	str	x19, [sp, #0x10]
       8: 910003fd     	mov	x29, sp
       c: b9400013     	ldr	w19, [x0]
      10: 52800081     	mov	w1, #0x4                // =4
      14: 52800082     	mov	w2, #0x4                // =4
      18: 94000000     	bl	0x18 <process_box+0x18>
		0000000000000018:  R_AARCH64_CALL26	__rustc::__rust_dealloc
      1c: 11002a60     	add	w0, w19, #0xa
      20: f9400bf3     	ldr	x19, [sp, #0x10]
      24: a8c27bfd     	ldp	x29, x30, [sp], #0x20
      28: d65f03c0     	ret
```

The function takes ownership of the `Box` and then `boxed` goes out of scope at the end of the function, so the memory is automatically deallocated. Since the data stored in the `Box` is `i32`, [`__rust_dealloc`](https://stdrs.dev/nightly/x86_64-unknown-linux-gnu/alloc/alloc/fn.__rust_dealloc.html) is called with the following arguments (pointer, size and alignment):

```
      10: 52800081     	mov	w1, #0x4                // =4
      14: 52800082     	mov	w2, #0x4                // =4
```
`x0` already holds the pointer to the allocated memory, since the `Box` is passed to the function.

10 is added to the value and the result is returned:

```
       c: b9400013     	ldr	w19, [x0]
...
      1c: 11002a60     	add	w0, w19, #0xa
```
