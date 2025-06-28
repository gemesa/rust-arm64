# Introduction

## Source

Initialize a new workspace with `cargo init` then run `cargo add tokio --features full`.

```rust
use tokio::time::{Duration, sleep};

#[tokio::main]
async fn main() {
    make_coffee().await;
    toast_bread().await;
}

async fn make_coffee() {
    sleep(Duration::from_secs(3)).await;
}

async fn toast_bread() {
    sleep(Duration::from_secs(2)).await;
}
```

The [Tokio crate](https://docs.rs/tokio/latest/tokio/), the [`async`](https://doc.rust-lang.org/std/keyword.async.html)/[`await`](https://doc.rust-lang.org/std/keyword.await.html) keywords and the [`Future`](https://doc.rust-lang.org/std/future/trait.Future.html) trait are described in many places online. Some of the best are the long and detailed explanations by [Jon Gjengset](https://www.youtube.com/@jonhoo). This book assumes you are already familiar with these `async` constructs.

## Build

```
$ cargo rustc --release
```

## Ghidra

Load the ELF file (located at `target/aarch64-unknown-linux-musl/release/`) into Ghidra and auto-analyze it.

### Locating the `async` tasks

The first thing to do is locate the implemented `async` tasks and their relationships. To start, we can see in the expanded code how the runtime is constructed and our tasks are passed to [`block_on`](https://docs.rs/tokio/latest/tokio/runtime/struct.Runtime.html#method.block_on).

```
$ cargo expand
```

```rust
#![feature(prelude_import)]
#[prelude_import]
use std::prelude::rust_2024::*;
#[macro_use]
extern crate std;
use tokio::time::{Duration, sleep};
fn main() {
    let body = async {
        make_coffee().await;
        toast_bread().await;
    };
    #[allow(
        clippy::expect_used,
        clippy::diverging_sub_expression,
        clippy::needless_return
    )]
    {
        return tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("Failed building the Runtime")
            .block_on(body);
    }
}
async fn make_coffee() {
    sleep(Duration::from_secs(3)).await;
}
async fn toast_bread() {
    sleep(Duration::from_secs(2)).await;
}
```

Based on this output, we expect to see the runtime built by the [`new_multi_thread()`](https://docs.rs/tokio/latest/tokio/runtime/struct.Builder.html#method.new_multi_thread), [`enable_all()`](https://docs.rs/tokio/latest/tokio/runtime/struct.Builder.html#method.enable_all) and [`expect`](https://doc.rust-lang.org/std/result/enum.Result.html#method.expect) sequence and the tasks executed by [`block_on`](https://docs.rs/tokio/latest/tokio/runtime/struct.Runtime.html#method.block_on).


Decompiled code:

```c

/* WARNING: Unknown calling convention: __rustcall */
/* rust_lab::main */

void __rustcall rust_lab::main(void)

{
...
  undefined1 auStack_248 [205];
  undefined2 local_17b;
...
                    /* try { // try from 0040a6b4 to 0040a6bb has its CatchHandler @ 0040a90c */
  tokio::runtime::builder::Builder::new_multi_thread(auStack_248);
  local_17b = 0x101;
                    /* try { // try from 0040a6cc to 0040a6d7 has its CatchHandler @ 0040a914 */
  tokio::runtime::builder::Builder::build(&local_d0,auStack_248);
  if (local_d0 == 2) {
    local_170[0] = lStack_c8;
                    /* try { // try from 0040a884 to 0040a8a7 has its CatchHandler @ 0040a91c */
                    /* WARNING: Subroutine does not return */
    core::result::unwrap_failed
              ("Failed building the Runtime",0x1b,local_170,
               &PTR_drop_in_place<std::io::error::Error>_004baf90,&PTR_s_src/main.rs_004bb040);
  }
...
```

The `enable_all` function call is nowhere to be seen. The reason is that it has been replaced by `local_17b = 0x101;`, which sets the `enable_io` and `enable_time` fields (at offset 205).

```
$ cargo rustc --release -- -Zprint-type-sizes
...
print-type-size type: `tokio::runtime::Builder`: 216 bytes, alignment: 8 bytes
print-type-size     field `.worker_threads`: 16 bytes
print-type-size     field `.thread_stack_size`: 16 bytes
print-type-size     field `.global_queue_interval`: 8 bytes
print-type-size     field `.keep_alive`: 16 bytes
print-type-size     field `.thread_name`: 16 bytes
print-type-size     field `.nevents`: 8 bytes
print-type-size     field `.max_blocking_threads`: 8 bytes
print-type-size     field `.after_start`: 16 bytes
print-type-size     field `.before_stop`: 16 bytes
print-type-size     field `.before_park`: 16 bytes
print-type-size     field `.after_unpark`: 16 bytes
print-type-size     field `.before_spawn`: 16 bytes
print-type-size     field `.after_termination`: 16 bytes
print-type-size     field `.seed_generator`: 16 bytes
print-type-size     field `.event_interval`: 4 bytes
print-type-size     field `.kind`: 1 bytes
print-type-size     field `.enable_io`: 1 bytes
print-type-size     field `.enable_time`: 1 bytes
print-type-size     field `.start_paused`: 1 bytes
print-type-size     field `.disable_lifo_slot`: 1 bytes
print-type-size     field `.metrics_poll_count_histogram_enable`: 1 bytes
print-type-size     field `.metrics_poll_count_histogram`: 0 bytes
print-type-size     end padding: 6 bytes
...
```

Additionally, `expect` has been replaced with [`unwrap_failed`](https://stdrs.dev/nightly/x86_64-unknown-linux-gnu/core/result/fn.unwrap_failed.html).

Scrolling through the remaining code in `main` we cannot locate `block_on`. The reason for that is that it is called via `enter_runtime`:

```c
...
                    /* try { // try from 0040a6b4 to 0040a6bb has its CatchHandler @ 0040a90c */
  tokio::runtime::builder::Builder::new_multi_thread(auStack_248);
  local_17b = 0x101;
                    /* try { // try from 0040a6cc to 0040a6d7 has its CatchHandler @ 0040a914 */
  tokio::runtime::builder::Builder::build(&local_d0,auStack_248);
  if (local_d0 == 2) {
    local_170[0] = lStack_c8;
                    /* try { // try from 0040a884 to 0040a8a7 has its CatchHandler @ 0040a91c */
                    /* WARNING: Subroutine does not return */
    core::result::unwrap_failed
              ("Failed building the Runtime",0x1b,local_170,
               &PTR_drop_in_place<std::io::error::Error>_004baf90,&PTR_s_src/main.rs_004bb040);
  }
...
                    /* try { // try from 0040a71c to 0040a727 has its CatchHandler @ 0040a8ec */
  tokio::runtime::runtime::Runtime::enter(&local_e8,&local_2a0);
  if ((int)local_2a0 == 1) {
    local_d0 = (ulong)uStack_31f << 8;
                    /* try { // try from 0040a758 to 0040a76f has its CatchHandler @ 0040a8c8 */
    tokio::runtime::context::runtime::enter_runtime
              (&uStack_270,1,&local_d0,
               &PTR_anon.e686db471eac9d0c22db85cdbc9be48c.37.llvm.11646938216170472302_004bafb0);
  }
...
```

```c

/* WARNING: Unknown calling convention: __rustcall */
/* tokio::runtime::context::runtime::enter_runtime */

void __rustcall
tokio::runtime::context::runtime::enter_runtime
          (int *param_1,undefined4 param_2,undefined8 *param_3,undefined8 param_4)

{
...
      park::CachedParkThread::block_on(pppuVar5,&local_e0);
...
```

### `async` tasks

Now that we have located `block_on`, we can investigate how the `async` tasks are handled.

Digging deeper and looking at the HIR we can see how the `async` and `await` keywords are resolved. Simply put: the tasks are polled until they are ready. When a task is pending, it yields which means it signals to the runtime that the runtime can handle other tasks and check back later.

```
$ cargo rustc --release --quiet -- -Z unpretty=hir                                     
#[prelude_import]
use std::prelude::rust_2024::*;
#[macro_use]
extern crate std;
use ::{};
use tokio::time::Duration;
use tokio::time::sleep;

fn main() {
    let body =
        |mut _task_context: ResumeTy|
            {
                match #[lang = "into_future"](make_coffee()) {
                    mut __awaitee =>
                        loop {
                            match unsafe {
                                    #[lang = "poll"](#[lang = "new_unchecked"](&mut __awaitee),
                                        #[lang = "get_context"](_task_context))
                                } {
                                #[lang = "Ready"] {  0: result } => break result,
                                #[lang = "Pending"] {} => { }
                            }
                            _task_context = (yield ());
                        },
                };
                match #[lang = "into_future"](toast_bread()) {
                    mut __awaitee =>
                        loop {
                            match unsafe {
                                    #[lang = "poll"](#[lang = "new_unchecked"](&mut __awaitee),
                                        #[lang = "get_context"](_task_context))
                                } {
                                #[lang = "Ready"] {  0: result } => break result,
                                #[lang = "Pending"] {} => { }
                            }
                            _task_context = (yield ());
                        },
                };
            };
    #[allow(clippy :: expect_used, clippy :: diverging_sub_expression, clippy
    :: needless_return)]
    {
        return tokio::runtime::Builder::new_multi_thread().enable_all().build().expect("Failed building the Runtime").block_on(body);
    }
}

async fn make_coffee()
    ->
        /*impl Trait*/ |mut _task_context: ResumeTy|
    {
        {
            let _t =
                {
                    match #[lang = "into_future"](sleep(Duration::from_secs(3)))
                        {
                        mut __awaitee =>
                            loop {
                                match unsafe {
                                        #[lang = "poll"](#[lang = "new_unchecked"](&mut __awaitee),
                                            #[lang = "get_context"](_task_context))
                                    } {
                                    #[lang = "Ready"] {  0: result } => break result,
                                    #[lang = "Pending"] {} => { }
                                }
                                _task_context = (yield ());
                            },
                    };
                };
            _t
        }
    }

async fn toast_bread()
    ->
        /*impl Trait*/ |mut _task_context: ResumeTy|
    {
        {
            let _t =
                {
                    match #[lang = "into_future"](sleep(Duration::from_secs(2)))
                        {
                        mut __awaitee =>
                            loop {
                                match unsafe {
                                        #[lang = "poll"](#[lang = "new_unchecked"](&mut __awaitee),
                                            #[lang = "get_context"](_task_context))
                                    } {
                                    #[lang = "Ready"] {  0: result } => break result,
                                    #[lang = "Pending"] {} => { }
                                }
                                _task_context = (yield ());
                            },
                    };
                };
            _t
        }
    }
```

Decompiled code:

```

/* WARNING: Unknown calling convention: __rustcall */
/* tokio::runtime::park::CachedParkThread::block_on */

bool __rustcall tokio::runtime::park::CachedParkThread::block_on(long param_1,char *param_2)

{
...
    do {
      if ( ... ) {
...
        tokio::time::sleep::sleep(3,0,&PTR_s_src/main.rs_004bb080);
...
        uVar5 = _<>::poll();
        if ((uVar5 & 1) == 0) {
...
          tokio::time::sleep::sleep(2,0,&PTR_s_src/main.rs_004bb0b0);
...
          goto LAB_0040b2b0;
        }
...
joined_r0x0040b25c:
        bVar2 = true;
...
      }
      else { ... }
LAB_0040b2b0:
...
        uVar5 = _<>::poll();
        if ((uVar5 & 1) != 0) {
...
          goto joined_r0x0040b25c;
        }
...
      if (!bVar2) goto LAB_0040b324;
      park(param_1);
...
    } while( true );
...
LAB_0040b358:
  return lVar6 == 0;
LAB_0040b324:
...
  goto LAB_0040b358;
}
```

Explanation:
- call `sleep(3)`
- call `poll` to check the progress
  - if it returns 0 (ready), then call `sleep(2)`
    - call `poll` to check the progress
      - if it returns 1 (pending), set `bVar2` to `true` which means the thread will be `park`ed and resumed later
  - if it returns 1 (pending), set `bVar2` to `true` which means the thread will be `park`ed and resumed later

Additionally, Tokio uses variables to track the progress of the tasks, so it knows where to continue the thread. For readability, these variables have been removed from the decompiled code.
