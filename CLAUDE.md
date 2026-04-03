# Tokscale

Rust CLI tool for tracking Claude/LLM token usage and cost.

## Build & Test

```bash
cargo build                      # dev build
cargo test -p tokscale-cli       # unit + integration tests
cargo install --path crates/tokscale-cli  # install to ~/.local/bin/tokscale
```

## Post-merge Checklist

merge worker branch 后必须跑完以下步骤再收工：

1. `cargo build` — 编译通过
2. `cargo test -p tokscale-cli` — 全绿
3. `cargo install --path crates/tokscale-cli` — 更新用户实际使用的 binary
4. 清理 worktree + branch

少了第 3 步 = 用户用的还是旧版本，merge 等于白做。

## Project Structure

- `crates/tokscale-cli/src/` — CLI 主代码
- `crates/tokscale-cli/src/tui/ui/` — TUI 渲染（hourly.rs, agents.rs 等）
