# Built-in attributes

## Source

Initialize a new workspace with `cargo init --lib`.

```rust
#[derive(Clone)]
#[repr(C)]
pub struct Person {
    name: String,
    age: u32,
}

pub fn attribute_person() -> Person {
    let person = Person {
        name: "Rustacean".to_string(),
        age: 22,
    };
    person
}
```

[Attributes](https://doc.rust-lang.org/reference/attributes.html) are metadata either attached to the containing item (inner attribute) or attached to the following item (outer attribute). There are many types of [built-in attributes](https://doc.rust-lang.org/reference/attributes.html#built-in-attributes-index) but from code generation point of view, we only care about the ones directly influencing the generated code, such as [`derive`](https://doc.rust-lang.org/reference/attributes/derive.html), [`repr`](https://doc.rust-lang.org/reference/type-layout.html#representations) or [`inline`](https://doc.rust-lang.org/reference/attributes/codegen.html#the-inline-attribute), where `derive` generates additional code, `repr` affects the memory layout and `inline` is passed as a hint to the LLVM backend.

## `attribute_person`

```rust
#[derive(Clone)]
#[repr(C)]
pub struct Person {
    name: String,
    age: u32,
}

pub fn attribute_person() -> Person {
    let person = Person {
        name: "Rustacean".to_string(),
        age: 22,
    };
    person
}
```

```
$ cargo expand
...
#[repr(C)]
pub struct Person {
    name: String,
    age: u32,
}
#[automatically_derived]
impl ::core::clone::Clone for Person {
    #[inline]
    fn clone(&self) -> Person {
        Person {
            name: ::core::clone::Clone::clone(&self.name),
            age: ::core::clone::Clone::clone(&self.age),
        }
    }
}
pub fn attribute_person() -> Person {
    let person = Person {
        name: "Rustacean".to_string(),
        age: 22,
    };
    person
}
```
