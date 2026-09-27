# 部署 Runbook（vitest-playground）

## 架构与部署形态

- 生产形态：服务器上 `pnpm build && pnpm preview`（Vite preview :8000，内置 `/api/run-vitest` 中间件），nginx 反代 443 → 127.0.0.1:8000。
- 运行器当前为「受限执行」：文件名白名单、最小 env、每请求独立临时目录、2 并发 / 8 排队（满则 429）、60s 超时进程组 kill。
- 更新发布：`git pull && pnpm install --frozen-lockfile && pnpm build`，然后重启 preview 进程（建议用 systemd 或 pm2 托管，避免裸 nohup）。

## nginx 限流（必须配置）

`/etc/nginx/conf.d/vitest-playground.conf`：

```nginx
# 每个 IP 每分钟最多 10 次运行请求，突发最多 3 个
limit_req_zone $binary_remote_addr zone=vitest_run:10m rate=10r/m;

server {
    listen 443 ssl;
    server_name vitest-playground.zhangzhengyang.com;
    # ... 证书等既有配置 ...

    location /api/run-vitest {
        limit_req zone=vitest_run burst=3 nodelay;
        limit_req_status 429;
        proxy_pass http://127.0.0.1:8000;
        proxy_read_timeout 600s;  # 运行器 60s 超时 × 8 深排队最长约 480s，600s 留缓冲避免排队深处被 504
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        # COEP/COOP 由 vite preview 响应头携带，透传即可，勿在此重复 add_header
    }
}
```

生效：`nginx -t && nginx -s reload`。验证：`for i in $(seq 1 6); do curl -s -o /dev/null -w '%{http_code}\n' -X POST https://vitest-playground.zhangzhengyang.com/api/run-vitest; done` —— 若 6 次 curl 在 6 秒内连发，约第 4~5 个起应出现 429（精确序号随 nginx 版本的桶算法细节略有差异）；若全部返回 200，说明限流未生效。

## 环境变量泄露面检查（一次性，务必执行）

运行器已不再把 `process.env` 传给测试进程，但仍需确认历史暴露期内无密钥被读取过。在生产服务器上、以运行 preview 的同一用户执行：

```bash
# 1. 找到 preview 进程
pgrep -af 'vite'

# 2. 打印该进程的完整环境变量（把 <PID> 换成上一步结果）
tr '\0' '\n' < /proc/<PID>/environ | sort

# 3. 只看疑似敏感条目
tr '\0' '\n' < /proc/<PID>/environ | grep -iE 'key|token|secret|pass|cred|apikey|private'
```

判定与处置：
- 输出只有域名/端口/PATH 等公开配置 → 无泄露面，记录检查日期即可。
- 出现任何密钥/token/凭据 → 视为已泄露：立即轮换该凭据，并把新凭据改为配置文件（`chmod 600`）或 systemd `EnvironmentFile=` 注入到「不运行 preview 的」其它服务，而不是留在 preview 进程 env 里。
- 同时检查 shell 历史 / systemd unit / crontab 里是否有导出密钥的行：
  `grep -riE 'export .*(KEY|TOKEN|SECRET)' ~/.bashrc ~/.zshrc /etc/systemd/system 2>/dev/null`
  `grep -iE '(KEY|TOKEN|SECRET|PASSWORD)=' ~/.bash_history ~/.zsh_history 2>/dev/null | tail -20`
  `crontab -l 2>/dev/null | grep -iE 'key|token|secret|password'`

## 故障处理

- 跑测试一直 429：先 `pgrep -af 'vite.js preview'` 确认 preview 进程存在（正常 1-2 个：主进程 + 可能的 worker），再 `pgrep -af 'vitest.mjs' | wc -l` 看是否有卡死的 vitest 运行进程（正常应为 0）；有则确认运行器日志后重启 preview。
- 磁盘增长：`du -sh .vitest-runs` 应接近 0；若残留大量目录说明有运行被强杀后 finally 未执行，手动 `rm -rf .vitest-runs/run-*` 并提 issue 排查。
- 站点能开但测试报「无法连接运行服务」：preview 进程未启动或 nginx 上游端口不符。
