# Linux 下 MySQL 远程连接（SQLyog）

## 远程连接的前提条件

在 Windows 上用 SQLyog 连接 Linux 服务器上的 MySQL，需要满足三个条件：

1. **网络通**：Windows 能访问到 Linux 服务器的 3306 端口
2. **MySQL 服务在监听**：MySQL 绑定了 `0.0.0.0` 或服务器的 IP，而不是仅 `127.0.0.1`
3. **账号有权限**：MySQL 用户被授权允许从你的 Windows IP 连接

三个条件缺一不可。排查问题也从这三个方向来。

## 第一步：确认网络连通性

### Windows ping Linux 服务器

```bash
# 在 Windows CMD 中
ping 你的Linux服务器IP
```

如果 ping 不通：
- 检查服务器 IP 是否正确
- 检查网络是否在同一网段
- 联系网络管理员

### Windows telnet 检测端口

```bash
# Windows 默认可能没开 telnet，先用 PowerShell 测试端口
Test-NetConnection -ComputerName 服务器IP -Port 3306
```

或者用 telnet（需要先开启 Windows 功能）：

```bash
telnet 服务器IP 3306
```

如果连接超时或被拒绝，说明：
- 防火墙挡住了（Linux 或 云服务器安全组）
- MySQL 没在 3306 端口监听

## 第二步：检查 Linux 防火墙

### CentOS / RHEL（firewalld）

```bash
# 查看防火墙状态
sudo systemctl status firewalld

# 开放 3306 端口
sudo firewall-cmd --zone=public --add-port=3306/tcp --permanent

# 重新加载
sudo firewall-cmd --reload

# 确认
sudo firewall-cmd --list-ports
```

### Ubuntu / Debian（ufw）

```bash
# 查看状态
sudo ufw status

# 开放 3306
sudo ufw allow 3306/tcp

# 确认
sudo ufw status verbose
```

### 快速关闭防火墙（不推荐生产环境）

```bash
# CentOS
sudo systemctl stop firewalld
sudo systemctl disable firewalld

# Ubuntu
sudo ufw disable
```

如果关闭防火墙后能连上，说明就是防火墙问题，记得重新配置规则。

### 云服务器安全组

如果你用的是阿里云、腾讯云、AWS 等云服务器，还需要**在云平台控制台的安全组里开放 3306 端口**。

```
阿里云：ECS → 实例 → 安全组 → 配置规则 → 入方向 → 添加 3306
腾讯云：CVM → 安全组 → 入站规则 → 添加 3306
AWS：EC2 → Security Groups → Inbound Rules → 添加 MySQL/Aurora 3306
```

## 第三步：配置 MySQL 绑定地址

### 检查当前绑定地址

```sql
SHOW VARIABLES LIKE 'bind_address';
```

常见值及含义：

| 值 | 含义 | 远程能否访问 |
|----|------|------------|
| `127.0.0.1` | 仅本地回环 | ❌ |
| `0.0.0.0` | 所有网络接口 | ✅ |
| 服务器 IP | 仅指定 IP | 仅该 IP |

如果绑定了 `127.0.0.1`，远程是肯定连不上的。

### 修改绑定地址

编辑 MySQL 配置文件：

```bash
sudo vim /etc/my.cnf
# 或
sudo vim /etc/mysql/mysql.conf.d/mysqld.cnf
```

添加或修改：

```ini
[mysqld]
# 绑定所有网络接口（或者绑定你的服务器 IP）
bind-address=0.0.0.0

# 如果有多个网卡，可以指定 IP
# bind-address=192.168.1.100
```

重启 MySQL：

```bash
sudo systemctl restart mysqld
```

再次确认：

```sql
SHOW VARIABLES LIKE 'bind_address';
-- 应该是 0.0.0.0
```

## 第四步：授权远程访问账号

### 创建允许远程连接的用户

```sql
-- 创建新用户并授权
CREATE USER '你的用户名'@'%' IDENTIFIED BY '你的密码';
GRANT ALL PRIVILEGES ON *.* TO '你的用户名'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;

-- 或者修改已有的 root 用户
ALTER USER 'root'@'%' IDENTIFIED BY '你的密码';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;
```

> `%` 表示允许任何 IP 连接。如果要限制特定 IP，把 `%` 换成具体 IP 地址。

### 查看用户及其允许的 host

