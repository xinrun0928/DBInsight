# 安装常见问题（服务启动 / 用户登录）

## MySQL 服务启动问题

MySQL 装好了，但服务起不来——这是新手的第一个拦路虎。

### Windows：服务无法启动

#### 排查步骤

**第一步：查看错误日志**

MySQL 服务启动失败的原因全部在错误日志里：

```
C:\ProgramData\MySQL\MySQL Server 5.7\Data\*.err
# 或
C:\ProgramData\MySQL\MySQL Server 8.0\MySQLError.log
```

用记事本打开 `.err` 文件，搜索 `ERROR` 开头的行。

#### 常见错误一：端口被占用

```
[ERROR] [Server] A mysqld process with the pid or socket /tmp/mysql.sock already exists.
```

或者：

```
[ERROR] Cannot find port 3306
```

**解决方法：**

```bash
# 查看 3306 端口被谁占用
netstat -ano | findstr 3306

# 假设输出是 PID 4568
taskkill /PID 4568 /F
```

如果端口被另一个 MySQL 占用，评估后决定是否关闭另一个实例。或者在 `my.ini` 中修改端口：

```ini
[mysqld]
port=3307
```

#### 常见错误二：数据目录权限不足

```
[ERROR] InnoDB: Cannot open datafile for read-only tablespace 'ibdata1'
```

Windows 上最常见的原因是**非管理员用户无法写入数据目录**。

**解决方法：**
1. 右键「命令提示符」→「以管理员身份运行」
2. 执行：

```bash
net stop MySQL80
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld" --install MySQL80
net start MySQL80
```

#### 常见错误三：my.ini 配置错误

```ini
[mysqld]
# 如果路径中有反斜杠，Windows 上要双写
datadir=C:\ProgramData\MySQL\MySQL Server 8.0\Data
```

路径有空格或特殊字符，用引号包裹：

```ini
datadir="C:\Program Files\MySQL\MySQL Server 8.0\Data"
```

### macOS：服务启动失败

```bash
# 查看错误日志
cat /usr/local/mysql/data/*.err

# 手动启动看错误输出
cd /usr/local/mysql
sudo ./bin/mysqld_safe
```

常见原因：数据目录权限问题。

```bash
# 修复权限
sudo chown -R _mysql:_mysql /usr/local/mysql/data
```

### Linux：服务启动失败

```bash
# 查看状态
sudo systemctl status mysqld

# 查看详细日志
sudo journalctl -u mysqld -n 50

# 查看错误日志
sudo cat /var/log/mysqld.log
```

常见错误及解决方法：

| 错误信息 | 原因 | 解决方法 |
|---------|------|---------|
| `socket file not found` | 服务未启动或 socket 路径错误 | `systemctl start mysqld` |
| `data directory not empty` | 重复初始化 | 清空数据目录后重新初始化 |
| `cannot change ownership` | 权限不足 | 用 `sudo` 执行 |
| `port already in use` | 端口被占用 | 换端口或杀掉占用进程 |

## 用户登录问题

### 忘记 root 密码

这是最常见的问题。没有密码怎么改密码？答案是**跳过权限验证启动**。

#### 方式一：命令行跳过授权（通用）

**第一步：停止 MySQL 服务**

```bash
# Linux
sudo systemctl stop mysqld

# macOS
mysql.server stop

# Windows
net stop MySQL80
```

**第二步：以跳过权限验证的方式启动**

```bash
# Linux / macOS
mysqld_safe --skip-grant-tables --skip-networking &

# Windows（管理员权限 CMD）
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld" --skip-grant-tables --shared-memory
```

**第三步：登录并修改密码**

```bash
mysql -u root

# MySQL 8.0
FLUSH PRIVILEGES;
ALTER USER 'root'@'localhost' IDENTIFIED BY '新密码';

# MySQL 5.7
FLUSH PRIVILEGES;
UPDATE mysql.user SET authentication_string=PASSWORD('新密码') WHERE User='root';
FLUSH PRIVILEGES;
```

**第四步：重启 MySQL（正常模式）**

先杀掉跳过授权启动的进程，再正常启动。

