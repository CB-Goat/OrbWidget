# 浮球挂件 PWA — 服务器部署指南
# 适用于：Linux + Docker + Nginx（已有 3 个项目共用 1 个 Nginx）

## 📋 部署步骤（共 5 步）

---

### 第 1 步：上传项目到服务器

```bash
# 在服务器上操作
cd /opt
git clone <你的仓库地址> orb-widget
cd orb-widget
```

或在本地打包后上传：
```bash
# 本地打包（排除 node_modules）
tar --exclude='node_modules' --exclude='.git' -czvf orb-widget.tar.gz .
# 上传到服务器 /opt/ 后解压
```

---

### 第 2 步：修改 Nginx 配置

编辑你现有的 Nginx 配置（通常在 `/etc/nginx/nginx.conf` 或 `/etc/nginx/sites-available/default`），在 `http {}` 块内新增以下内容：

**方式 A：直接编辑主配置**
```bash
nano /etc/nginx/nginx.conf
```

在 `http {}` 块底部（`include /etc/nginx/conf.d/*.conf;` 之前）插入：

```nginx
    # 浮球挂件 PWA
    upstream orb_backend {
        server 127.0.0.1:3001;   # Docker 映射端口，见第 3 步
        keepalive 32;
    }

    server {
        listen 443 ssl;
        server_name orb.yourdomain.com;   # ← 改成你的子域名

        ssl_certificate     /etc/nginx/ssl/your-cert.pem;
        ssl_certificate_key /etc/nginx/ssl/your-cert-key.pem;
        ssl_protocols       TLSv1.2 TLSv1.3;

        add_header X-Frame-Options        "SAMEORIGIN"    always;
        add_header X-Content-Type-Options "nosniff"       always;
        add_header Referrer-Policy        "no-referrer-when-downgrade" always;

        location / {
            proxy_pass         http://orb_backend;
            proxy_http_version 1.1;
            proxy_set_header   Upgrade    $http_upgrade;
            proxy_set_header   Connection "upgrade";
            proxy_set_header   Host       $host;
            proxy_set_header   X-Real-IP  $remote_addr;
            proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
            proxy_set_header   X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        location /service-worker.js {
            proxy_pass         http://orb_backend;
            proxy_http_version 1.1;
            proxy_set_header   Host $host;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            add_header Service-Worker-Allowed "/";
        }
    }

    # HTTP 自动跳转 HTTPS（如已有则跳过）
    server {
        listen 80;
        server_name orb.yourdomain.com;
        return 301 https://$host$request_uri;
    }
```

**方式 B：用 include（更清晰，推荐）**
```bash
# 把 deploy/nginx-orb-widget.conf 复制到 Nginx 配置目录
cp /opt/orb-widget/deploy/nginx-orb-widget.conf /etc/nginx/snippets/orb-widget.conf

# 在主 nginx.conf 的 http{} 块里加入：
#     include /etc/nginx/snippets/orb-widget.conf;
```

配置完成后检查语法：
```bash
nginx -t
```

---

### 第 3 步：启动 Docker 容器

```bash
cd /opt/orb-widget

# 构建镜像
docker build -t orb-widget:latest .

# 运行容器（映射到 3001 端口，Nginx 反代）
docker run -d \
  --name orb-widget \
  --restart unless-stopped \
  -p 127.0.0.1:3001:3000 \
  -e NODE_ENV=production \
  orb-widget:latest

# 验证容器运行正常
docker logs orb-widget
docker ps | grep orb-widget
```

或使用 docker-compose：
```bash
# 如果你用 docker network，先创建网络（复用你已有的）
docker network create orb-network 2>/dev/null || true

# 启动
docker compose up -d

# 查看日志
docker compose logs -f
```

---

### 第 4 步：申请/配置 SSL 证书

**如果已有证书**，直接修改 Nginx 配置中的路径即可：
```
ssl_certificate     /etc/nginx/ssl/your-cert.pem;
ssl_certificate_key /etc/nginx/ssl/your-cert-key.pem;
```

**如果没有证书，用 Let's Encrypt 免费申请：**
```bash
# 安装 certbot
apt install -y certbot python3-certbot-nginx

# 申请证书（把你的域名改成实际域名）
certbot --nginx -d orb.yourdomain.com

# 自动续期（Let's Encrypt 证书有效期 90 天，certbot 会配置定时任务）
systemctl status certbot.timer
```

---

### 第 5 步：重载 Nginx 并验证

```bash
# 重载 Nginx
nginx -s reload

# 验证服务
curl -I https://orb.yourdomain.com/
# 应该看到 HTTP/2 200 和 Service-Worker-Allowed header

# 检查 API 健康
curl https://orb.yourdomain.com/api/health
# 应返回 {"status":"ok",...}
```

---

## 🔧 常用运维命令

```bash
# 查看容器日志
docker logs -f orb-widget

# 重启
docker restart orb-widget

# 更新部署（拉取新代码后）
cd /opt/orb-widget
git pull
docker build -t orb-widget:latest .
docker stop orb-widget && docker rm orb-widget
docker run -d --name orb-widget --restart unless-stopped \
  -p 127.0.0.1:3001:3000 \
  -e NODE_ENV=production \
  orb-widget:latest

# 停止
docker stop orb-widget

# 完全卸载
docker stop orb-widget
docker rm orb-widget
docker rmi orb-widget:latest
# 并删除 Nginx 配置，重载 nginx -s reload
```

---

## 🌐 域名解析

记得在你的 DNS 管理后台添加一条 A 记录（或 CNAME）：
```
主机记录：orb（或你喜欢的子域名）
记录类型：A
记录值：你的服务器 IP
```

---

## ⚠️ 注意事项

1. **HTTPS 是必须的** — PWA 的 Service Worker 只能在 HTTPS 下工作
2. **端口不要暴露到公网** — Docker 映射到 `127.0.0.1:3001`，只通过 Nginx 反代访问
3. **防火墙** — 确保 80/443 端口开放
4. **域名** — 如果没有域名，Chrome 浏览器可以访问 IP，但 iOS Safari 安装 PWA 强制需要 HTTPS + 域名
5. **MySQL** — 本项目不需要 MySQL，无需修改数据库配置