```sql
SELECT user, host FROM mysql.user;
```

输出类似：

```
+-------------+-------------+
| user        | host        |
+-------------+-------------+
| root        | localhost   |
| myuser      | %           |
| myuser      | 127.0.0.1   |
+-------------+-------------+
```

如果 `root` 只出现在 `localhost` 行，那么远程用 root 登录会失败。

### 撤销权限（如果需要）

```sql
-- 撤销某个用户的远程权限
REVOKE ALL PRIVILEGES ON *.* FROM '用户名'@'%';

-- 删除用户
DROP USER '用户名'@'%';
```

## 第五步：SQLyog 连接配置

打开 SQLyog，点击「新建」：

| 字段 | 填写内容 | 示例 |
|-----|---------|------|
| 连接名 | 随便起 | `生产服务器 MySQL` |
| MySQL 主机地址 | Linux 服务器 IP | `192.168.1.100` |
| 用户名 | MySQL 用户名 | `myuser` |
| 密码 | MySQL 密码 | `xxxxx` |
| 端口 | MySQL 端口 | `3306` |

点击「测试连接」。

### 常见连接错误

#### ERROR 1130: Host 'xxx' is not allowed

```
ERROR 1130: Host '192.168.1.50' is not allowed to connect to this MySQL server
```

**原因**：MySQL 用户没有被授权从这个 IP 连接。

**解决**：在 Linux 服务器上执行授权 SQL（参考第四步）。

#### ERROR 1045: Access denied

```
ERROR 1045: Access denied for user 'myuser'@'192.168.1.50'
```

**原因**：用户名或密码错误。

**解决**：确认用户名密码，或者重新设置密码：

```sql
ALTER USER 'myuser'@'%' IDENTIFIED BY '新密码';
FLUSH PRIVILEGES;
```

#### 连接超时

**原因**：防火墙或网络不通。

**解决**：
1. `ping 服务器IP` 看网络是否通
2. `telnet 服务器IP 3306` 看端口是否通
3. 检查 Linux 防火墙和安全组

## 第六步：用 SSH 隧道连接（更安全）

如果直接开放 3306 端口不安全，可以通过 SSH 隧道连接。

### SQLyog SSH 配置

1. SQLyog 主界面点击「新建」旁边的「SSH」标签
2. 填写 SSH 信息：

| 字段 | 内容 |
|-----|------|
| 使用 SSH 隧道 | ✅ 勾选 |
| SSH 主机 | Linux 服务器 IP |
| SSH 端口 | `22` |
| 用户名 | Linux 服务器用户名 |
| 认证方式 | 密码 或 密钥文件 |

3. 然后在「MySQL」标签填写：

| 字段 | 内容 |
|-----|------|
| MySQL 主机地址 | `127.0.0.1` |
| 用户名 / 密码 | MySQL 用户名和密码 |

这样 SQLyog 会通过 SSH 连接到 Linux 服务器，然后从服务器本地连接 MySQL，不用开放 3306 端口。

### 命令行 SSH 隧道（备选）

```bash
# Windows PowerShell 或 Git Bash
ssh -L 3307:127.0.0.1:3306 用户名@服务器IP
# 然后本地用 3307 端口连接
mysql -h 127.0.0.1 -P 3307 -u 用户名 -p
```

## 完整的连接故障排查流程

```
Windows 无法连接 Linux MySQL？
  ↓
ping Linux服务器IP 通吗？
  ↓ 不通 → 网络问题，检查网线和交换机
  ↓ 通
telnet 3306 端口通吗？
  ↓ 不通 → 防火墙问题，开放 3306 端口
  ↓ 通
MySQL 绑定地址是 0.0.0.0 吗？
  ↓ 不是 127.0.0.1 → 修改 my.cnf，重启
  ↓ 是 0.0.0.0
MySQL 用户允许从 % 连接吗？
  ↓ 不允许 → 授权 GRANT 语句
  ↓ 允许
密码正确吗？
  ↓ 不正确 → 重新设置密码
  ↓ 正确
→ 连接成功！
```

## 下一步

远程连接配置好了，可以开始学习 [SQL 核心语法](/database/mysql/sql/basic/overview) 了。或者如果你在做开发环境，可以用 [Navicat/SQLyog/DBeaver 工具使用](/database/mysql/basic/install/tools) 里的方法直接管理数据库。