#### 方式二：init-file 初始化（推荐生产环境）

创建一个 SQL 文件：

```sql
-- reset_root.sql
FLUSH PRIVILEGES;
ALTER USER 'root'@'localhost' IDENTIFIED BY 'NewP@ssw0rd!';
```

启动时指定：

```bash
mysqld --init-file=/path/to/reset_root.sql
```

### 连接被拒绝（Access Denied）

```
ERROR 1045 (28000): Access denied for user 'root'@'localhost' (using password: YES)
```

这个报错有三种可能：

#### 情况一：密码错误

最常见。确认密码是否正确：

```bash
# 先不输入密码，看是否能连接
mysql -u root

# 如果空密码能连上，说明你记错了密码，需要重置
```

#### 情况二：主机限制

MySQL 的用户不仅看用户名，还看来源主机。

```sql
-- 查看所有 root 用户及其允许登录的主机
SELECT user, host FROM mysql.user WHERE user = 'root';
```

| host 值 | 含义 |
|--------|------|
| `localhost` | 只能本地 Unix socket 连接 |
| `127.0.0.1` | 只能通过 TCP/IP 连接（localhost） |
| `%` | 允许任何主机连接 |
| `192.168.1.%` | 允许指定网段连接 |

如果 root 只允许 `localhost` 登录，远程工具（Navicat、SQLyog）连不上是正常的。需要新建一个允许远程连接的用户：

```sql
-- 创建允许远程连接的用户
CREATE USER 'root'@'%' IDENTIFIED BY '你的密码';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;
```

#### 情况三：认证插件不兼容

MySQL 8.0 默认使用 `caching_sha2_password` 认证插件，老版本的 JDBC 驱动（8.0.12 之前）不支持。

**解决方案一**：升级 JDBC 驱动到 8.0.12 以上。

**解决方案二**：把用户改成旧版认证插件：

```sql
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '你的密码';
```

### 远程连接失败

本地能连，远程连不上。从两个方向排查：

#### 服务端检查

```bash
# 查看 MySQL 是否监听了 3306 端口
netstat -tlnp | grep 3306

# 应该看到类似输出：
# tcp        0      0 0.0.0.0:3306              0.0.0.0:*               LISTEN      12345/mysqld
```

如果是 `127.0.0.1:3306`，说明只监听了本地回环，远程无法访问。

修改 `my.cnf`：

```ini
[mysqld]
bind-address=0.0.0.0
```

然后重启。

#### 防火墙检查

```bash
# Linux - CentOS/RHEL
sudo firewall-cmd --zone=public --add-port=3306/tcp --permanent
sudo firewall-cmd --reload

# Linux - Ubuntu/Debian
sudo ufw allow 3306/tcp

# macOS（需要关闭「系统偏好设置 → 安全性与隐私 → 防火墙」）
```

### 其他常见问题

#### Q：mysql 命令提示「不是内部命令」

环境变量没配。在 `Path` 里加上 MySQL 的 `bin` 目录路径后，重开终端。

#### Q：服务启动后立即停止

通常是 `my.ini` 配置文件有语法错误。检查：
- 路径是否正确
- 是否有多余的空格或引号
- 是否重复定义了参数

#### Q：macOS 安装后找不到 mysql 命令

Homebrew 安装时注意提示的路径，通常是 `/usr/local/opt/mysql@5.7/bin/mysql`，需要加到 PATH 里。

## 快速诊断清单

遇到问题，先按这个顺序排查：

1. MySQL 服务是否启动？（`systemctl status mysqld` / `net start MySQL80`）
2. 端口是否被占用？（`netstat -tlnp | grep 3306`）
3. 错误日志说了什么？（`.err` 文件）
4. 密码是否正确？（试试空密码）
5. 防火墙是否放行？（`firewall-cmd --list-ports`）
6. 用户 host 是否允许当前连接？（`SELECT user, host FROM mysql.user`）

## 下一步

服务能启动、能登录了，接下来安装一个趁手的客户端工具——[Navicat / SQLyog / DBeaver 工具使用](/database/mysql/basic/install/tools)。
