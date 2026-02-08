use x3_ast::ast::*;
use x3_common::Symbol;
use x3_compiler::emitter;
use x3_compiler::lowering;
use x3_vm::x3_vm::{VMConfig, VM};

fn main() {
    // Build a trivial program AST
    let span = x3_common::Span::DUMMY;
    let program = Program::new(vec![x3_common::Spanned::new(
        Item::Function(Function {
            name: Symbol::new("main"),
            id: None,
            params: vec![],
            ret: None,
            generics: vec![],
            body: Block::new(vec![Statement::Expr(Expression::Literal(
                LiteralExpr::Int {
                    value: 42,
                    base: x3_common::IntBase::Decimal,
                    suffix: None,
                },
            ))]),
            visibility: Visibility::Pub,
            is_async: false,
        }),
        span,
    )]);

    let code = compile_program(&program).expect("compile failed");

    let mut vm = VM::new(code, VMConfig::default(), 1000u128);
    let result = vm.execute();
    println!("vm exec result: {:?}", result);
}
